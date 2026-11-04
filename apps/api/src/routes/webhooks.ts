import crypto from 'node:crypto';
import express, { Router, type Request } from 'express';
import { env } from '../env';
import { wrap, badRequest, forbidden } from '../lib/errors';
import { timingSafeEqualStr } from '../lib/crypto';
import { prisma } from '../db';
import { confirmDonation, failDonation, refundDonation } from '../services/donations';
import { stripeClient } from '../payments/gateways/stripe';
import { audit } from '../lib/audit';

/**
 * Payment webhooks. Every handler authenticates the caller (signature / shared secret) BEFORE touching
 * the database, and every state transition is idempotent (see confirmDonation).
 */
export const webhooksRouter = Router();
webhooksRouter.use(express.raw({ type: '*/*', limit: '1mb' }));

const raw = (req: Request) => (Buffer.isBuffer(req.body) ? req.body : Buffer.from(''));
const parse = <T,>(req: Request): T => {
  try {
    return JSON.parse(raw(req).toString('utf8')) as T;
  } catch {
    throw badRequest('Invalid JSON');
  }
};

// ── Stripe ──
webhooksRouter.post(
  '/stripe',
  wrap(async (req, res) => {
    if (!stripeClient || !env.STRIPE_WEBHOOK_SECRET) throw forbidden('Stripe webhooks are not configured');
    let event;
    try {
      event = stripeClient.webhooks.constructEvent(raw(req), String(req.header('stripe-signature')), env.STRIPE_WEBHOOK_SECRET);
    } catch {
      throw badRequest('Invalid signature');
    }
    const obj = event.data.object as unknown as { metadata?: Record<string, string>; payment_status?: string; payment_intent?: string };
    const donationId = obj.metadata?.donationId;
    if (donationId) {
      if (event.type === 'checkout.session.completed' && obj.payment_status === 'paid') await confirmDonation(donationId);
      if (event.type === 'checkout.session.expired' || event.type === 'payment_intent.payment_failed') await failDonation(donationId);
    }
    if (event.type === 'charge.refunded') {
      const charge = event.data.object as unknown as { metadata?: Record<string, string> };
      const id = charge.metadata?.donationId;
      if (id && (await refundDonation(id))) await audit({ action: 'donation.refunded', entity: 'Donation', entityId: id });
    }
    res.json({ received: true });
  }),
);

// ── Paystack: HMAC-SHA512 of the raw body ──
webhooksRouter.post(
  '/paystack',
  wrap(async (req, res) => {
    if (!env.PAYSTACK_SECRET_KEY) throw forbidden('Paystack webhooks are not configured');
    const expected = crypto.createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(raw(req)).digest('hex');
    if (!timingSafeEqualStr(expected, String(req.header('x-paystack-signature') ?? ''))) throw forbidden('Invalid signature');
    const evt = parse<{ event: string; data?: { reference?: string } }>(req);
    const id = evt.data?.reference;
    if (id && evt.event === 'charge.success') await confirmDonation(id);
    res.json({ received: true });
  }),
);

// ── Flutterwave: shared "verif-hash" header ──
webhooksRouter.post(
  '/flutterwave',
  wrap(async (req, res) => {
    if (!env.FLUTTERWAVE_WEBHOOK_HASH) throw forbidden('Flutterwave webhooks are not configured');
    if (!timingSafeEqualStr(env.FLUTTERWAVE_WEBHOOK_HASH, String(req.header('verif-hash') ?? ''))) throw forbidden('Invalid signature');
    const evt = parse<{ event?: string; data?: { tx_ref?: string; status?: string } }>(req);
    const id = evt.data?.tx_ref;
    if (id && evt.data?.status === 'successful') await confirmDonation(id);
    else if (id && evt.data?.status === 'failed') await failDonation(id);
    res.json({ received: true });
  }),
);

// ── M-Pesa (Daraja has no signature, so the callback URL carries a secret derived from our pepper) ──
export const mpesaCallbackSecret = () =>
  crypto.createHmac('sha256', env.FINGERPRINT_PEPPER).update('mpesa-callback').digest('hex').slice(0, 32);

webhooksRouter.post(
  '/mpesa',
  wrap(async (req, res) => {
    if (!timingSafeEqualStr(mpesaCallbackSecret(), String(req.query.s ?? ''))) throw forbidden('Invalid callback');
    const evt = parse<{ Body?: { stkCallback?: { CheckoutRequestID: string; ResultCode: number } } }>(req);
    const cb = evt.Body?.stkCallback;
    if (cb) {
      const d = await prisma.donation.findUnique({ where: { gatewayRef: cb.CheckoutRequestID } });
      if (d) {
        if (cb.ResultCode === 0) await confirmDonation(d.id);
        else await failDonation(d.id);
      }
    }
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }),
);

// ── Crypto IPN (NOWPayments style: HMAC-SHA512 over key-sorted JSON) ──
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sortKeys(x)]));
  }
  return v;
}

webhooksRouter.post(
  '/crypto',
  wrap(async (req, res) => {
    if (!env.CRYPTO_GATEWAY_IPN_SECRET) throw forbidden('Crypto webhooks are not configured');
    const body = parse<{ order_id?: string; payment_status?: string }>(req);
    const expected = crypto.createHmac('sha512', env.CRYPTO_GATEWAY_IPN_SECRET).update(JSON.stringify(sortKeys(body))).digest('hex');
    if (!timingSafeEqualStr(expected, String(req.header('x-nowpayments-sig') ?? ''))) throw forbidden('Invalid signature');
    if (body.order_id) {
      if (body.payment_status === 'finished' || body.payment_status === 'confirmed') await confirmDonation(body.order_id);
      if (body.payment_status === 'failed' || body.payment_status === 'expired') await failDonation(body.order_id);
    }
    res.json({ received: true });
  }),
);
