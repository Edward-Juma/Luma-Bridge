import { env, isProd } from '../../env';
import type { PaymentGateway } from '../types';

/** Development-only gateway that confirms instantly. Disabled in production no matter what. */
export const mockGateway: PaymentGateway = {
  id: 'MOCK',
  label: 'Test payment (dev only)',
  available: () => env.PAYMENTS_MOCK && !isProd,
  supports: () => true,
  async create(input) {
    return { gatewayRef: `mock_${input.donationId}`, confirmed: true };
  },
};
