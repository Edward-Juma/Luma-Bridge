import type { Gateway } from '@prisma/client';
import type { PaymentGateway } from './types';
import { stripeGateway } from './gateways/stripe';
import { paypalGateway } from './gateways/paypal';
import { flutterwaveGateway } from './gateways/flutterwave';
import { paystackGateway } from './gateways/paystack';
import { mpesaGateway } from './gateways/mpesa';
import { wiseGateway } from './gateways/wise';
import { cryptoGateway } from './gateways/crypto';
import { mockGateway } from './gateways/mock';

const all: PaymentGateway[] = [
  stripeGateway('CARD'),
  stripeGateway('APPLE_PAY'),
  stripeGateway('GOOGLE_PAY'),
  stripeGateway('STRIPE'),
  paypalGateway,
  flutterwaveGateway,
  paystackGateway,
  mpesaGateway,
  wiseGateway,
  cryptoGateway,
  mockGateway,
];

const byId = new Map<Gateway, PaymentGateway>(all.map((g) => [g.id, g]));

export function getGateway(id: Gateway): PaymentGateway | undefined {
  return byId.get(id);
}

/** Gateways that are configured right now. */
export function availableGateways(): PaymentGateway[] {
  return all.filter((g) => g.available());
}

export type { PaymentGateway } from './types';
