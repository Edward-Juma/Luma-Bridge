/**
 * Development seed. EVERYTHING here is fictional demo data (people, stories, documents, donors).
 * Images are generated illustrations, never photographs of real people.
 * Refuses to run in production.
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import type { Category, Gateway, Gender, IncomeLevel, Priority } from '@prisma/client';
import { prisma } from '../src/db';
import { encrypt, fingerprint, makeVerificationId, randomToken, sha256 } from '../src/lib/crypto';
import { validateDocument } from '../src/lib/documentValidator';
import { storePrivateDocument } from '../src/lib/storage';
import { scoreBeneficiary } from '../src/lib/fraud';
import { uniqueSlug } from '../src/lib/slug';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed a production database.');
  process.exit(1);
}

const DEV_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';
const ART_DIR = path.resolve(__dirname, '../../web/public/seed');

// ───────────────────────── Illustrated art (no real photos) ─────────────────────────
const PALETTE: Record<Category, [string, string]> = {
  EDUCATION: ['#2563EB', '#7C3AED'],
  FOOD: ['#F59E0B', '#EF4444'],
  MEDICAL: ['#10B981', '#0EA5E9'],
  RENT: ['#6366F1', '#0EA5E9'],
  DISABILITY_SUPPORT: ['#0EA5E9', '#10B981'],
  ELDERLY: ['#EC4899', '#F59E0B'],
  ORPHANS: ['#8B5CF6', '#EC4899'],
  SMALL_BUSINESS: ['#10B981', '#2563EB'],
  EMERGENCY_RELIEF: ['#EF4444', '#F59E0B'],
  REFUGEES: ['#0EA5E9', '#6366F1'],
};

const ICON: Record<Category, string> = {
  EDUCATION: '<path d="M0-34C-14-42-30-42-44-34V30C-30 22-14 22 0 30C14 22 30 22 44 30V-34C30-42 14-42 0-34ZM0-34V30" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>',
  FOOD: '<path d="M-44 -4H44C44 26 24 42 0 42S-44 26-44 -4Z" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round"/><path d="M-16-14C-26-26-6-30-16-44M12-14C2-26 22-30 12-44" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>',
  MEDICAL: '<rect x="-40" y="-40" width="80" height="80" rx="22" fill="none" stroke="#fff" stroke-width="6"/><path d="M0-20V20M-20 0H20" stroke="#fff" stroke-width="8" stroke-linecap="round"/>',
  RENT: '<path d="M-46 4L0-38L46 4M-32-6V40H32V-6" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><rect x="-10" y="14" width="20" height="26" rx="4" fill="none" stroke="#fff" stroke-width="6"/>',
  DISABILITY_SUPPORT: '<circle cx="-6" cy="-30" r="9" fill="#fff"/><path d="M-6-14V10H22M-6-4H14" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="-10" cy="18" r="22" fill="none" stroke="#fff" stroke-width="6"/>',
  ELDERLY: '<path d="M0 40C-50 6-40-30-18-30C-8-30 0-22 0-22S8-30 18-30C40-30 50 6 0 40Z" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>',
  ORPHANS: '<circle cx="-20" cy="-8" r="14" fill="none" stroke="#fff" stroke-width="6"/><circle cx="22" cy="2" r="10" fill="none" stroke="#fff" stroke-width="6"/><path d="M-46 40C-46 18-34 8-20 8S6 18 6 40M10 40C10 28 16 20 24 20S38 28 38 40" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>',
  SMALL_BUSINESS: '<path d="M-46-14L-36-38H36L46-14ZM-40-14V40H40V-14M-14 40V10H14V40" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>',
  EMERGENCY_RELIEF: '<circle r="38" fill="none" stroke="#fff" stroke-width="6"/><circle r="15" fill="none" stroke="#fff" stroke-width="6"/><path d="M-27-27L-11-11M27 27L11 11M27-27L11-11M-27 27L-11 11" stroke="#fff" stroke-width="8" stroke-linecap="round"/>',
  REFUGEES: '<path d="M-48 40L0-40L48 40ZM-14 40L0 8L14 40" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>',
};

function coverSvg(cat: Category, seed: number): string {
  const [a, b] = PALETTE[cat];
  const r = (n: number) => ((seed * 9301 + n * 49297) % 233280) / 233280;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img" aria-label="${cat.toLowerCase().replace(/_/g, ' ')} illustration">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<radialGradient id="h" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="800" height="600" fill="url(#g)"/><rect width="800" height="600" fill="url(#h)"/>
<circle cx="${120 + r(1) * 160}" cy="${400 + r(2) * 120}" r="${150 + r(3) * 90}" fill="#fff" opacity=".10"/>
<circle cx="${560 + r(4) * 180}" cy="${60 + r(5) * 120}" r="${110 + r(6) * 80}" fill="#fff" opacity=".12"/>
<circle cx="${300 + r(7) * 260}" cy="${480 + r(8) * 90}" r="${60 + r(9) * 50}" fill="#fff" opacity=".08"/>
<g transform="translate(400 300) scale(2.6)">${ICON[cat]}</g></svg>`;
}

function avatarSvg(name: string, cat: Category, seed: number): string {
  const [a, b] = PALETTE[cat];
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const rot = (seed * 37) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="Avatar for ${name}">
<defs><linearGradient id="g" gradientTransform="rotate(${rot} .5 .5)"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="400" height="400" fill="url(#g)"/><circle cx="330" cy="70" r="120" fill="#fff" opacity=".12"/><circle cx="60" cy="360" r="150" fill="#fff" opacity=".1"/>
<text x="200" y="238" font-family="Inter, system-ui, sans-serif" font-size="140" font-weight="600" fill="#fff" text-anchor="middle">${initials}</text></svg>`;
}

// ───────────────────────── Demo people ─────────────────────────
interface Demo {
  name: string; gender: Gender; age: number; country: string; city: string; occupation: string;
  income: IncomeLevel; family: number; category: Category; priority: Priority;
  title: string; summary: string; story: string; goal: number; pct: number;
  state: 'ACTIVE' | 'PENDING' | 'NEEDS_INFO' | 'FUNDED';
  updates?: { title: string; body: string; daysAgo: number }[];
}

const DEMOS: Demo[] = [
  {
    name: 'Amina Wanjiru', gender: 'FEMALE', age: 34, country: 'KE', city: 'Nairobi', occupation: 'Market vendor', income: 'LOW', family: 4,
    category: 'EDUCATION', priority: 'HIGH', title: 'School fees for my three children', goal: 900, pct: 62, state: 'ACTIVE',
    summary: 'Term fees and uniforms so my children can stay in school after a flood destroyed my stall.',
    story: 'I sell vegetables in a small market in Kangemi. In September, heavy rain flooded the lane and destroyed my stock and my stall. Since then I have been rebuilding from nothing, and the school has told us the children can sit exams only if the term fees are cleared.\n\nThis request covers three terms of fees, uniforms, and exam charges for Faith (14), Brian (11) and Joy (7). Every shilling will be paid directly to the school, and I will post the receipts here.',
    updates: [{ title: 'Fees paid for Faith', body: 'Thanks to your kindness Faith’s fees for this term were paid in full. She sat her exam on Monday.', daysAgo: 6 }],
  },
  {
    name: 'Joseph Otieno', gender: 'MALE', age: 58, country: 'KE', city: 'Kisumu', occupation: 'Retired fisherman', income: 'VERY_LOW', family: 5,
    category: 'MEDICAL', priority: 'CRITICAL', title: 'Cataract surgery so I can work again', goal: 650, pct: 81, state: 'ACTIVE',
    summary: 'Surgery on both eyes at a partner hospital. Without it I cannot go back to mending nets.',
    story: 'I fished on Lake Victoria for thirty years. Over the last two seasons my sight has faded until I can no longer tell the net from the water. The hospital has confirmed cataracts in both eyes and quoted the cost of surgery and follow-up care.\n\nThe hospital will invoice LumaBridge directly and the auditors have confirmed the quotation with the hospital’s billing office.',
    updates: [{ title: 'Pre-surgery check complete', body: 'The doctors cleared me for the first eye. Surgery is booked for next Thursday.', daysAgo: 3 }],
  },
  {
    name: 'Grace Namukasa', gender: 'FEMALE', age: 41, country: 'UG', city: 'Gulu', occupation: 'Seamstress', income: 'LOW', family: 6,
    category: 'SMALL_BUSINESS', priority: 'MEDIUM', title: 'A new sewing machine for my tailoring shop', goal: 480, pct: 44, state: 'ACTIVE',
    summary: 'My old machine finally broke. A replacement lets me take school-uniform orders again.',
    story: 'I have sewn school uniforms in Gulu for eleven years. My only machine broke beyond repair last month and I have turned away orders worth more than I earn in a season.\n\nA reliable treadle-and-motor machine and fabric stock will let me cover the next uniform season and hire a young apprentice from my neighbourhood.',
  },
  {
    name: 'Fatuma Abdi', gender: 'FEMALE', age: 29, country: 'KE', city: 'Dadaab', occupation: 'Community health volunteer', income: 'NONE', family: 5,
    category: 'REFUGEES', priority: 'HIGH', title: 'Winter blankets and cooking supplies for my family', goal: 350, pct: 73, state: 'ACTIVE',
    summary: 'Basic bedding and a cooking set for five people after our shelter was damaged.',
    story: 'Our family has lived in the camp for six years. A storm tore the roof of our shelter and we lost our bedding and most of our cooking things. The nights are cold and the children are falling sick.\n\nThe camp’s community leader has confirmed our registration, and the list of items has been checked by an NGO field officer.',
  },
  {
    name: 'Ravi Kumar', gender: 'MALE', age: 47, country: 'IN', city: 'Patna', occupation: 'Rickshaw driver', income: 'VERY_LOW', family: 5,
    category: 'MEDICAL', priority: 'HIGH', title: 'Dialysis support for my wife', goal: 1200, pct: 38, state: 'ACTIVE',
    summary: 'Three months of dialysis sessions for my wife while we wait for a government scheme to approve.',
    story: 'My wife Sunita needs dialysis three times a week. The government scheme will cover it, but approval has been delayed and each session costs more than I earn in two days of driving.\n\nThis goal covers three months of sessions directly with the hospital. The hospital has confirmed the treatment plan and the auditors verified her medical reports.',
    updates: [{ title: 'Scheme application filed', body: 'We submitted the final papers. Until the decision, your support keeps the sessions going.', daysAgo: 9 }],
  },
  {
    name: 'Samuel Mensah', gender: 'MALE', age: 22, country: 'GH', city: 'Kumasi', occupation: 'University student', income: 'LOW', family: 3,
    category: 'EDUCATION', priority: 'MEDIUM', title: 'Final-year tuition for my engineering degree', goal: 1500, pct: 27, state: 'ACTIVE',
    summary: 'I am one semester from graduating and cannot clear the balance on my tuition.',
    story: 'I am the first in my family to reach university. My father’s illness drained our savings and I have been working night shifts to stay enrolled. The university has said I can graduate if the remaining balance is cleared.\n\nPayments go directly to the university bursar and the auditors confirmed the outstanding balance with the registry.',
  },
  {
    name: 'Chinedu Eze', gender: 'MALE', age: 36, country: 'NG', city: 'Enugu', occupation: 'Mechanic', income: 'LOW', family: 5,
    category: 'DISABILITY_SUPPORT', priority: 'MEDIUM', title: 'Wheelchair and ramp for my daughter', goal: 700, pct: 55, state: 'ACTIVE',
    summary: 'A lightweight wheelchair and a ramp so my daughter can get to school independently.',
    story: 'My daughter Ngozi is nine and uses a wheelchair that she outgrew two years ago. It no longer folds and the school has asked us to find a safe alternative so she can keep attending.\n\nThe funds cover a correctly sized chair and building a ramp at our home entrance. A local rehabilitation centre assessed her and wrote the specification.',
  },
  {
    name: 'Layla Haddad', gender: 'FEMALE', age: 52, country: 'JO', city: 'Amman', occupation: 'Caregiver', income: 'VERY_LOW', family: 4,
    category: 'RENT', priority: 'CRITICAL', title: 'Two months of rent to avoid eviction', goal: 620, pct: 90, state: 'ACTIVE',
    summary: 'My landlord has issued a final notice. Rent for two months keeps my family housed while I find work.',
    story: 'After my husband’s accident I became the only earner. I lost my caregiving job when the family I worked for relocated, and I have fallen behind on rent. We have a final notice dated this month.\n\nA community leader and an NGO case worker have both confirmed my situation, and the payment will be made directly to the landlord.',
  },
  {
    name: 'Thabo Nkosi', gender: 'MALE', age: 71, country: 'ZA', city: 'Soweto', occupation: 'Retired miner', income: 'VERY_LOW', family: 2,
    category: 'ELDERLY', priority: 'MEDIUM', title: 'Medication and a heater for the winter months', goal: 400, pct: 35, state: 'ACTIVE',
    summary: 'Monthly heart medication and a safe heater for my wife and me.',
    story: 'I worked underground for thirty-four years and now live on a small pension that does not stretch to my heart medication and winter heating. My wife has arthritis that worsens in the cold.\n\nThe clinic has confirmed my prescription and the amount covers six months of medicine and a safe electric heater.',
  },
  {
    name: 'Tendai Chikwanha', gender: 'FEMALE', age: 12, country: 'ZW', city: 'Bulawayo', occupation: 'Student (guardian: aunt)', income: 'NONE', family: 4,
    category: 'ORPHANS', priority: 'HIGH', title: 'Keeping Tendai and her brother in school', goal: 560, pct: 100, state: 'FUNDED',
    summary: 'School fees, books and meals for two orphaned siblings cared for by their aunt.',
    story: 'Tendai and her younger brother lost both parents last year. Their aunt took them in, though she already supports two children of her own. This goal covers their school fees, books and a daily school meal for a full year.\n\nThe school head and a social worker verified the guardianship. Thank you — this goal has been fully funded.',
    updates: [{ title: 'Thank you from Tendai', body: 'We are so grateful. Tendai drew a picture for everyone who gave and wants to say thank you.', daysAgo: 2 }],
  },
  {
    name: 'Ana Pereira', gender: 'FEMALE', age: 38, country: 'BR', city: 'Recife', occupation: 'Street food seller', income: 'LOW', family: 4,
    category: 'FOOD', priority: 'MEDIUM', title: 'Rebuilding my food cart after a fire', goal: 520, pct: 49, state: 'ACTIVE',
    summary: 'A fire at the market destroyed my cart. A new one means I can feed my family again.',
    story: 'I have sold tapioca pancakes at the same corner for nine years. A fire at the market burned my cart and equipment, and with it our only source of income.\n\nThe market association has confirmed the fire and my stall registration. This covers a new cart, a gas stove and the first month of ingredients.',
  },
  {
    name: 'Priya Sharma', gender: 'FEMALE', age: 33, country: 'NP', city: 'Pokhara', occupation: 'Weaver', income: 'LOW', family: 3,
    category: 'EMERGENCY_RELIEF', priority: 'CRITICAL', title: 'Rebuilding after the landslide', goal: 1800, pct: 21, state: 'ACTIVE',
    summary: 'Our home was damaged in a landslide. We need safe shelter before the next rains.',
    story: 'A landslide cracked the walls of our house and swept away our loom shed. We are sleeping in a neighbour’s storeroom. The municipal office has marked our house unsafe.\n\nFunds cover repairs, a retaining wall and a replacement loom so I can work again. A ward officer has verified the damage.',
  },
  // Pending / needs-info applications for the auditor dashboard demo
  {
    name: 'Daniel Mwangi', gender: 'MALE', age: 44, country: 'KE', city: 'Nakuru', occupation: 'Boda-boda rider', income: 'LOW', family: 5,
    category: 'MEDICAL', priority: 'HIGH', title: 'Surgery for my son’s clubfoot', goal: 900, pct: 0, state: 'PENDING',
    summary: 'Corrective surgery for my seven-year-old son at a children’s hospital.',
    story: 'My son Kevin was born with clubfoot and early treatment was interrupted when we could not afford the follow-up. He is now seven and the doctors say surgery is the best option. The hospital has given us a quotation and a surgery date.\n\nI am submitting the referral letter, the quotation and my identification. I am happy for the auditors to visit or call the hospital to confirm.',
  },
  {
    name: 'Esther Nambi', gender: 'FEMALE', age: 39, country: 'UG', city: 'Kampala', occupation: 'Cook', income: 'LOW', family: 4,
    category: 'RENT', priority: 'MEDIUM', title: 'Rent arrears after I lost my job', goal: 450, pct: 0, state: 'PENDING',
    summary: 'Three months behind on rent after the restaurant I worked at closed.',
    story: 'The restaurant where I cooked closed suddenly in August. I have since found part-time work, but I am three months behind on rent and my landlord has been patient so far. I would like to clear the arrears before he loses patience.\n\nI have the tenancy agreement, the landlord’s statement of arrears and a letter from my former employer.',
  },
  {
    name: 'Ibrahim Yusuf', gender: 'MALE', age: 31, country: 'NG', city: 'Kano', occupation: 'Trader', income: 'LOW', family: 3,
    category: 'SMALL_BUSINESS', priority: 'LOW', title: 'Stock for my provisions shop', goal: 3000, pct: 0, state: 'PENDING',
    summary: 'Restocking my shop after a robbery.',
    story: 'My shop was robbed. I need stock to reopen. I have photos of the shop. Please help me, I am a good man and trader for many years in this market and everyone knows me here.',
  },
  {
    name: 'Mary Achieng', gender: 'FEMALE', age: 36, country: 'KE', city: 'Mombasa', occupation: 'Hair stylist', income: 'LOW', family: 4,
    category: 'DISABILITY_SUPPORT', priority: 'MEDIUM', title: 'Hearing aids for my son', goal: 780, pct: 0, state: 'NEEDS_INFO',
    summary: 'Two digital hearing aids for my eight-year-old son who is deaf in both ears.',
    story: 'My son Collins has had hearing loss since a childhood illness and struggles at school without hearing aids. An audiologist assessed him and recommended two digital aids with moulds and a year of follow-up.\n\nI have attached the audiology report and the supplier’s quotation. I am still collecting a letter from the school.',
  },
];

const DONORS = [
  ['Sarah Mitchell', 'GB'], ['Kenji Tanaka', 'JP'], ['Lukas Weber', 'DE'], ['Priya Nair', 'IN'], ['Carlos Mendes', 'BR'],
  ['Emma Johansson', 'SE'], ['Noah Williams', 'US'], ['Fatima Al-Sayed', 'AE'], ['Chidi Okafor', 'NG'], ['Mia Rossi', 'IT'],
  ['Liam O’Connor', 'IE'], ['Aisha Bello', 'NG'], ['Hannah Cohen', 'CA'], ['Tom Becker', 'AU'], ['Zanele Dlamini', 'ZA'],
] as const;
const MESSAGES = [
  'Wishing you and your family strength.', 'Sending love from afar.', 'Every bit helps. Stay hopeful!', 'Thank you for sharing your story.',
  'Hope this brings a little relief.', 'Praying for a speedy recovery.', 'Proud of you. Keep going!', null, null, null,
];
const CURRENCIES: [string, number][] = [
  ['USD', 1], ['EUR', 1.087], ['GBP', 1.266], ['KES', 1 / 129], ['CAD', 0.735], ['AUD', 0.658], ['JPY', 1 / 150], ['CHF', 1.136], ['AED', 0.2723], ['ZAR', 0.054], ['INR', 1 / 83], ['NGN', 1 / 1500],
];
const GATEWAYS: Gateway[] = ['STRIPE', 'PAYPAL', 'MPESA', 'FLUTTERWAVE', 'CARD', 'APPLE_PAY', 'GOOGLE_PAY', 'WISE'];

// Deterministic PRNG so the demo looks the same every time
let _s = 20261028;
const rnd = () => ((_s = (_s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;

/** Minimal valid PDF carrying a visible "DEMO" label. `salt` makes the file hash unique. */
function demoPdf(label: string, salt: string): Buffer {
  const text = `DEMO DOCUMENT - ${label} (fictional)`;
  const content = `BT /F1 20 Tf 60 720 Td (${text.replace(/[()\\]/g, '')}) Tj ET`;
  const pad = ' '.repeat(16_000); // above the "tiny file" heuristic threshold
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n% ${salt}\n%${pad}\n`;
  return Buffer.from(out, 'latin1');
}

async function main() {
  fs.mkdirSync(ART_DIR, { recursive: true });
  console.log('🧹 Clearing existing data…');
  const tables = ['"AuditLog"', '"Notification"', '"FraudAlert"', '"Report"', '"Comment"', '"NeedUpdate"', '"VerificationReview"', '"Donation"', '"Document"', '"PaymentMethodConfig"', '"Need"', '"Beneficiary"', '"RefreshToken"', '"User"', '"NewsletterSubscriber"', '"ContactMessage"'];
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);

  console.log('👤 Staff accounts…');
  const staffHash = await bcrypt.hash('Auditor#LumaBridge1', 12);
  const adminHash = await bcrypt.hash('Admin#LumaBridge1', 12);
  const auditor = await prisma.user.create({
    data: { email: 'auditor@lumabridge.dev', passwordHash: staffHash, role: 'AUDITOR', twoFactorEnabled: true, twoFactorSecret: encrypt(DEV_TOTP_SECRET) },
  });
  await prisma.user.create({
    data: { email: 'admin@lumabridge.dev', passwordHash: adminHash, role: 'ADMIN', twoFactorEnabled: true, twoFactorSecret: encrypt(DEV_TOTP_SECRET) },
  });

  const userHash = await bcrypt.hash('Beneficiary#1234', 10);
  const now = Date.now();
  const day = 86_400_000;
  let n = 0;
  const duplicateDoc = demoPdf('Identity card scan', 'shared-file-for-fraud-demo');

  for (const d of DEMOS) {
    n++;
    const slugBase = d.name.toLowerCase().split(' ')[0];
    const photo = `/seed/avatar-${n}.svg`;
    const cover = `/seed/cover-${n}.svg`;
    fs.writeFileSync(path.join(ART_DIR, `avatar-${n}.svg`), avatarSvg(d.name, d.category, n));
    fs.writeFileSync(path.join(ART_DIR, `cover-${n}.svg`), coverSvg(d.category, n));

    const live = d.state === 'ACTIVE' || d.state === 'FUNDED';
    const verificationStatus = live ? 'APPROVED' : d.state === 'PENDING' ? 'PENDING' : 'NEEDS_INFO';
    const phone = `+999 000 ${String(1000 + n)}`; // clearly fake numbers
    const nationalId = `DEMO-${String(100000 + n * 7919)}`;
    const dob = new Date(now - d.age * 365.25 * day - rnd() * 200 * day);
    const approvedAt = new Date(now - (5 + Math.floor(rnd() * 50)) * day);

    // Two pending applicants share a signup IP and an identical identity file → demonstrates fraud scoring
    const suspicious = d.name === 'Ibrahim Yusuf' || d.name === 'Esther Nambi';

    const user = await prisma.user.create({
      data: {
        email: `${slugBase}.${n}@demo.lumabridge.dev`,
        passwordHash: userHash,
        role: 'BENEFICIARY',
        signupIp: suspicious ? '203.0.113.77' : `198.51.100.${n}`,
        lastIp: `198.51.100.${n}`,
        beneficiary: {
          create: {
            fullName: d.name,
            nationalIdEnc: encrypt(nationalId),
            nationalIdFingerprint: fingerprint(nationalId),
            phone,
            phoneFingerprint: fingerprint(phone),
            gender: d.gender,
            dateOfBirth: dob,
            country: d.country,
            city: d.city,
            address: `Demo address ${n}, ${d.city}`,
            photoUrl: photo,
            incomeLevel: d.income,
            occupation: d.occupation,
            familySize: d.family,
            emergencyContactName: `Demo contact ${n}`,
            emergencyContactPhone: `+999 111 ${String(2000 + n)}`,
            about: d.story.slice(0, 300),
            verificationStatus,
            verificationId: live ? makeVerificationId(d.country) : null,
            verifiedAt: live ? approvedAt : null,
            lastAuditAt: live ? approvedAt : null,
            profileCompletion: live ? 100 : 80,
          },
        },
      },
      include: { beneficiary: true },
    });
    const b = user.beneficiary!;

    // Payment methods (encrypted details; only masked hint is public)
    const methods: [string, string, Record<string, string>][] =
      d.country === 'KE' || d.country === 'UG'
        ? [['MPESA', 'M-Pesa', { phone: `0712 34${String(5000 + n)}` }], ['MOBILE_MONEY', 'Mobile money', { phone: `0700 11${String(2000 + n)}` }]]
        : d.country === 'NG' || d.country === 'GH'
          ? [['BANK_ACCOUNT', 'Bank account', { accountNumber: `00${String(31000000 + n * 13)}`, bank: 'Demo Bank' }], ['MOBILE_MONEY', 'Mobile money', { phone: `0801 55${String(1000 + n)}` }]]
          : [['PAYPAL', 'PayPal', { email: `${slugBase}.${n}@example.com` }], ['WISE', 'Wise', { accountNumber: `BE${String(6800000000 + n * 91)}` }]];
    for (const [type, label, details] of methods) {
      const hint = Object.values(details)[0]!.replace(/\s/g, '');
      await prisma.paymentMethodConfig.create({
        data: { beneficiaryId: b.id, type: type as never, label, detailsEnc: encrypt(JSON.stringify(details)), maskedHint: '••••' + hint.slice(-4) },
      });
    }

    const need = await prisma.need.create({
      data: {
        beneficiaryId: b.id,
        slug: uniqueSlug(d.title),
        title: d.title,
        summary: d.summary,
        story: d.story,
        category: d.category,
        priority: d.priority,
        status: d.state,
        goalUsd: d.goal,
        coverUrl: cover,
        images: [cover],
        approvedAt: live ? approvedAt : null,
        deadline: new Date(now + (20 + Math.floor(rnd() * 60)) * day),
        createdAt: new Date(approvedAt.getTime() - 3 * day),
      },
    });

    // Documents (private)
    const docKinds: [string, string][] = [
      ['IDENTITY', 'Identity card scan'],
      [d.category === 'MEDICAL' ? 'MEDICAL_REPORT' : d.category === 'EDUCATION' ? 'SCHOOL_LETTER' : d.category === 'RENT' ? 'RENT_NOTICE' : 'REFERENCE_LETTER', 'Supporting letter'],
      ['COMMUNITY_LEADER_LETTER', 'Community leader letter'],
    ];
    for (const [kind, label] of docKinds) {
      const useDup = suspicious && kind === 'IDENTITY';
      const buf = useDup ? duplicateDoc : demoPdf(label, `${d.name}-${kind}`);
      const stored = await storePrivateDocument(buf, b.id);
      const verdict = validateDocument(buf, 'application/pdf');
      const weak = d.name === 'Ibrahim Yusuf' && kind !== 'IDENTITY';
      await prisma.document.create({
        data: {
          beneficiaryId: b.id, needId: kind === 'IDENTITY' ? null : need.id, kind: kind as never, url: stored.url, publicId: stored.publicId,
          mime: 'application/pdf', sizeBytes: buf.length, sha256: sha256(buf),
          aiScore: weak ? 0.34 : verdict.score, aiNotes: weak ? 'Metadata references editing software (Canva). Check the original document.' : verdict.notes.join(' '),
          verified: live,
        },
      });
    }

    // Approval history for live profiles
    if (live) {
      await prisma.verificationReview.create({
        data: {
          beneficiaryId: b.id, needId: need.id, auditorId: auditor.id, decision: 'APPROVE', createdAt: approvedAt,
          notes: 'Identity matched, documents confirmed with the issuing office, location verified by a community leader.',
          checklist: { identity: true, documents: true, location: true, legitimacy: true, income: true, references: true, videoInterview: false, fieldVisit: false, governmentVerified: false, ngoVerified: d.category === 'REFUGEES', communityLeader: true, employer: false, hospital: d.category === 'MEDICAL', school: d.category === 'EDUCATION' || d.category === 'ORPHANS' },
        },
      });
    }
    if (d.state === 'NEEDS_INFO') {
      await prisma.verificationReview.create({
        data: {
          beneficiaryId: b.id, needId: need.id, auditorId: auditor.id, decision: 'REQUEST_INFO',
          notes: 'Please upload the letter from your son’s school confirming enrolment, and a clearer copy of the audiology report.',
          checklist: { identity: true, documents: false, location: true, legitimacy: false, income: true, references: false, videoInterview: false, fieldVisit: false, governmentVerified: false, ngoVerified: false, communityLeader: false, employer: false, hospital: false, school: false },
        },
      });
      await prisma.notification.create({ data: { userId: user.id, title: 'More information needed', body: 'Auditors need a little more to verify your request: please upload the school letter and a clearer audiology report.' } });
    }

    // Timeline updates
    for (const u of d.updates ?? []) {
      await prisma.needUpdate.create({ data: { needId: need.id, title: u.title, body: u.body, createdAt: new Date(now - u.daysAgo * day) } });
    }

    // Donations that sum to roughly the target percentage
    if (live && d.pct > 0) {
      const target = (d.goal * d.pct) / 100;
      let raised = 0;
      let count = 0;
      while (raised < target - 1) {
        const [cur, perUsd] = pick(CURRENCIES);
        const usdAim = Math.min(target - raised, pick([10, 15, 20, 25, 50, 50, 100, 150]) * (0.8 + rnd() * 0.5));
        const amount = Math.max(1, Math.round(usdAim / perUsd / (cur === 'JPY' || cur === 'KES' || cur === 'NGN' || cur === 'INR' ? 1 : 1)));
        const amountUsd = Math.round(amount * perUsd * 100) / 100;
        const anonymous = rnd() < 0.45;
        const [donor, country] = pick(DONORS);
        const when = new Date(now - Math.floor(rnd() * 55 * day) - Math.floor(rnd() * day));
        await prisma.donation.create({
          data: {
            needId: need.id, amount, currency: cur, amountUsd, fxRate: perUsd, feeUsd: 0, gateway: pick(GATEWAYS),
            gatewayRef: `seed_${need.id}_${count}`, status: 'SUCCEEDED', anonymous,
            donorName: anonymous ? null : donor, donorCountry: anonymous ? null : country, message: anonymous ? null : pick(MESSAGES),
            receiptToken: randomToken(18), createdAt: when, confirmedAt: when,
            thankYouNote: count === 0 && d.updates ? 'Thank you from the bottom of my heart.' : null,
          },
        });
        raised += amountUsd;
        count++;
      }
      await prisma.need.update({ where: { id: need.id }, data: { raisedUsd: Math.round(raised * 100) / 100, donationCount: count } });
    }
    if (d.state === 'FUNDED') {
      const donations = await prisma.donation.aggregate({ where: { needId: need.id }, _sum: { amountUsd: true }, _count: true });
      await prisma.need.update({ where: { id: need.id }, data: { raisedUsd: donations._sum.amountUsd ?? 0, donationCount: donations._count } });
    }

    // Comments on a couple of live campaigns
    if (live && n % 3 === 1) {
      await prisma.comment.createMany({
        data: [
          { needId: need.id, authorName: pick(DONORS)[0], body: 'Wishing you every success. Thank you for being open about your situation.', createdAt: new Date(now - 2 * day) },
          { needId: need.id, authorName: pick(DONORS)[0], body: 'Shared with friends and family. Stay strong!', createdAt: new Date(now - 1 * day) },
        ],
      });
    }

    await scoreBeneficiary(b.id);
  }

  // A community report on one live campaign (shows up in the auditor dashboard)
  const reported = await prisma.need.findFirst({ where: { title: { startsWith: 'A new sewing machine' } } });
  if (reported) {
    await prisma.report.create({ data: { needId: reported.id, reason: 'FALSE_INFORMATION', details: 'Demo report: the shop address seems different from what I know of this neighbourhood.', reporterEmail: 'neighbour@example.com' } });
    await prisma.fraudAlert.create({
      data: { needId: reported.id, beneficiaryId: reported.beneficiaryId, type: 'COMMUNITY_REPORT', severity: 'LOW', score: 15, details: { note: 'Demo alert created from a community report.' } },
    });
  }

  await prisma.auditLog.create({ data: { actorId: auditor.id, action: 'seed.complete', entity: 'System', meta: { demo: true } } });

  const totals = await prisma.donation.aggregate({ _sum: { amountUsd: true }, _count: true });
  const code = authenticator.generate(DEV_TOTP_SECRET);
  console.log(`\n✅ Seeded ${DEMOS.length} demo campaigns and ${totals._count} donations ($${Number(totals._sum.amountUsd).toFixed(0)}).`);
  console.log('\nDemo logins (development only):');
  console.log('  Auditor      auditor@lumabridge.dev / Auditor#LumaBridge1');
  console.log('  Admin        admin@lumabridge.dev   / Admin#LumaBridge1');
  console.log('  Beneficiary  amina.1@demo.lumabridge.dev / Beneficiary#1234');
  console.log(`  Staff 2FA secret (add to any authenticator app): ${DEV_TOTP_SECRET}   (current code: ${code})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0); // the Redis client imported via lib/cache keeps the loop alive
  });
