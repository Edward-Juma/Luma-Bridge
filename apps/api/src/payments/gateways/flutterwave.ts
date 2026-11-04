import { env } from '../../env';
import { jsonFetch } from '../http';
import type { PaymentGateway } from '../types';

const SUPPORTED = ['USD', 'EUR', 'GBP', 'KES', 'NGN', 'ZAR', 'CAD', 'AUD'];

export const flutterwaveGateway: PaymentGateway = {
  id: 'FLUTTERWAVE',
  label: 'Flutterwave',
  available: () => Boolean(env.FLUTTERWAVE_SECRET_KEY),
  supports: (c) => SUPPORTED.includes(c.toUpperCase()),
  async create(input) {
    const res = await jsonFetch<{ status: string; data?: { link: string } }>(
      'https://api.flutterwave.com/v3/payments',
      {
        label: 'Flutterwave',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx_ref: input.donationId,
          amount: input.amount,
          currency: input.currency.toUpperCase(),
          redirect_url: input.returnUrl,
          customer: { email: input.email ?? `donor+${input.donationId}@lumabridge.app`, phonenumber: input.phone ?? undefined },
          customizations: { title: 'LumaBridge', description: input.description.slice(0, 100) },
          meta: { donationId: input.donationId },
        }),
      },
    );
    if (!res.data?.link) throw new Error('Flutterwave did not return a payment link');
    return { gatewayRef: input.donationId, checkoutUrl: res.data.link };
  },
};
