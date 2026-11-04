import { env } from '../../env';
import { HttpError } from '../../lib/errors';
import { jsonFetch } from '../http';
import type { PaymentGateway } from '../types';

const BASE = env.MPESA_ENV === 'live' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';

/** Safaricom wants 2547XXXXXXXX. */
export function normaliseKenyanMsisdn(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits)) return '254' + digits.slice(1);
  if (/^[17]\d{8}$/.test(digits)) return '254' + digits;
  return null;
}

async function token(): Promise<string> {
  const basic = Buffer.from(`${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`).toString('base64');
  const res = await jsonFetch<{ access_token: string }>(
    `${BASE}/oauth/v1/generate?grant_type=client_credentials`,
    { label: 'M-Pesa', headers: { Authorization: `Basic ${basic}` } },
  );
  return res.access_token;
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** M-Pesa Express (STK push): the donor receives a prompt on their phone and enters their PIN. */
export const mpesaGateway: PaymentGateway = {
  id: 'MPESA',
  label: 'M-Pesa',
  available: () =>
    Boolean(
      env.MPESA_CONSUMER_KEY &&
        env.MPESA_CONSUMER_SECRET &&
        env.MPESA_SHORTCODE &&
        env.MPESA_PASSKEY &&
        env.MPESA_CALLBACK_URL,
    ),
  supports: (c) => c.toUpperCase() === 'KES',
  async create(input) {
    const msisdn = input.phone ? normaliseKenyanMsisdn(input.phone) : null;
    if (!msisdn) throw new HttpError(400, 'Enter a valid Safaricom phone number (e.g. 0712 345 678).', 'bad_phone');

    const ts = timestamp();
    const password = Buffer.from(`${env.MPESA_SHORTCODE}${env.MPESA_PASSKEY}${ts}`).toString('base64');
    const res = await jsonFetch<{ CheckoutRequestID: string; ResponseCode: string; CustomerMessage?: string }>(
      `${BASE}/mpesa/stkpush/v1/processrequest`,
      {
        label: 'M-Pesa',
        method: 'POST',
        headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          BusinessShortCode: env.MPESA_SHORTCODE,
          Password: password,
          Timestamp: ts,
          TransactionType: 'CustomerPayBillOnline',
          Amount: Math.max(1, Math.round(input.amount)),
          PartyA: msisdn,
          PartyB: env.MPESA_SHORTCODE,
          PhoneNumber: msisdn,
          CallBackURL: env.MPESA_CALLBACK_URL,
          AccountReference: 'LumaBridge',
          TransactionDesc: input.description.slice(0, 20),
        }),
      },
    );
    if (res.ResponseCode !== '0') throw new HttpError(502, 'M-Pesa could not start the payment.', 'gateway_error');
    return {
      gatewayRef: res.CheckoutRequestID,
      instructions: res.CustomerMessage ?? 'Check your phone and enter your M-Pesa PIN to complete the donation.',
    };
  },
};
