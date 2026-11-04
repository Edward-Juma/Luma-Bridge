import Stripe from 'stripe';
import { env } from '../../env';
import { FIAT_CODES, PaymentGateway, toMinor } from '../types';

export const stripeClient = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

/**
 * Stripe Checkout. Apple Pay, Google Pay and cards are all surfaced automatically by Checkout
 * (enable wallets in the Stripe dashboard), so the three "gateway" choices in the UI map here.
 */
export const stripeGateway = (id: 'STRIPE' | 'CARD' | 'APPLE_PAY' | 'GOOGLE_PAY'): PaymentGateway => ({
  id,
  label:
    id === 'STRIPE'
      ? 'Stripe'
      : id === 'CARD'
        ? 'Debit / Credit card'
        : id === 'APPLE_PAY'
          ? 'Apple Pay'
          : 'Google Pay',
  available: () => Boolean(stripeClient),
  supports: (c) => FIAT_CODES.includes(c.toUpperCase()),
  async create(input) {
    if (!stripeClient) throw new Error('Stripe not configured');
    const session = await stripeClient.checkout.sessions.create({
      mode: 'payment',
      customer_email: input.email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: toMinor(input.amount, input.currency),
            product_data: { name: input.description },
          },
        },
      ],
      metadata: { donationId: input.donationId },
      payment_intent_data: { metadata: { donationId: input.donationId } },
      success_url: input.returnUrl,
      cancel_url: input.cancelUrl,
    });
    return { gatewayRef: session.id, checkoutUrl: session.url ?? undefined };
  },
});
