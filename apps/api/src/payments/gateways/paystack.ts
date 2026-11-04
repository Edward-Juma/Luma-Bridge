import { env } from '../../env';
import { jsonFetch } from '../http';
import { PaymentGateway, toMinor } from '../types';

const SUPPORTED = ['NGN', 'GHS', 'ZAR', 'KES', 'USD'];

export const paystackGateway: PaymentGateway = {
  id: 'PAYSTACK',
  label: 'Paystack',
  available: () => Boolean(env.PAYSTACK_SECRET_KEY),
  supports: (c) => SUPPORTED.includes(c.toUpperCase()),
  async create(input) {
    const res = await jsonFetch<{ status: boolean; data?: { authorization_url: string; reference: string } }>(
      'https://api.paystack.co/transaction/initialize',
      {
        label: 'Paystack',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: input.email ?? `donor+${input.donationId}@lumabridge.app`,
          amount: toMinor(input.amount, input.currency),
          currency: input.currency.toUpperCase(),
          reference: input.donationId,
          callback_url: input.returnUrl,
          metadata: { donationId: input.donationId },
        }),
      },
    );
    if (!res.data) throw new Error('Paystack did not return an authorization URL');
    return { gatewayRef: res.data.reference, checkoutUrl: res.data.authorization_url };
  },
};
