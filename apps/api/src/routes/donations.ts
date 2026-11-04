import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { wrap, notFound } from '../lib/errors';
import { validate } from '../middleware/validate';
import { donationCreateSchema } from '../schemas';
import { donationLimiter } from '../middleware/security';
import { finalizeByReceipt, quoteDonation, startCheckout } from '../services/checkout';
import { availableGateways } from '../payments';
import { getRates, SUPPORTED_CURRENCIES } from '../lib/currency';
import { env } from '../env';

export const donationsRouter = Router();

/** Available payment methods and whether each supports a given currency natively. */
donationsRouter.get(
  '/options',
  wrap(async (req, res) => {
    const currency = String(req.query.currency ?? 'USD').toUpperCase();
    res.json({
      gateways: availableGateways().map((g) => ({ id: g.id, label: g.label, native: g.supports(currency) })),
      currencies: SUPPORTED_CURRENCIES,
      feePercent: env.PLATFORM_FEE_PERCENT,
    });
  }),
);

donationsRouter.get(
  '/rates',
  wrap(async (_req, res) => {
    const t = await getRates();
    res.json({ usdPerUnit: t.usdPerUnit, fetchedAt: t.fetchedAt, stale: t.stale });
  }),
);

donationsRouter.get(
  '/quote',
  validate(
    z.object({
      amount: z.coerce.number().positive().max(10_000_000),
      currency: z.string().trim().toUpperCase().refine((c) => (SUPPORTED_CURRENCIES as readonly string[]).includes(c)),
    }),
    'query',
  ),
  wrap(async (req, res) => {
    const q = req.query as unknown as { amount: number; currency: string };
    res.json(await quoteDonation(q.amount, q.currency));
  }),
);

donationsRouter.post(
  '/',
  donationLimiter,
  validate(donationCreateSchema),
  wrap(async (req, res) => {
    const body = req.body as z.infer<typeof donationCreateSchema>;
    const out = await startCheckout({ ...body, ip: req.clientIp });
    res.status(201).json(out);
  }),
);

const receiptView = (d: Awaited<ReturnType<typeof finalizeByReceipt>>, need: { title: string; slug: string }) => ({
  status: d.status,
  amount: Number(d.amount),
  currency: d.currency,
  amountUsd: Number(d.amountUsd),
  feeUsd: Number(d.feeUsd),
  gateway: d.gateway,
  anonymous: d.anonymous,
  donorName: d.anonymous ? null : d.donorName,
  createdAt: d.createdAt,
  confirmedAt: d.confirmedAt,
  need,
});

donationsRouter.get(
  '/receipt/:token',
  wrap(async (req, res) => {
    const d = await prisma.donation.findUnique({
      where: { receiptToken: String(req.params.token) },
      include: { need: { select: { title: true, slug: true } } },
    });
    if (!d) throw notFound('Receipt not found');
    res.json(receiptView(d, d.need));
  }),
);

/** Called when a donor lands back from a hosted checkout; confirms with the gateway server-side. */
donationsRouter.post(
  '/receipt/:token/finalize',
  validate(z.object({ orderId: z.string().max(100).optional() }).default({})),
  wrap(async (req, res) => {
    const d = await finalizeByReceipt(String(req.params.token), { orderId: req.body?.orderId });
    const need = await prisma.need.findUniqueOrThrow({ where: { id: d.needId }, select: { title: true, slug: true } });
    res.json(receiptView(d, need));
  }),
);
