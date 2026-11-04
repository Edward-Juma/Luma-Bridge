import { env } from '../../env';
import type { PaymentGateway } from '../types';
import { FIAT_CODES } from '../types';

/**
 * Wise has no hosted "pay-in" checkout, so this gateway issues a bank-transfer reference.
 * The donor sends a Wise transfer quoting the reference; an auditor/admin confirms receipt
 * from the Wise balance statement (or via the Wise webhook for balance credits).
 */
export const wiseGateway: PaymentGateway = {
  id: 'WISE',
  label: 'Wise transfer',
  available: () => Boolean(env.WISE_API_TOKEN),
  supports: (c) => FIAT_CODES.includes(c.toUpperCase()),
  async create(input) {
    const ref = `HB-${input.donationId.slice(-8).toUpperCase()}`;
    return {
      gatewayRef: ref,
      instructions: `Send ${input.amount.toFixed(2)} ${input.currency.toUpperCase()} by Wise to LumaBridge Giving and use "${ref}" as the payment reference. Your donation appears once the transfer lands (usually within a day).`,
    };
  },
};
