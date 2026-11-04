import crypto from 'node:crypto';
import { Prisma, type Gateway } from '@prisma/client';
import { prisma } from '../db';
import { env } from '../env';
import { badRequest, HttpError, notFound } from '../lib/errors';
import { MAX_DONATION_USD, MIN_DONATION_USD, round2, toUsd } from '../lib/currency';
import { screenDonation } from '../lib/fraud';
import { getGateway } from '../payments';
import { capturePaypalOrder } from '../payments/gateways/paypal';
import { stripeClient } from '../payments/gateways/stripe';
import { jsonFetch } from '../payments/http';
import { confirmDonation, failDonation } from './donations';

export interface CheckoutInput {
  needId: string;
  amount: number;
  currency: string;
  gateway: Gateway;
  anonymous: boolean;
  donorName?: string;
  donorCountry?: string;
  donorEmail?: string;
  donorPhone?: string;
  message?: string;
  ip: string;
}

const CRYPTO_CODES = ['BTC', 'ETH', 'USDT'];

export async function startCheckout(input: CheckoutInput) {
  const need = await prisma.need.findUnique({
    where: { id: input.needId },
    include: { beneficiary: { include: { user: { select: { status: true } } } } },
  });
  if (!need || need.status !== 'ACTIVE' || need.beneficiary.verificationStatus !== 'APPROVED') {
    throw notFound('This campaign is not accepting donations.');
  }
  if (need.beneficiary.user.status !== 'ACTIVE') throw notFound('This campaign is not accepting donations.');

  const gateway = getGateway(input.gateway);
  if (!gateway || !gateway.available()) {
    throw badRequest('That payment method is not available right now. Please choose another.');
  }

  const { usd, rate } = await toUsd(input.amount, input.currency);
  if (usd < MIN_DONATION_USD) throw badRequest(`The minimum donation is about $${MIN_DONATION_USD}.`);
  if (usd > MAX_DONATION_USD) throw badRequest('For gifts this large, please contact us so we can help securely.');

  await screenDonation({ ip: input.ip, needId: need.id, amountUsd: usd, email: input.donorEmail });

  // Decide what we actually charge. Gateways that can't take the chosen currency are charged in USD
  // (or USDT for crypto) at the live rate; the donor sees this before confirming in the UI.
  let chargeCurrency = input.currency.toUpperCase();
  let chargeAmount = input.amount;
  if (!gateway.supports(chargeCurrency)) {
    chargeCurrency = input.gateway === 'CRYPTO' ? 'USDT' : 'USD';
    if (!gateway.supports(chargeCurrency)) throw badRequest('That payment method cannot take this currency.');
    chargeAmount = usd; // USD and USDT are both ~1:1 with the converted value
  }
  if (chargeCurrency === 'JPY') chargeAmount = Math.round(chargeAmount);
  else if (!CRYPTO_CODES.includes(chargeCurrency)) chargeAmount = round2(chargeAmount);

  const feeUsd = round2((usd * env.PLATFORM_FEE_PERCENT) / 100);
  const receiptToken = crypto.randomBytes(18).toString('base64url');

  const donation = await prisma.donation.create({
    data: {
      needId: need.id,
      amount: new Prisma.Decimal(input.amount),
      currency: input.currency.toUpperCase(),
      amountUsd: new Prisma.Decimal(usd),
      fxRate: new Prisma.Decimal(rate),
      feeUsd: new Prisma.Decimal(feeUsd),
      gateway: input.gateway,
      anonymous: input.anonymous,
      donorName: input.anonymous ? null : input.donorName,
      donorCountry: input.anonymous ? null : input.donorCountry,
      donorEmail: input.donorEmail,
      message: input.anonymous ? null : input.message,
      ip: input.ip,
      receiptToken,
    },
  });

  const web = env.WEB_ORIGIN.replace(/\/$/, '');
  try {
    const result = await gateway.create({
      donationId: donation.id,
      amount: chargeAmount,
      currency: chargeCurrency,
      email: input.donorEmail,
      phone: input.donorPhone,
      description: `Donation to ${need.title}`,
      returnUrl: `${web}/donate/complete?r=${receiptToken}`,
      cancelUrl: `${web}/needs/${need.slug}`,
      receiptToken,
    });
    await prisma.donation.update({ where: { id: donation.id }, data: { gatewayRef: result.gatewayRef } });
    if (result.confirmed) await confirmDonation(donation.id, result.gatewayRef);
    return {
      receiptToken,
      status: result.confirmed ? ('SUCCEEDED' as const) : ('PENDING' as const),
      checkoutUrl: result.checkoutUrl,
      instructions: result.instructions,
      payAddress: result.payAddress,
      payAmount: result.payAmount,
      payCurrency: result.payCurrency,
      charged: { amount: chargeAmount, currency: chargeCurrency },
      amountUsd: usd,
      feeUsd,
    };
  } catch (err) {
    await failDonation(donation.id);
    if (err instanceof HttpError) throw err;
    console.error('[checkout] gateway failure', err);
    throw new HttpError(502, 'We could not start that payment. Nothing was charged.', 'gateway_error');
  }
}

/**
 * Server-side confirmation used when the donor returns from a hosted checkout. Webhooks are the
 * source of truth in production, but verifying directly makes the flow robust to delayed or
 * missed webhooks and works in local development.
 */
export async function finalizeByReceipt(receiptToken: string, hints: { orderId?: string } = {}) {
  const d = await prisma.donation.findUnique({ where: { receiptToken } });
  if (!d) throw notFound('Receipt not found');
  if (d.status !== 'PENDING') return d;

  try {
    if (d.gateway === 'PAYPAL' && d.gatewayRef) {
      if (hints.orderId && hints.orderId !== d.gatewayRef) throw badRequest('Order mismatch');
      if (await capturePaypalOrder(d.gatewayRef)) await confirmDonation(d.id);
    } else if (['STRIPE', 'CARD', 'APPLE_PAY', 'GOOGLE_PAY'].includes(d.gateway) && d.gatewayRef && stripeClient) {
      const session = await stripeClient.checkout.sessions.retrieve(d.gatewayRef);
      if (session.payment_status === 'paid') await confirmDonation(d.id);
      else if (session.status === 'expired') await failDonation(d.id);
    } else if (d.gateway === 'PAYSTACK' && env.PAYSTACK_SECRET_KEY) {
      const r = await jsonFetch<{ data?: { status: string } }>(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(d.id)}`,
        { label: 'Paystack', headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` } },
      );
      if (r.data?.status === 'success') await confirmDonation(d.id);
      else if (r.data?.status === 'failed') await failDonation(d.id);
    } else if (d.gateway === 'FLUTTERWAVE' && env.FLUTTERWAVE_SECRET_KEY) {
      const r = await jsonFetch<{ data?: { status: string } }>(
        `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(d.id)}`,
        { label: 'Flutterwave', headers: { Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}` } },
      );
      if (r.data?.status === 'successful') await confirmDonation(d.id);
      else if (r.data?.status === 'failed') await failDonation(d.id);
    }
  } catch (err) {
    if (err instanceof HttpError && err.status < 500) throw err;
    console.error('[checkout] finalize check failed', err);
  }
  return prisma.donation.findUniqueOrThrow({ where: { receiptToken } });
}

export async function quoteDonation(amount: number, currency: string) {
  const { usd, rate, stale } = await toUsd(amount, currency);
  const feeUsd = round2((usd * env.PLATFORM_FEE_PERCENT) / 100);
  return { amountUsd: usd, rate, feeUsd, netUsd: round2(usd - feeUsd), stale, feePercent: env.PLATFORM_FEE_PERCENT };
}
