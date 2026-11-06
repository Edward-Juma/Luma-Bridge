/**
 * End-to-end smoke test against a running API seeded with `npm run db:seed`.
 *   API=http://localhost:4000 node test/smoke.mjs
 * Exercises: donations (anonymous / public), privacy projection, registration, duplicate detection,
 * uploads, need submission gating, staff 2FA login, review gate, approval, refresh + CSRF.
 */
import { authenticator } from 'otplib';
import crypto from 'node:crypto';

const API = process.env.API ?? 'http://localhost:4000';
const ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
let pass = 0, fail = 0;

const ok = (cond, name, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} ${extra}`); }
};

class Client {
  jar = new Map();
  token = null;
  async call(method, path, { json, form, headers = {} } = {}) {
    const h = { Origin: ORIGIN, ...headers };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    if (this.jar.size) h.Cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    let body;
    if (json !== undefined) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
    if (form) body = form;
    const res = await fetch(API + path, { method, headers: h, body });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';'); const i = pair.indexOf('=');
      const v = pair.slice(i + 1);
      if (c.includes('Max-Age=0') || c.includes('Expires=Thu, 01 Jan 1970') || v === '') this.jar.delete(pair.slice(0, i)); else this.jar.set(pair.slice(0, i), v);
    }
    const ct = res.headers.get('content-type') ?? '';
    const data = ct.includes('json') ? await res.json() : await res.text();
    return { status: res.status, data };
  }
}

const pdf = (salt) => Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n% ${salt}\n${' '.repeat(16000)}\n%%EOF`);
const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), crypto.randomBytes(20000)]);
const file = (buf, name, type) => new Blob([buf], { type });

async function main() {
  const pub = new Client();

  console.log('\nPublic read API');
  const stats = await pub.call('GET', '/api/stats');
  ok(stats.status === 200 && stats.data.activeCampaigns > 0, 'stats');
  const feed = await pub.call('GET', '/api/needs?pageSize=12&category=MEDICAL');
  ok(feed.status === 200 && feed.data.items.every((n) => n.category === 'MEDICAL'), 'feed filters by category', JSON.stringify(feed.data).slice(0, 200));
  ok(feed.data.items.every((n) => n.beneficiary.name.split(' ').length <= 2 && !('fullName' in n.beneficiary)), 'feed only exposes first name + initial');
  const feedUrgent = await pub.call('GET', '/api/needs?sort=urgent');
  ok(feedUrgent.data.items[0].priority === 'CRITICAL', 'urgent sort puts CRITICAL first');
  const nearly = await pub.call('GET', '/api/needs?sort=nearly_funded');
  ok(nearly.status === 200 && nearly.data.items[0].percent >= nearly.data.items.at(-1).percent, 'nearly-funded sort');
  const ages = await pub.call('GET', '/api/needs?minAge=40&maxAge=60');
  ok(ages.data.items.every((n) => n.beneficiary.age >= 40 && n.beneficiary.age <= 60), 'age range filter', JSON.stringify(ages.data.items.map((n) => n.beneficiary.age)));
  const q = await pub.call('GET', '/api/needs?q=sewing');
  ok(q.data.total >= 1 && q.data.items.every((n) => /sewing/i.test(n.title + n.summary)), 'text search', String(q.data.total));
  const target = feed.data.items[0];
  const detail = await pub.call('GET', `/api/needs/${target.slug}`);
  ok(detail.status === 200 && detail.data.audit.verificationId?.startsWith('HB-'), 'detail includes verification id');
  ok(!JSON.stringify(detail.data).match(/nationalId|phone|detailsEnc|donorEmail/i), 'detail leaks no private fields');
  ok(detail.data.paymentMethods.every((p) => /^•+/.test(p.maskedHint) && !('details' in p)), 'payment methods are masked');

  console.log('\nDonations');
  const rates = await pub.call('GET', '/api/donations/rates');
  ok(rates.status === 200 && rates.data.usdPerUnit.EUR > 0, 'fx rates');
  const quote = await pub.call('GET', '/api/donations/quote?amount=100&currency=EUR');
  ok(quote.status === 200 && quote.data.amountUsd > 90, 'quote converts EUR → USD');
  const before = Number(detail.data.raisedUsd);
  const anon = await pub.call('POST', '/api/donations', { json: { needId: target.id, amount: 25, currency: 'USD', gateway: 'MOCK', anonymous: true, donorName: 'Should Not Show', message: 'secret' } });
  ok(anon.status === 201 && anon.data.status === 'SUCCEEDED', 'anonymous donation succeeds (mock gateway)', JSON.stringify(anon.data));
  const pubDon = await pub.call('POST', '/api/donations', { json: { needId: target.id, amount: 5000, currency: 'KES', gateway: 'MOCK', anonymous: false, donorName: 'Test Donor', donorCountry: 'KE', message: 'Hello!' } });
  ok(pubDon.status === 201 && pubDon.data.amountUsd > 30 && pubDon.data.amountUsd < 50, 'KES donation converted to USD', JSON.stringify(pubDon.data));
  const after = await pub.call('GET', `/api/needs/${target.slug}`);
  ok(Math.abs(Number(after.data.raisedUsd) - before - 25 - pubDon.data.amountUsd) < 0.05, 'raised total updated', `${before} → ${after.data.raisedUsd}`);
  const names = after.data.recentDonations.map((d) => d.donorName);
  ok(names.includes('Test Donor') && !JSON.stringify(after.data.recentDonations).includes('Should Not Show') && !JSON.stringify(after.data.recentDonations).includes('secret'), 'anonymous donor details never exposed');
  const receipt = await pub.call('GET', `/api/donations/receipt/${anon.data.receiptToken}`);
  ok(receipt.status === 200 && receipt.data.status === 'SUCCEEDED' && receipt.data.donorName === null, 'receipt');
  const noGw = await pub.call('POST', '/api/donations', { json: { needId: target.id, amount: 10, currency: 'USD', gateway: 'STRIPE', anonymous: true } });
  ok(noGw.status === 400, 'unconfigured gateway rejected');
  const noName = await pub.call('POST', '/api/donations', { json: { needId: target.id, amount: 10, currency: 'USD', gateway: 'MOCK', anonymous: false } });
  ok(noName.status === 400, 'public donation requires a name');
  const tiny = await pub.call('POST', '/api/donations', { json: { needId: target.id, amount: 0.1, currency: 'USD', gateway: 'MOCK', anonymous: true } });
  ok(tiny.status === 400, 'below-minimum donation rejected');
  const ticker = await pub.call('GET', '/api/ticker');
  ok(ticker.data.items.length > 0 && ticker.data.items.every((i) => !('donorEmail' in i)), 'ticker');

  console.log('\nBeneficiary onboarding');
  const stamp = Date.now();
  const reg = {
    email: `smoke${stamp}@example.com`, password: 'Sup3rSecret!pw', fullName: 'Smoke Tester', nationalId: `SMK-${stamp}`, phone: `+999 555 ${String(stamp).slice(-6)}`,
    gender: 'FEMALE', dateOfBirth: '1990-04-12', country: 'KE', city: 'Nairobi', incomeLevel: 'LOW', occupation: 'Tailor', familySize: 4,
    emergencyContactName: 'Contact Person', emergencyContactPhone: `+999 666 ${String(stamp).slice(-6)}`,
    about: 'I am a tailor supporting my family and need help after losing my equipment in a fire.',
  };
  const b = new Client();
  const availableEmail = await new Client().call('POST', '/api/auth/email-availability', { json: { email: reg.email } });
  ok(availableEmail.status === 200 && availableEmail.data.available, 'new registration email is available');
  const r1 = await b.call('POST', '/api/auth/register', { json: reg });
  ok(r1.status === 201 && r1.data.accessToken, 'register', JSON.stringify(r1.data));
  const takenEmail = await new Client().call('POST', '/api/auth/email-availability', { json: { email: reg.email } });
  ok(takenEmail.status === 200 && !takenEmail.data.available, 'registered email is unavailable');
  b.token = r1.data.accessToken;
  const dup = await new Client().call('POST', '/api/auth/register', { json: { ...reg, email: `other${stamp}@example.com` } });
  ok(dup.status === 409, 'duplicate national ID / phone rejected');
  const weak = await new Client().call('POST', '/api/auth/register', { json: { ...reg, email: `w${stamp}@example.com`, password: 'short' } });
  ok(weak.status === 400, 'weak password rejected');
  const badLogin = await new Client().call('POST', '/api/auth/login', { json: { email: reg.email, password: 'wrong-password-1A' } });
  ok(badLogin.status === 401, 'wrong password rejected');

  let dash = await b.call('GET', '/api/me/dashboard');
  ok(dash.status === 200 && dash.data.profile.verificationStatus === 'DRAFT' && dash.data.profile.nationalIdMasked.startsWith('••••'), 'dashboard shows masked national ID');
  const noAccess = await new Client().call('GET', '/api/me/dashboard');
  ok(noAccess.status === 401, 'dashboard requires auth');

  const needRes = await b.call('POST', '/api/me/needs', { json: { title: 'Replacement sewing equipment', summary: 'A fire destroyed my machines and fabric stock last month.', story: 'x'.repeat(260), category: 'SMALL_BUSINESS', priority: 'MEDIUM', goalUsd: 600 } });
  ok(needRes.status === 201, 'create need', JSON.stringify(needRes.data));
  const needId = needRes.data.id;
  const early = await b.call('POST', `/api/me/needs/${needId}/submit`);
  ok(early.status === 400 && early.data.error.details.missing.length >= 3, 'submission blocked until requirements are met');

  let fd = new FormData(); fd.append('file', file(png(), 'me.png', 'image/png'), 'me.png');
  ok((await b.call('POST', '/api/me/photo', { form: fd })).status === 200, 'upload profile photo');
  fd = new FormData(); fd.append('kind', 'IDENTITY'); fd.append('file', file(pdf('id' + stamp), 'id.pdf', 'application/pdf'), 'id.pdf');
  ok((await b.call('POST', '/api/me/documents', { form: fd })).status === 201, 'upload identity document');
  fd = new FormData(); fd.append('kind', 'REFERENCE_LETTER'); fd.append('file', file(pdf('ref' + stamp), 'ref.pdf', 'application/pdf'), 'ref.pdf');
  ok((await b.call('POST', '/api/me/documents', { form: fd })).status === 201, 'upload reference letter');
  fd = new FormData(); fd.append('kind', 'OTHER'); fd.append('file', file(Buffer.from('<?php system($_GET[0]); ?>'.padEnd(100, ' ')), 'x.pdf', 'application/pdf'), 'x.pdf');
  ok((await b.call('POST', '/api/me/documents', { form: fd })).status === 400, 'disguised non-PDF upload rejected (content sniffing)');
  const pm = await b.call('POST', '/api/me/payment-methods', { json: { type: 'MPESA', label: 'M-Pesa', details: { phone: '0712345678' }, display: true } });
  ok(pm.status === 201 && pm.data.maskedHint === '••••5678' && !('details' in pm.data), 'add payment method (masked)');
  const sub = await b.call('POST', `/api/me/needs/${needId}/submit`);
  ok(sub.status === 200 && sub.data.status === 'PENDING', 'submit for review', JSON.stringify(sub.data));
  const stillHidden = await pub.call('GET', `/api/needs/${needRes.data.slug}`);
  ok(stillHidden.status === 404, 'pending campaign is NOT public');
  const edit = await b.call('PATCH', `/api/me/needs/${needId}`, { json: { goalUsd: 9999 } });
  ok(edit.status === 409, 'cannot edit while under review');

  console.log('\nStaff & verification');
  const s = new Client();
  const l1 = await s.call('POST', '/api/auth/login', { json: { email: 'auditor@lumabridge.dev', password: 'Auditor#LumaBridge1' } });
  ok(l1.data.mfaRequired && l1.data.challenge, 'staff login requires 2FA');
  const badMfa = await s.call('POST', '/api/auth/mfa/verify', { json: { challenge: l1.data.challenge, code: '000000' } });
  ok(badMfa.status === 401, 'wrong TOTP rejected');
  const l2 = await s.call('POST', '/api/auth/mfa/verify', { json: { challenge: l1.data.challenge, code: authenticator.generate('JBSWY3DPEHPK3PXP') } });
  ok(l2.status === 200 && l2.data.user.mfaVerified, 'TOTP accepted');
  s.token = l2.data.accessToken;
  const benefTry = await b.call('GET', '/api/staff/queue');
  ok(benefTry.status === 403, 'beneficiary cannot reach staff API');
  const queue = await s.call('GET', '/api/staff/queue?status=PENDING');
  ok(queue.status === 200 && queue.data.items.some((i) => i.needId === needId), 'application appears in queue');
  const suspicious = queue.data.items.find((i) => i.applicant.name === 'Ibrahim Yusuf');
  ok(suspicious && suspicious.fraudScore >= 40, 'fraud scoring flags duplicate-document applicant', JSON.stringify(suspicious));
  const detailStaff = await s.call('GET', `/api/staff/applications/${needId}`);
  ok(detailStaff.status === 200 && detailStaff.data.applicant.nationalId === reg.nationalId && detailStaff.data.paymentMethods[0].details.phone === '0712345678', 'auditor can see decrypted PII');
  const doc = detailStaff.data.documents[0];
  const raw = await fetch(`${API}/api/staff/documents/${doc.id}/file`, { headers: { Authorization: `Bearer ${s.token}` } });
  ok(raw.status === 200 && raw.headers.get('content-type') === 'application/pdf', 'document viewer streams file');
  const weakApprove = await s.call('POST', `/api/staff/applications/${needId}/review`, { json: { decision: 'APPROVE', notes: 'Looks fine to me overall.', checklist: { identity: true, documents: false, location: true, legitimacy: true, income: true, references: true } } });
  ok(weakApprove.status === 400, 'cannot approve without completing core checks');
  const info = await s.call('POST', `/api/staff/applications/${needId}/review`, { json: { decision: 'REQUEST_INFO', notes: 'Please add a recent utility bill as proof of address.', checklist: { identity: true, documents: false, location: false, legitimacy: false, income: false, references: false } } });
  ok(info.status === 200, 'request more information');
  dash = await b.call('GET', '/api/me/dashboard');
  ok(dash.data.profile.verificationStatus === 'NEEDS_INFO' && dash.data.feedback?.notes.includes('utility bill'), 'applicant sees auditor feedback');
  const edit2 = await b.call('PATCH', `/api/me/needs/${needId}`, { json: { goalUsd: 650 } });
  ok(edit2.status === 200, 'applicant can edit after info request');
  ok((await b.call('POST', `/api/me/needs/${needId}/submit`)).status === 200, 'resubmit');
  const approve = await s.call('POST', `/api/staff/applications/${needId}/review`, { json: { decision: 'APPROVE', notes: 'All documents confirmed with issuer; location verified by leader.', checklist: { identity: true, documents: true, location: true, legitimacy: true, income: true, references: true, communityLeader: true } } });
  ok(approve.status === 200, 'approve', JSON.stringify(approve.data));
  const live = await pub.call('GET', `/api/needs/${needRes.data.slug}`);
  ok(live.status === 200 && live.data.audit.verificationId, 'campaign is public after approval with a verification ID');
  const ban = await s.call('POST', `/api/staff/beneficiaries/${dash.data.profile.id}/account`, { json: { action: 'BAN', reason: 'testing ban flow' } });
  ok(ban.status === 403, 'auditors cannot permanently ban (admin only)');
  const susp = await s.call('POST', `/api/staff/beneficiaries/${dash.data.profile.id}/account`, { json: { action: 'SUSPEND', reason: 'testing suspension', days: 1 } });
  ok(susp.status === 200 && (await pub.call('GET', `/api/needs/${needRes.data.slug}`)).status === 404, 'suspension hides the campaign immediately');
  ok((await b.call('GET', '/api/me/dashboard')).status === 403, 'suspended account is locked out');
  await s.call('POST', `/api/staff/beneficiaries/${dash.data.profile.id}/account`, { json: { action: 'REINSTATE', reason: 'test complete' } });
  ok((await pub.call('GET', `/api/needs/${needRes.data.slug}`)).status === 200, 'reinstate restores the campaign');
  const logs = await s.call('GET', '/api/staff/audit-log');
  ok(logs.data.items.some((i) => i.action === 'review.approve') && logs.data.items.some((i) => i.action === 'pii.view'), 'audit log records decisions and PII access');

  console.log('\nSessions & CSRF');
  const noCsrf = await s.call('POST', '/api/auth/refresh');
  ok(noCsrf.status === 403, 'refresh without CSRF header rejected');
  const csrf = s.jar.get('hb_csrf');
  const ref = await s.call('POST', '/api/auth/refresh', { headers: { 'X-CSRF-Token': csrf } });
  ok(ref.status === 200 && ref.data.user.mfaVerified === true, 'refresh keeps staff MFA state', JSON.stringify(ref.data));
  const evil = await new Client().call('POST', '/api/donations', { json: {}, headers: { Origin: 'https://evil.example' } });
  ok(evil.status === 403, 'cross-origin write rejected');
  // Regression: silent refresh runs on every page load and must never be throttled by the strict login limiter.
  let throttled = 0;
  for (let i = 0; i < 30; i++) if ((await s.call('POST', '/api/auth/refresh', { headers: { 'X-CSRF-Token': csrf } })).status === 429) throttled++;
  ok(throttled === 0, 'session refresh is not throttled by the login limiter', `${throttled}/30 throttled`);
  const brute = new Client();
  let blocked = false;
  for (let i = 0; i < 30 && !blocked; i++) blocked = (await brute.call('POST', '/api/auth/login', { json: { email: `nobody${i}@example.com`, password: 'WrongPassw0rd!' } })).status === 429;
  ok(blocked, 'repeated failed logins are rate limited');
  const nf = await pub.call('GET', '/api/nope');
  ok(nf.status === 404, '404 JSON');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
