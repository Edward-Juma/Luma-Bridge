import { env } from '../../env';
import { jsonFetch } from '../http';
import type { PaymentGateway } from '../types';

/**
 * Crypto via a NOWPayments-compatible API (BTC, ETH, USDT). The processor monitors the chain,
 * waits for confirmations and calls our IPN webhook – we never touch private keys.
 */
export const cryptoGateway: PaymentGateway = {
  id: 'CRYPTO',
  label: 'Crypto (BTC · ETH · USDT)',
  available: () => Boolean(env.CRYPTO_GATEWAY_API_KEY),
  supports: (c) => ['BTC', 'ETH', 'USDT'].includes(c.toUpperCase()),
  async create(input) {
    const res = await jsonFetch<{
      payment_id: string | number;
      pay_address: string;
      pay_amount: number;
      pay_currency: string;
    }>(`${env.CRYPTO_GATEWAY_URL}/payment`, {
      label: 'Crypto gateway',
      method: 'POST',
      headers: { 'x-api-key': env.CRYPTO_GATEWAY_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price_amount: input.amount,
        price_currency: input.currency.toLowerCase(),
        pay_currency: input.currency.toLowerCase(),
        order_id: input.donationId,
        order_description: input.description.slice(0, 120),
        ipn_callback_url: `${env.WEB_ORIGIN.replace(/\/$/, '')}/api/webhooks/crypto`,
      }),
    });
    return {
      gatewayRef: String(res.payment_id),
      payAddress: res.pay_address,
      payAmount: String(res.pay_amount),
      payCurrency: res.pay_currency.toUpperCase(),
      instructions: `Send exactly ${res.pay_amount} ${res.pay_currency.toUpperCase()} to the address shown. Your donation is confirmed after network confirmations.`,
    };
  },
};
