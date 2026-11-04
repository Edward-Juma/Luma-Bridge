import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { badRequest, conflict, forbidden, notFound, wrap } from '../lib/errors';
import { uploadLimiter } from '../middleware/security';
import {
  DOCUMENT_KINDS, needCreateSchema, needUpdateSchema, paymentMethodSchema, updatePostSchema,
} from '../schemas';
import { decrypt, encrypt, maskTail, sha256 } from '../lib/crypto';
import { storePrivateDocument, storePublicImage } from '../lib/storage';
import { validateDocument } from '../lib/documentValidator';
import { scoreBeneficiary } from '../lib/fraud';
import { audit, notify } from '../lib/audit';
import { uniqueSlug } from '../lib/slug';
import { refreshCompletion } from '../services/profile';
import { publicDonation } from '../services/donations';

export const meRouter = Router();
meRouter.use(requireAuth, requireRole('BENEFICIARY'));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } });

async function myBeneficiary(userId: string) {
  const b = await prisma.beneficiary.findUnique({ where: { userId } });
  if (!b) throw notFound('Profile not found');
  return b;
}

/** Fields that may be changed while a profile is live. Identity fields are locked once submitted. */
const profilePatch = z
  .object({
    city: z.string().trim().min(1).max(100),
    address: z.string().trim().max(300),
    occupation: z.string().trim().min(1).max(120),
    incomeLevel: z.enum(['NONE', 'VERY_LOW', 'LOW', 'LOWER_MIDDLE', 'MIDDLE']),
    familySize: z.coerce.number().int().min(1).max(40),
    emergencyContactName: z.string().trim().min(2).max(120),
    emergencyContactPhone: z.string().trim().regex(/^\+?[0-9\s\-()]{7,20}$/),
    about: z.string().trim().min(30).max(3000),
  })
  .partial();

// ───────── Dashboard / profile ─────────
meRouter.get(
  '/dashboard',
  wrap(async (req, res) => {
    const b = await prisma.beneficiary.findUnique({
      where: { userId: req.user!.id },
      include: {
        needs: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' }, select: { id: true, kind: true, mime: true, sizeBytes: true, createdAt: true, verified: true, needId: true } },
        paymentMethods: { select: { id: true, type: true, label: true, maskedHint: true, display: true } },
        reviews: { orderBy: { createdAt: 'desc' }, take: 1, select: { decision: true, notes: true, createdAt: true } },
      },
    });
    if (!b) throw notFound('Profile not found');

    const needIds = b.needs.map((n) => n.id);
    const [donations, unread] = await Promise.all([
      prisma.donation.findMany({
        where: { needId: { in: needIds }, status: 'SUCCEEDED' },
        orderBy: { confirmedAt: 'desc' },
        take: 50,
        include: { need: { select: { title: true } } },
      }),
      prisma.notification.count({ where: { userId: req.user!.id, read: false } }),
    ]);

    const lastReview = b.reviews[0];
    res.json({
      profile: {
        id: b.id,
        fullName: b.fullName,
        nationalIdMasked: maskTail(decrypt(b.nationalIdEnc)),
        phone: b.phone,
        country: b.country,
        city: b.city,
        address: b.address,
        photoUrl: b.photoUrl,
        occupation: b.occupation,
        incomeLevel: b.incomeLevel,
        familySize: b.familySize,
        emergencyContactName: b.emergencyContactName,
        emergencyContactPhone: b.emergencyContactPhone,
        about: b.about,
        verificationStatus: b.verificationStatus,
        verificationId: b.verificationId,
        verifiedAt: b.verifiedAt,
        profileCompletion: b.profileCompletion,
      },
      // Only expose auditor feedback when they asked for more info or declined; never internal scoring.
      feedback:
        lastReview && (lastReview.decision === 'REQUEST_INFO' || lastReview.decision === 'REJECT')
          ? { decision: lastReview.decision, notes: lastReview.notes, at: lastReview.createdAt }
          : null,
      needs: b.needs.map((n) => ({
        id: n.id, slug: n.slug, title: n.title, summary: n.summary, story: n.story, category: n.category,
        priority: n.priority, status: n.status, goalUsd: Number(n.goalUsd), raisedUsd: Number(n.raisedUsd),
        donationCount: n.donationCount, deadline: n.deadline, images: n.images, coverUrl: n.coverUrl, createdAt: n.createdAt,
      })),
      documents: b.documents,
      paymentMethods: b.paymentMethods,
      donations: donations.map((d) => ({
        ...publicDonation(d),
        // The beneficiary sees who gave only when the donor chose to be public.
        needTitle: d.need.title,
        thankYouNote: d.thankYouNote,
        createdAt: d.confirmedAt ?? d.createdAt,
      })),
      remainingUsd: b.needs
        .filter((n) => n.status === 'ACTIVE')
        .reduce((s, n) => s + Math.max(0, Number(n.goalUsd) - Number(n.raisedUsd)), 0),
      unreadNotifications: unread,
    });
  }),
);

meRouter.patch(
  '/profile',
  validate(profilePatch),
  wrap(async (req, res) => {
    const b = await myBeneficiary(req.user!.id);
    if (b.verificationStatus === 'PENDING') throw conflict('Your profile is under review. You can edit it again if auditors request changes.');
    await prisma.beneficiary.update({ where: { id: b.id }, data: req.body });
    await audit({ actorId: req.user!.id, action: 'profile.update', entity: 'Beneficiary', entityId: b.id, ip: req.clientIp });
    await scoreBeneficiary(b.id);
    res.json({ ok: true, completion: await refreshCompletion(b.id) });
  }),
);

// ───────── Uploads ─────────
meRouter.post(
  '/photo',
  uploadLimiter,
  upload.single('file'),
  wrap(async (req, res) => {
    if (!req.file) throw badRequest('Choose an image to upload.');
    const b = await myBeneficiary(req.user!.id);
    const stored = await storePublicImage(req.file.buffer, 'profiles');
    await prisma.beneficiary.update({ where: { id: b.id }, data: { photoUrl: stored.url } });
    await refreshCompletion(b.id);
    res.json({ url: stored.url });
  }),
);

meRouter.post(
  '/documents',
  uploadLimiter,
  upload.single('file'),
  wrap(async (req, res) => {
    if (!req.file) throw badRequest('Choose a file to upload.');
    const kind = z.enum(DOCUMENT_KINDS).safeParse(req.body.kind);
    if (!kind.success) throw badRequest('Select the document type.');
    const b = await myBeneficiary(req.user!.id);

    const count = await prisma.document.count({ where: { beneficiaryId: b.id } });
    if (count >= 25) throw conflict('You have reached the document limit. Remove one before adding another.');

    let needId: string | null = null;
    if (req.body.needId) {
      const n = await prisma.need.findFirst({ where: { id: String(req.body.needId), beneficiaryId: b.id }, select: { id: true } });
      if (!n) throw notFound('Need not found');
      needId = n.id;
    }

    const verdict = validateDocument(req.file.buffer, req.file.mimetype);
    const stored = await storePrivateDocument(req.file.buffer, b.id);
    const doc = await prisma.document.create({
      data: {
        beneficiaryId: b.id, needId, kind: kind.data, url: stored.url, publicId: stored.publicId, mime: stored.mime,
        sizeBytes: req.file.size, sha256: sha256(req.file.buffer), aiScore: verdict.score, aiNotes: verdict.notes.join(' '),
      },
      select: { id: true, kind: true, mime: true, sizeBytes: true, createdAt: true },
    });
    await scoreBeneficiary(b.id);
    await refreshCompletion(b.id);
    await audit({ actorId: req.user!.id, action: 'document.upload', entity: 'Document', entityId: doc.id, ip: req.clientIp });
    res.status(201).json(doc); // the AI score is deliberately NOT returned to the applicant
  }),
);

meRouter.delete(
  '/documents/:id',
  wrap(async (req, res) => {
    const b = await myBeneficiary(req.user!.id);
    if (b.verificationStatus === 'PENDING') throw conflict('Documents are locked while your application is under review.');
    const r = await prisma.document.deleteMany({ where: { id: String(req.params.id), beneficiaryId: b.id } });
    if (!r.count) throw notFound('Document not found');
    await refreshCompletion(b.id);
    res.json({ ok: true });
  }),
);

// ───────── Payment methods ─────────
function hintFor(details: Record<string, string>): string {
  const pick =
    details.accountNumber ?? details.phone ?? details.address ?? details.email ?? details.handle ?? Object.values(details)[0] ?? '';
  return maskTail(pick, 4);
}

meRouter.post(
  '/payment-methods',
  validate(paymentMethodSchema),
  wrap(async (req, res) => {
    const b = await myBeneficiary(req.user!.id);
    const n = await prisma.paymentMethodConfig.count({ where: { beneficiaryId: b.id } });
    if (n >= 10) throw conflict('You can add up to 10 payment methods.');
    const { type, label, details, display } = req.body as z.infer<typeof paymentMethodSchema>;
    const pm = await prisma.paymentMethodConfig.create({
      data: { beneficiaryId: b.id, type, label, display, detailsEnc: encrypt(JSON.stringify(details)), maskedHint: hintFor(details) },
      select: { id: true, type: true, label: true, maskedHint: true, display: true },
    });
    await refreshCompletion(b.id);
    await audit({ actorId: req.user!.id, action: 'payment_method.add', entity: 'PaymentMethodConfig', entityId: pm.id, ip: req.clientIp });
    res.status(201).json(pm);
  }),
);

meRouter.patch(
  '/payment-methods/:id',
  validate(z.object({ display: z.boolean() })),
  wrap(async (req, res) => {
    const b = await myBeneficiary(req.user!.id);
    const r = await prisma.paymentMethodConfig.updateMany({ where: { id: String(req.params.id), beneficiaryId: b.id }, data: { display: req.body.display } });
    if (!r.count) throw notFound('Payment method not found');
    res.json({ ok: true });
  }),
);

meRouter.delete(
  '/payment-methods/:id',
  wrap(async (req, res) => {
    const b = await myBeneficiary(req.user!.id);
    const r = await prisma.paymentMethodConfig.deleteMany({ where: { id: String(req.params.id), beneficiaryId: b.id } });
    if (!r.count) throw notFound('Payment method not found');
    await refreshCompletion(b.id);
    res.json({ ok: true });
  }),
);

// ───────── Needs ─────────
const EDITABLE = ['DRAFT', 'NEEDS_INFO', 'REJECTED'] as const;

async function ownNeed(userId: string, id: string) {
  const b = await myBeneficiary(userId);
  const n = await prisma.need.findFirst({ where: { id, beneficiaryId: b.id } });
  if (!n) throw notFound('Need not found');
  return { b, n };
}

meRouter.post(
  '/needs',
  validate(needCreateSchema),
  wrap(async (req, res) => {
    const b = await myBeneficiary(req.user!.id);
    const open = await prisma.need.count({ where: { beneficiaryId: b.id, status: { in: ['DRAFT', 'PENDING', 'NEEDS_INFO', 'ACTIVE'] } } });
    if (open >= 3) throw conflict('You can have up to 3 open requests at a time.');
    const d = req.body as z.infer<typeof needCreateSchema>;
    const need = await prisma.need.create({
      data: { ...d, goalUsd: new Prisma.Decimal(d.goalUsd), beneficiaryId: b.id, slug: uniqueSlug(d.title) },
    });
    await refreshCompletion(b.id);
    res.status(201).json({ id: need.id, slug: need.slug, status: need.status });
  }),
);

meRouter.patch(
  '/needs/:id',
  validate(needUpdateSchema),
  wrap(async (req, res) => {
    const { n } = await ownNeed(req.user!.id, String(req.params.id));
    if (!(EDITABLE as readonly string[]).includes(n.status)) {
      throw conflict('This request is under review or live. To protect donors, changes are made by posting an update instead.');
    }
    const d = req.body as z.infer<typeof needUpdateSchema>;
    await prisma.need.update({ where: { id: n.id }, data: { ...d, goalUsd: d.goalUsd !== undefined ? new Prisma.Decimal(d.goalUsd) : undefined } });
    res.json({ ok: true });
  }),
);

meRouter.post(
  '/needs/:id/images',
  uploadLimiter,
  upload.single('file'),
  wrap(async (req, res) => {
    if (!req.file) throw badRequest('Choose an image to upload.');
    const { n } = await ownNeed(req.user!.id, String(req.params.id));
    if (n.images.length >= 8) throw conflict('You can add up to 8 images.');
    const stored = await storePublicImage(req.file.buffer, 'needs');
    await prisma.need.update({
      where: { id: n.id },
      data: { images: { push: stored.url }, coverUrl: n.coverUrl ?? stored.url },
    });
    res.status(201).json({ url: stored.url });
  }),
);

meRouter.post(
  '/needs/:id/submit',
  wrap(async (req, res) => {
    const { b, n } = await ownNeed(req.user!.id, String(req.params.id));
    if (!(EDITABLE as readonly string[]).includes(n.status)) throw conflict('This request has already been submitted.');

    const [docs, methods] = await Promise.all([
      prisma.document.findMany({ where: { beneficiaryId: b.id }, select: { kind: true } }),
      prisma.paymentMethodConfig.count({ where: { beneficiaryId: b.id } }),
    ]);
    const missing: string[] = [];
    if (!docs.some((d) => d.kind === 'IDENTITY' || d.kind === 'GOVERNMENT_DOCUMENT')) missing.push('an identity document');
    if (docs.length < 2) missing.push('at least one supporting document (medical report, school letter, rent notice, reference…)');
    if (methods < 1) missing.push('at least one payment method');
    if (!b.photoUrl) missing.push('a profile photo');
    if (missing.length) throw badRequest(`Before submitting, please add: ${missing.join('; ')}.`, { missing });

    await prisma.$transaction([
      prisma.need.update({ where: { id: n.id }, data: { status: 'PENDING' } }),
      ...(b.verificationStatus !== 'APPROVED'
        ? [prisma.beneficiary.update({ where: { id: b.id }, data: { verificationStatus: 'PENDING' } })]
        : []),
    ]);
    await scoreBeneficiary(b.id);
    await refreshCompletion(b.id);
    await audit({ actorId: req.user!.id, action: 'need.submit', entity: 'Need', entityId: n.id, ip: req.clientIp });
    await notify(req.user!.id, 'Application received', 'Our auditors will review your request. We will notify you as soon as there is progress.');
    res.json({ ok: true, status: 'PENDING' });
  }),
);

// Timeline updates (only for live / funded campaigns)
meRouter.post(
  '/needs/:id/updates',
  validate(updatePostSchema),
  wrap(async (req, res) => {
    const { n } = await ownNeed(req.user!.id, String(req.params.id));
    if (n.status !== 'ACTIVE' && n.status !== 'FUNDED') throw forbidden('Updates can be posted once your campaign is live.');
    const u = await prisma.needUpdate.create({ data: { needId: n.id, title: req.body.title, body: req.body.body } });
    res.status(201).json({ id: u.id, createdAt: u.createdAt });
  }),
);

meRouter.post(
  '/needs/:id/close',
  wrap(async (req, res) => {
    const { n } = await ownNeed(req.user!.id, String(req.params.id));
    if (!['ACTIVE', 'FUNDED'].includes(n.status)) throw conflict('Only live campaigns can be closed.');
    await prisma.need.update({ where: { id: n.id }, data: { status: 'CLOSED' } });
    res.json({ ok: true });
  }),
);

// ───────── Donors & thanks ─────────
meRouter.post(
  '/donations/:id/thank',
  validate(z.object({ note: z.string().trim().min(2).max(300) })),
  wrap(async (req, res) => {
    const b = await myBeneficiary(req.user!.id);
    const r = await prisma.donation.updateMany({
      where: { id: String(req.params.id), status: 'SUCCEEDED', need: { beneficiaryId: b.id } },
      data: { thankYouNote: req.body.note },
    });
    if (!r.count) throw notFound('Donation not found');
    res.json({ ok: true });
  }),
);

// ───────── Notifications ─────────
meRouter.get(
  '/notifications',
  wrap(async (req, res) => {
    const items = await prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 50 });
    res.json({ items });
  }),
);

meRouter.post(
  '/notifications/read',
  wrap(async (req, res) => {
    await prisma.notification.updateMany({ where: { userId: req.user!.id, read: false }, data: { read: true } });
    res.json({ ok: true });
  }),
);
