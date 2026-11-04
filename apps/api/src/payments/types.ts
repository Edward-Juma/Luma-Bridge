import type { Gateway } from '@prisma/client';

export interface CreatePaymentInput {
  donationId: string;
  /** Amount to charge, already expressed in `currency` (gateway-supported). */
  amount: number;
  currency: string;
  email?: string | null;
  phone?: string | null;
  description: string;
  /** Where the donor lands after paying. */
  returnUrl: string;
  cancelUrl: string;
  receiptToken: string;
}

export interface CreatePaymentResult {
  gatewayRef: string;
  /** Hosted checkout page to redirect the donor to. */
  checkoutUrl?: string;
  /** Human instructions for push / transfer style methods (M-Pesa STK, Wise, crypto address). */
  instructions?: string;
  /** Present for gateways that confirm synchronously (mock). */
  confirmed?: boolean;
  
  /** Crypto: where to send funds. */
  payAddress?: string;
  payAmount?: string;
  payCurrency?: string;
}

export interface PaymentGateway {
  id: Gateway;
  label: string;
  /** Whether it is configured and usable right now. */
  available(): boolean;
  /** Whether it can charge in `currency`; otherwise the service converts to USD first. */
  supports(currency: string): boolean;
  create(input: CreatePaymentInput): Promise<CreatePaymentResult>;
}

export const FIAT_CODES = [
  'USD',
  'EUR',
  'GBP',
  'KES',
  'CAD',
  'AUD',
  'JPY',
  'CHF',
  'AED',
  'SAR',
  'INR',
  'NGN',
  'ZAR',
];

/** Zero-decimal currencies for gateways that need minor units. */
export function toMinor(amount: number, currency: string): number {
  return currency.toUpperCase() === 'JPY' ? Math.round(amount) : Math.round(amount * 100);
}
