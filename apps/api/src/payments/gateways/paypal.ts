import { env } from '../../env';
import { jsonFetch } from '../http';
import type { PaymentGateway } from '../types';

const BASE = env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const SUPPORTED = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF'];

async function accessToken(): Promise<string> {
  const basic = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await jsonFetch<{ access_token: string }>(`${BASE}/v1/oauth2/token`, {
    label: 'PayPal',
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  return res.access_token;
}

export const paypalGateway: PaymentGateway = {
  id: 'PAYPAL',
  label: 'PayPal',
  available: () => Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET),
  supports: (c) => SUPPORTED.includes(c.toUpperCase()),
  async create(input) {
    const token = await accessToken();
    const decimals = input.currency.toUpperCase() === 'JPY' ? 0 : 2;
    const order = await jsonFetch<{ id: string; links: { rel: string; href: string }[] }>(
      `${BASE}/v2/checkout/orders`,
      {
        label: 'PayPal',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': input.donationId,
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              custom_id: input.donationId,
              description: input.description.slice(0, 120),
              amount: { currency_code: input.currency.toUpperCase(), value: input.amount.toFixed(decimals) },
            },
          ],
          payment_source: {
            paypal: {
              experience_context: {
                user_action: 'PAY_NOW',
                return_url: input.returnUrl,
                
                cancel_url: input.cancelUrl,
              },
            },
          },
        }),
      },
    );
    const approve = order.links.find((l) => l.rel === 'payer-action' || l.rel === 'approve');
    return { gatewayRef: order.id, checkoutUrl: approve?.href };
  },
};

/** Called when the donor returns from PayPal; captures the approved order server-side. */
export async function capturePaypalOrder(orderId: string): Promise<boolean> {
  const token = await accessToken();
  const res = await jsonFetch<{ status: string }>(`${BASE}/v2/checkout/orders/${orderId}/capture`, {
    label: 'PayPal',
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return res.status === 'COMPLETED';
}
