import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db';
import { env } from '../env';
import { wrap, notFound, badRequest } from '../lib/errors';
import { validate } from '../middleware/validate';
import { commentSchema, contactSchema, needFeedQuery, newsletterSchema, reportSchema } from '../schemas';
import { publicWriteLimiter } from '../middleware/security';
import { publicDonation } from '../services/donations';
import { ageFrom, displayName, publicNeedCard } from '../services/serializers';
import { cacheGet, cacheSet } from '../lib/cache';
import { scoreBeneficiary } from '../lib/fraud';

export const publicRouter = Router();

const PUBLIC_NEED: Prisma.NeedWhereInput = {
  status: 'ACTIVE',
  beneficiary: { verificationStatus: 'APPROVED', user: { status: 'ACTIVE' } },
};

const cardSelect = {
  beneficiary: {
    select: {
      fullName: true, country: true, city: true, dateOfBirth: true, gender: true,
      photoUrl: true, verificationId: true, verifiedAt: true, lastAuditAt: true,
    },
  },
} as const;

// ───────── Platform statistics (cached 60s) ─────────
publicRouter.get(
  '/stats',
  wrap(async (_req, res) => {
    const cached = await cacheGet('stats:v1');
    if (cached) return res.json(cached);

    const [raised, donations, active, families, countries] = await Promise.all([
      prisma.donation.aggregate({ where: { status: 'SUCCEEDED' }, _sum: { amountUsd: true, feeUsd: true } }),
      prisma.donation.count({ where: { status: 'SUCCEEDED' } }),
      prisma.need.count({ where: PUBLIC_NEED }),
      prisma.beneficiary.count({ where: { verificationStatus: 'APPROVED' } }),
      prisma.beneficiary.groupBy({ by: ['country'], where: { verificationStatus: 'APPROVED' } }),
    ]);
    const out = {
      totalRaisedUsd: Number(raised._sum.amountUsd ?? 0),
      successfulDonations: donations,
      activeCampaigns: active,
      verifiedFamilies: families,
      countries: countries.length,
    };
    await cacheSet('stats:v1', out, 60);
    res.json(out);
  }),
);

// ───────── Live donation ticker ─────────
publicRouter.get(
  '/ticker',
  wrap(async (_req, res) => {
    const rows = await prisma.donation.findMany({
      where: { status: 'SUCCEEDED' },
      orderBy: { confirmedAt: 'desc' },
      take: 12,
      include: { need: { select: { title: true, slug: true, beneficiary: { select: { fullName: true, country: true } } } } },
    });
    res.json({
      items: rows.map((d) => ({
        ...publicDonation(d),
        createdAt: d.confirmedAt ?? d.createdAt,
        need: { title: d.need.title, slug: d.need.slug, name: displayName(d.need.beneficiary.fullName), country: d.need.beneficiary.country },
      })),
    });
  }),
);

// ───────── Feed with advanced filtering ─────────
publicRouter.get(
  '/needs',
  validate(needFeedQuery, 'query'),
  wrap(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof needFeedQuery>;
    const benFilter: Prisma.BeneficiaryWhereInput = { verificationStatus: 'APPROVED', user: { status: 'ACTIVE' } };
    if (q.country) benFilter.country = q.country;
    if (q.city) benFilter.city = { contains: q.city, mode: 'insensitive' };
    if (q.gender) benFilter.gender = q.gender;
    if (q.minAge !== undefined || q.maxAge !== undefined) {
      const now = new Date();
      const dob: Prisma.DateTimeFilter = {};
      // older than minAge ⇒ born before (now - minAge); younger than maxAge ⇒ born after (now - maxAge - 1y)
      if (q.minAge !== undefined) dob.lte = new Date(now.getFullYear() - q.minAge, now.getMonth(), now.getDate());
      if (q.maxAge !== undefined) dob.gt = new Date(now.getFullYear() - q.maxAge - 1, now.getMonth(), now.getDate());
      benFilter.dateOfBirth = dob;
    }

    const where: Prisma.NeedWhereInput = { status: 'ACTIVE', beneficiary: benFilter };
    if (q.category) where.category = q.category;
    if (q.urgency) where.priority = q.urgency;
    if (q.q) {
      where.OR = [
        { title: { contains: q.q, mode: 'insensitive' } },
        { summary: { contains: q.q, mode: 'insensitive' } },
        { beneficiary: { city: { contains: q.q, mode: 'insensitive' } } },
      ];
    }

    const skip = (q.page - 1) * q.pageSize;
    const total = await prisma.need.count({ where });

    let rows;
    if (q.sort === 'nearly_funded') {
      // Ratio ordering isn't expressible in Prisma; rank ids in memory (bounded) then page.
      const ids = await prisma.need.findMany({ where, select: { id: true, goalUsd: true, raisedUsd: true }, take: 3000 });
      const ranked = ids
        .map((n) => ({ id: n.id, r: Number(n.goalUsd) > 0 ? Number(n.raisedUsd) / Number(n.goalUsd) : 0 }))
        .sort((a, b) => b.r - a.r)
        .slice(skip, skip + q.pageSize)
        .map((n) => n.id);
      const found = await prisma.need.findMany({ where: { id: { in: ranked } }, include: cardSelect });
      rows = ranked.map((id) => found.find((f) => f.id === id)!).filter(Boolean);
    } else {
      const orderBy: Prisma.NeedOrderByWithRelationInput[] =
        q.sort === 'urgent'
          ? [{ priority: 'desc' }, { approvedAt: 'desc' }]
          : q.sort === 'popular'
            ? [{ donationCount: 'desc' }, { approvedAt: 'desc' }]
            : [{ approvedAt: 'desc' }];
      rows = await prisma.need.findMany({ where, orderBy, skip, take: q.pageSize, include: cardSelect });
    }

    res.json({
      items: rows.map(publicNeedCard),
      page: q.page,
      pageSize: q.pageSize,
      total,
      hasMore: skip + rows.length < total,
    });
  }),
);

// ───────── Campaign detail ─────────
publicRouter.get(
  '/needs/:slug',
  wrap(async (req, res) => {
    const need = await prisma.need.findFirst({
      where: {
        slug: String(req.params.slug),
        status: { in: ['ACTIVE', 'FUNDED'] },
        beneficiary: { verificationStatus: 'APPROVED', user: { status: 'ACTIVE' } },
      },
      include: {
        beneficiary: {
          include: {
            paymentMethods: { where: { display: true }, select: { id: true, type: true, label: true, maskedHint: true } },
            documents: { where: { verified: true }, select: { kind: true } },
          },
        },
        updates: { orderBy: { createdAt: 'desc' }, take: 30 },
        comments: { where: { approved: true }, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, authorName: true, body: true, createdAt: true } },
        donations: { where: { status: 'SUCCEEDED' }, orderBy: { confirmedAt: 'desc' }, take: 20 },
      },
    });
    if (!need) throw notFound('Campaign not found');

    const card = publicNeedCard(need);
    const b = need.beneficiary;
    res.json({
      ...card,
      story: need.story,
      images: need.images,
      remainingUsd: Math.max(0, card.goalUsd - card.raisedUsd),
      updates: need.updates.map((u) => ({ id: u.id, title: u.title, body: u.body, images: u.images, createdAt: u.createdAt })),
      comments: need.comments,
      recentDonations: need.donations.map((d) => ({ ...publicDonation(d), createdAt: d.confirmedAt ?? d.createdAt })),
      paymentMethods: b.paymentMethods,
      audit: {
        verificationId: b.verificationId,
        verifiedAt: b.verifiedAt,
        lastAuditAt: b.lastAuditAt,
        verifiedDocumentKinds: [...new Set(b.documents.map((d) => d.kind))],
      },
      occupation: b.occupation,
      familySize: b.familySize,
      feePercent: env.PLATFORM_FEE_PERCENT,
    });
  }),
);

// ───────── Community comments & reports ─────────
async function publicNeedId(slug: string) {
  const n = await prisma.need.findFirst({ where: { slug, status: { in: ['ACTIVE', 'FUNDED'] } }, select: { id: true, beneficiaryId: true } });
  if (!n) throw notFound('Campaign not found');
  return n;
}

publicRouter.post(
  '/needs/:slug/comments',
  publicWriteLimiter,
  validate(commentSchema),
  wrap(async (req, res) => {
    const n = await publicNeedId(String(req.params.slug));
    if (/https?:\/\/|www\./i.test(req.body.body)) throw badRequest('Links are not allowed in comments.');
    const c = await prisma.comment.create({
      data: { needId: n.id, authorName: req.body.authorName, body: req.body.body, ip: req.clientIp },
      select: { id: true, authorName: true, body: true, createdAt: true },
    });
    res.status(201).json(c);
  }),
);

publicRouter.post(
  '/needs/:slug/report',
  publicWriteLimiter,
  validate(reportSchema),
  wrap(async (req, res) => {
    const n = await publicNeedId(String(req.params.slug));
    await prisma.report.create({
      data: { needId: n.id, reason: req.body.reason, details: req.body.details, reporterEmail: req.body.reporterEmail, ip: req.clientIp },
    });
    await scoreBeneficiary(n.beneficiaryId); // folds the new report into the fraud score & alerts
    res.status(201).json({ ok: true, message: 'Thank you. Our auditors will review this report.' });
  }),
);

// ───────── Newsletter & contact ─────────
publicRouter.post(
  '/newsletter',
  publicWriteLimiter,
  validate(newsletterSchema),
  wrap(async (req, res) => {
    await prisma.newsletterSubscriber.upsert({ where: { email: req.body.email }, update: {}, create: { email: req.body.email } });
    res.status(201).json({ ok: true });
  }),
);

publicRouter.post(
  '/contact',
  publicWriteLimiter,
  validate(contactSchema),
  wrap(async (req, res) => {
    await prisma.contactMessage.create({ data: req.body });
    res.status(201).json({ ok: true });
  }),
);

// ───────── Transparency report ─────────
publicRouter.get(
  '/transparency',
  wrap(async (_req, res) => {
    const cached = await cacheGet('transparency:v1');
    if (cached) return res.json(cached);

    const [donations, byGateway, approved, rejected, needsInfo, pending, reviews, audits] = await Promise.all([
      prisma.donation.aggregate({ where: { status: 'SUCCEEDED' }, _sum: { amountUsd: true, feeUsd: true }, _count: true }),
      prisma.donation.groupBy({ by: ['gateway'], where: { status: 'SUCCEEDED' }, _count: true, _sum: { amountUsd: true } }),
      prisma.beneficiary.count({ where: { verificationStatus: 'APPROVED' } }),
      prisma.beneficiary.count({ where: { verificationStatus: 'REJECTED' } }),
      prisma.beneficiary.count({ where: { verificationStatus: 'NEEDS_INFO' } }),
      prisma.beneficiary.count({ where: { verificationStatus: 'PENDING' } }),
      prisma.verificationReview.count(),
      prisma.verificationReview.findMany({
        where: { decision: 'APPROVE' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { createdAt: true, beneficiary: { select: { verificationId: true, country: true } } },
      }),
    ]);
    const gross = Number(donations._sum.amountUsd ?? 0);
    const fees = Number(donations._sum.feeUsd ?? 0);
    const decided = approved + rejected;
    const out = {
      feePercent: env.PLATFORM_FEE_PERCENT,
      donations: { count: donations._count, grossUsd: gross, feesUsd: fees, deliveredUsd: gross - fees },
      byGateway: byGateway.map((g) => ({ gateway: g.gateway, count: g._count, usd: Number(g._sum.amountUsd ?? 0) })),
      verification: {
        approved, rejected, needsInfo, pending, totalReviews: reviews,
        approvalRate: decided ? Math.round((approved / decided) * 100) : null,
      },
      recentAudits: audits.map((a) => ({ date: a.createdAt, verificationId: a.beneficiary.verificationId, country: a.beneficiary.country })),
    };
    await cacheSet('transparency:v1', out, 120);
    res.json(out);
  }),
);

export { ageFrom };
