import fs from 'node:fs';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireRole, requireStaff } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { badRequest, conflict, forbidden, notFound, wrap } from '../lib/errors';
import { passwordSchema, reviewSchema, suspendSchema } from '../schemas';
import { decrypt, makeVerificationId } from '../lib/crypto';
import { localPrivatePath, signedDocumentUrl } from '../lib/storage';
import { scoreBeneficiary } from '../lib/fraud';
import { audit, notify } from '../lib/audit';
import { cacheDel } from '../lib/cache';
import { confirmDonation } from '../services/donations';
import { displayName } from '../services/serializers';

export const staffRouter = Router();
staffRouter.use(...requireStaff);

const bust = () => Promise.all([cacheDel('stats:v1'), cacheDel('transparency:v1')]);

// ───────── Overview ─────────
staffRouter.get(
  '/overview',
  wrap(async (_req, res) => {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const [pending, needsInfo, alerts, criticalAlerts, reports, decidedToday, suspended] = await Promise.all([
      prisma.need.count({ where: { status: 'PENDING' } }),
      prisma.need.count({ where: { status: 'NEEDS_INFO' } }),
      prisma.fraudAlert.count({ where: { resolved: false } }),
      prisma.fraudAlert.count({ where: { resolved: false, severity: { in: ['HIGH', 'CRITICAL'] } } }),
      prisma.report.count({ where: { status: { in: ['OPEN', 'REVIEWING'] } } }),
      prisma.verificationReview.count({ where: { createdAt: { gte: since } } }),
      prisma.user.count({ where: { status: { in: ['SUSPENDED', 'BANNED'] } } }),
    ]);
    res.json({ pending, needsInfo, alerts, criticalAlerts, reports, decidedToday, suspended });
  }),
);

// ───────── Review queue ─────────
staffRouter.get(
  '/queue',
  validate(
    z.object({
      status: z.enum(['PENDING', 'NEEDS_INFO', 'ACTIVE', 'REJECTED', 'SUSPENDED']).default('PENDING'),
      page: z.coerce.number().int().min(1).default(1),
    }),
    'query',
  ),
  wrap(async (req, res) => {
    const q = req.query as unknown as { status: 'PENDING' | 'NEEDS_INFO' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED'; page: number };
    const where: Prisma.NeedWhereInput = { status: q.status };
    const [total, rows] = await Promise.all([
      prisma.need.count({ where }),
      prisma.need.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { updatedAt: 'asc' }], // urgent first, then longest waiting
        skip: (q.page - 1) * 20,
        take: 20,
        include: {
          beneficiary: { select: { id: true, fullName: true, country: true, city: true, fraudScore: true, verificationStatus: true, documents: { select: { aiScore: true } } } },
          _count: { select: { reports: true } },
        },
      }),
    ]);
    res.json({
      total,
      items: rows.map((n) => ({
        needId: n.id, title: n.title, category: n.category, priority: n.priority, goalUsd: Number(n.goalUsd),
        submittedAt: n.updatedAt,
        applicant: { id: n.beneficiary.id, name: n.beneficiary.fullName, country: n.beneficiary.country, city: n.beneficiary.city },
        fraudScore: n.beneficiary.fraudScore,
        documentCount: n.beneficiary.documents.length,
        lowestDocScore: n.beneficiary.documents.reduce<number | null>((m, d) => (d.aiScore === null ? m : m === null ? d.aiScore : Math.min(m, d.aiScore)), null),
        reports: n._count.reports,
        returning: n.beneficiary.verificationStatus === 'APPROVED',
      })),
    });
  }),
);

// ───────── Application detail (PII access is audit-logged) ─────────
staffRouter.get(
  '/applications/:needId',
  wrap(async (req, res) => {
    const need = await prisma.need.findUnique({
      where: { id: String(req.params.needId) },
      include: {
        reports: { orderBy: { createdAt: 'desc' } },
        beneficiary: {
          include: {
            user: { select: { email: true, status: true, signupIp: true, lastIp: true, createdAt: true } },
            documents: { orderBy: { createdAt: 'desc' } },
            paymentMethods: true,
            reviews: { orderBy: { createdAt: 'desc' }, include: { auditor: { select: { email: true } } } },
            alerts: { orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });
    if (!need) throw notFound('Application not found');
    const b = need.beneficiary;

    const risk = await scoreBeneficiary(b.id);
    await audit({ actorId: req.user!.id, action: 'pii.view', entity: 'Beneficiary', entityId: b.id, ip: req.clientIp });

    // Cross-reference for the auditor: other profiles sharing the same hashed ID/phone/IP/contact.
    const related = await prisma.beneficiary.findMany({
      where: {
        id: { not: b.id },
        OR: [
          { nationalIdFingerprint: b.nationalIdFingerprint },
          { phoneFingerprint: b.phoneFingerprint },
          { emergencyContactPhone: b.emergencyContactPhone },
          ...(b.user.signupIp ? [{ user: { signupIp: b.user.signupIp } }] : []),
        ],
      },
      select: { id: true, fullName: true, verificationStatus: true, country: true },
      take: 10,
    });

    res.json({
      need: {
        id: need.id, title: need.title, summary: need.summary, story: need.story, category: need.category, priority: need.priority,
        status: need.status, goalUsd: Number(need.goalUsd), deadline: need.deadline, images: need.images, createdAt: need.createdAt,
      },
      applicant: {
        id: b.id, fullName: b.fullName, nationalId: decrypt(b.nationalIdEnc), phone: b.phone, email: b.user.email,
        gender: b.gender, dateOfBirth: b.dateOfBirth, country: b.country, city: b.city, address: b.address, photoUrl: b.photoUrl,
        incomeLevel: b.incomeLevel, occupation: b.occupation, familySize: b.familySize,
        emergencyContactName: b.emergencyContactName, emergencyContactPhone: b.emergencyContactPhone, about: b.about,
        verificationStatus: b.verificationStatus, verificationId: b.verificationId,
        accountStatus: b.user.status, signupIp: b.user.signupIp, lastIp: b.user.lastIp, joinedAt: b.user.createdAt,
      },
      documents: b.documents.map((d) => ({
        id: d.id, kind: d.kind, mime: d.mime, sizeBytes: d.sizeBytes, aiScore: d.aiScore, aiNotes: d.aiNotes, verified: d.verified,
        needId: d.needId, createdAt: d.createdAt,
      })),
      paymentMethods: b.paymentMethods.map((p) => ({
        id: p.id, type: p.type, label: p.label, maskedHint: p.maskedHint, details: JSON.parse(decrypt(p.detailsEnc)) as Record<string, string>,
      })),
      risk,
      alerts: b.alerts,
      reports: need.reports,
      related,
      history: b.reviews.map((r) => ({ id: r.id, decision: r.decision, notes: r.notes, checklist: r.checklist, auditor: r.auditor.email, createdAt: r.createdAt, needId: r.needId })),
    });
  }),
);

// ───────── Document viewer (short-lived access, logged) ─────────
staffRouter.get(
  '/documents/:id/file',
  wrap(async (req, res) => {
    const d = await prisma.document.findUnique({ where: { id: String(req.params.id) } });
    if (!d?.publicId) throw notFound('Document not found');
    await audit({ actorId: req.user!.id, action: 'document.view', entity: 'Document', entityId: d.id, ip: req.clientIp });

    const signed = signedDocumentUrl(d.publicId, d.mime);
    if (signed) return res.json({ url: signed, expiresInSeconds: 900 });

    const p = localPrivatePath(d.publicId);
    if (!p || !fs.existsSync(p)) throw notFound('File missing');
    res.setHeader('Content-Type', d.mime);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    fs.createReadStream(p).pipe(res);
  }),
);

// ───────── Decision ─────────
staffRouter.post(
  '/applications/:needId/review',
  validate(reviewSchema),
  wrap(async (req, res) => {
    const body = req.body as z.infer<typeof reviewSchema>;
    const need = await prisma.need.findUnique({ where: { id: String(req.params.needId) }, include: { beneficiary: true } });
    if (!need) throw notFound('Application not found');
    if (!['PENDING', 'NEEDS_INFO'].includes(need.status)) throw conflict('This application is not awaiting review.');
    const b = need.beneficiary;
    const alreadyVerified = b.verificationStatus === 'APPROVED';

    if (body.decision === 'APPROVE') {
      const c = body.checklist;
      const core = c.identity && c.documents && c.location && c.legitimacy && c.income;
      if (!core) throw badRequest('Complete the core checks (identity, documents, location, legitimacy, income) before approving.');

      const risk = await scoreBeneficiary(b.id);
      if (risk.score >= 80 && req.user!.role !== 'ADMIN') {
        throw forbidden('Critical risk score. An admin must review before approval.');
      }
      const openCritical = await prisma.fraudAlert.count({
        where: { beneficiaryId: b.id, resolved: false, severity: 'CRITICAL', type: { not: 'RISK_SCORE' } },
      });
      if (openCritical > 0) throw conflict('Resolve the open critical fraud alerts before approving.');
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.verificationReview.create({
        data: { beneficiaryId: b.id, needId: need.id, auditorId: req.user!.id, decision: body.decision, notes: body.notes, checklist: body.checklist },
      });

      if (body.decision === 'APPROVE') {
        await tx.beneficiary.update({
          where: { id: b.id },
          data: { verificationStatus: 'APPROVED', verifiedAt: b.verifiedAt ?? now, lastAuditAt: now, verificationId: b.verificationId ?? makeVerificationId(b.country) },
        });
        await tx.need.update({ where: { id: need.id }, data: { status: 'ACTIVE', approvedAt: now } });
        await tx.document.updateMany({ where: { beneficiaryId: b.id }, data: { verified: true } });
      } else if (body.decision === 'REJECT') {
        if (!alreadyVerified) await tx.beneficiary.update({ where: { id: b.id }, data: { verificationStatus: 'REJECTED', lastAuditAt: now } });
        await tx.need.update({ where: { id: need.id }, data: { status: 'REJECTED' } });
      } else {
        if (!alreadyVerified) await tx.beneficiary.update({ where: { id: b.id }, data: { verificationStatus: 'NEEDS_INFO', lastAuditAt: now } });
        await tx.need.update({ where: { id: need.id }, data: { status: 'NEEDS_INFO' } });
      }
    });

    await audit({ actorId: req.user!.id, action: `review.${body.decision.toLowerCase()}`, entity: 'Need', entityId: need.id, meta: { beneficiaryId: b.id }, ip: req.clientIp });
    const msg = {
      APPROVE: ['You are verified ✅', `Your request "${need.title}" is now live with a Verified badge. Thank you for your patience.`],
      REJECT: ['Application update', `We could not approve "${need.title}". Auditor note: ${body.notes}`],
      REQUEST_INFO: ['More information needed', `Auditors need a little more to verify "${need.title}": ${body.notes}`],
    }[body.decision];
    await notify(b.userId, msg[0]!, msg[1]!);
    await bust();
    res.json({ ok: true });
  }),
);

// ───────── Fraud alerts ─────────
staffRouter.get(
  '/alerts',
  validate(z.object({ resolved: z.enum(['true', 'false']).default('false') }), 'query'),
  wrap(async (req, res) => {
    const resolved = (req.query as { resolved?: string }).resolved === 'true';
    const items = await prisma.fraudAlert.findMany({
      where: { resolved },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 100,
      include: {
        beneficiary: { select: { id: true, fullName: true, country: true } },
        need: { select: { id: true, title: true } },
      },
    });
    res.json({ items: items.map((a) => ({ ...a, beneficiary: a.beneficiary ? { ...a.beneficiary, fullName: displayName(a.beneficiary.fullName) } : null })) });
  }),
);

staffRouter.post(
  '/alerts/:id/resolve',
  wrap(async (req, res) => {
    const r = await prisma.fraudAlert.updateMany({ where: { id: String(req.params.id), resolved: false }, data: { resolved: true, resolvedById: req.user!.id } });
    if (!r.count) throw notFound('Alert not found');
    await audit({ actorId: req.user!.id, action: 'alert.resolve', entity: 'FraudAlert', entityId: String(req.params.id), ip: req.clientIp });
    res.json({ ok: true });
  }),
);

// ───────── Community reports ─────────
staffRouter.get(
  '/reports',
  wrap(async (_req, res) => {
    const items = await prisma.report.findMany({
      where: { status: { in: ['OPEN', 'REVIEWING'] } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { need: { select: { id: true, title: true, slug: true } } },
    });
    res.json({ items });
  }),
);

staffRouter.post(
  '/reports/:id',
  validate(z.object({ status: z.enum(['REVIEWING', 'DISMISSED', 'ACTIONED']) })),
  wrap(async (req, res) => {
    const r = await prisma.report.updateMany({ where: { id: String(req.params.id) }, data: { status: req.body.status } });
    if (!r.count) throw notFound('Report not found');
    await audit({ actorId: req.user!.id, action: `report.${String(req.body.status).toLowerCase()}`, entity: 'Report', entityId: String(req.params.id), ip: req.clientIp });
    res.json({ ok: true });
  }),
);

// ───────── Suspension / ban ─────────
staffRouter.post(
  '/beneficiaries/:id/account',
  validate(suspendSchema),
  wrap(async (req, res) => {
    const body = req.body as z.infer<typeof suspendSchema>;
    if (body.action === 'BAN' && req.user!.role !== 'ADMIN') throw forbidden('Only admins can permanently ban an account.');

    const b = await prisma.beneficiary.findUnique({ where: { id: String(req.params.id) } });
    if (!b) throw notFound('Profile not found');

    if (body.action === 'REINSTATE') {
      await prisma.$transaction([
        prisma.user.update({ where: { id: b.userId }, data: { status: 'ACTIVE', suspendedUntil: null, statusReason: null } }),
        prisma.need.updateMany({ where: { beneficiaryId: b.id, status: 'SUSPENDED' }, data: { status: 'ACTIVE' } }),
      ]);
    } else {
      const suspend = body.action === 'SUSPEND';
      await prisma.$transaction([
        prisma.user.update({
          where: { id: b.userId },
          data: {
            status: suspend ? 'SUSPENDED' : 'BANNED',
            statusReason: body.reason,
            suspendedUntil: suspend && body.days ? new Date(Date.now() + body.days * 86_400_000) : null,
          },
        }),
        prisma.need.updateMany({ where: { beneficiaryId: b.id, status: 'ACTIVE' }, data: { status: suspend ? 'SUSPENDED' : 'CLOSED' } }),
        prisma.refreshToken.updateMany({ where: { userId: b.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      ]);
    }
    await audit({ actorId: req.user!.id, action: `account.${body.action.toLowerCase()}`, entity: 'Beneficiary', entityId: b.id, meta: { reason: body.reason, days: body.days }, ip: req.clientIp });
    await bust();
    res.json({ ok: true });
  }),
);

// ───────── Activity log ─────────
staffRouter.get(
  '/audit-log',
  validate(z.object({ page: z.coerce.number().int().min(1).default(1), entity: z.string().max(40).optional(), action: z.string().max(60).optional() }), 'query'),
  wrap(async (req, res) => {
    const q = req.query as unknown as { page: number; entity?: string; action?: string };
    const where: Prisma.AuditLogWhereInput = {
      ...(q.entity ? { entity: q.entity } : {}),
      ...(q.action ? { action: { startsWith: q.action } } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * 50, take: 50, include: { actor: { select: { email: true, role: true } } } }),
    ]);
    res.json({ total, items: rows.map((r) => ({ id: r.id, action: r.action, entity: r.entity, entityId: r.entityId, meta: r.meta, ip: r.ip, createdAt: r.createdAt, actor: r.actor })) });
  }),
);

// ───────── Admin-only ─────────
staffRouter.post(
  '/donations/:id/confirm',
  requireRole('ADMIN'),
  validate(z.object({ note: z.string().trim().min(5).max(300) })),
  wrap(async (req, res) => {
    const d = await prisma.donation.findUnique({ where: { id: String(req.params.id) } });
    if (!d) throw notFound('Donation not found');
    if (d.gateway !== 'WISE') throw badRequest('Only manual (Wise) transfers can be confirmed by hand.');
    const ok = await confirmDonation(d.id);
    await audit({ actorId: req.user!.id, action: 'donation.manual_confirm', entity: 'Donation', entityId: d.id, meta: { note: req.body.note }, ip: req.clientIp });
    await bust();
    res.json({ ok });
  }),
);

staffRouter.post(
  '/auditors',
  requireRole('ADMIN'),
  validate(z.object({ email: z.string().trim().toLowerCase().email(), password: passwordSchema })),
  wrap(async (req, res) => {
    const exists = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (exists) throw conflict('That email is already registered.');
    const u = await prisma.user.create({
      data: { email: req.body.email, passwordHash: await bcrypt.hash(req.body.password, 12), role: 'AUDITOR' },
    });
    await audit({ actorId: req.user!.id, action: 'auditor.create', entity: 'User', entityId: u.id, ip: req.clientIp });
    res.status(201).json({ id: u.id, email: u.email });
  }),
);
