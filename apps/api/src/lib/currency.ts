import { cacheGet, cacheSet } from './cache';

export const SUPPORTED_CURRENCIES = [
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
  'BTC',
  'ETH',
  'USDT',
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

const CRYPTO: Record<string, string> = { BTC: 'bitcoin', ETH: 'ethereum', USDT: 'tether' };

/** Last-resort rates (units of currency per 1 USD for fiat; USD per coin for crypto). */
const FALLBACK_FIAT_PER_USD: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  KES: 129,
  CAD: 1.36,
  AUD: 1.52,
  JPY: 150,
  CHF: 0.88,
  AED: 3.6725,
  SAR: 3.75,
  INR: 83,
  NGN: 1500,
  ZAR: 18.5,
};
const FALLBACK_CRYPTO_USD: Record<string, number> = { BTC: 65000, ETH: 3200, USDT: 1 };

export interface RateTable {
  /** USD value of one unit of each currency */
  usdPerUnit: Record<string, number>;
  fetchedAt: string;
  stale: boolean;
}

const KEY = 'fx:table:v1';

async function fetchTable(): Promise<RateTable> {
  const usdPerUnit: Record<string, number> = {};

  const [fiat, crypto] = await Promise.allSettled([
    fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(6000) }).then(
      (r) => r.json() as Promise<{ rates?: Record<string, number> }>,
    ),
    fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd',
      { signal: AbortSignal.timeout(6000) },
    ).then((r) => r.json() as Promise<Record<string, { usd: number }>>),
  ]);

  let stale = false;

  const fiatRates =
    fiat.status === 'fulfilled' && fiat.value.rates ? fiat.value.rates : undefined;
  for (const [code, perUsd] of Object.entries(FALLBACK_FIAT_PER_USD)) {
    const live = fiatRates?.[code];
    if (!live) stale = true;
    usdPerUnit[code] = 1 / (live ?? perUsd);
  }

  for (const [code, id] of Object.entries(CRYPTO)) {
    const live = crypto.status === 'fulfilled' ? crypto.value[id]?.usd : undefined;
    if (!live) stale = true;
    usdPerUnit[code] = live ?? FALLBACK_CRYPTO_USD[code]!;
  }

  return { usdPerUnit, fetchedAt: new Date().toISOString(), stale };
}

export async function getRates(): Promise<RateTable> {
  const cached = await cacheGet<RateTable>(KEY);
  if (cached) return cached;
  let table: RateTable;
  try {
    table = await fetchTable();
  } catch {
    table = {
      usdPerUnit: {
        ...Object.fromEntries(Object.entries(FALLBACK_FIAT_PER_USD).map(([k, v]) => [k, 1 / v])),
        ...FALLBACK_CRYPTO_USD,
      },
      fetchedAt: new Date().toISOString(),
      stale: true,
    };
  }
  // fresh rates live 5 min; stale fallbacks only 30s so we retry soon
  await cacheSet(KEY, table, table.stale ? 30 : 300);
  return table;
}

export async function toUsd(
  amount: number,
  currency: string,
): Promise<{ usd: number; rate: number; stale: boolean }> {
  const table = await getRates();
  const rate = table.usdPerUnit[currency.toUpperCase()];
  if (!rate) throw new Error(`Unsupported currency: ${currency}`);
  return { usd: round2(amount * rate), rate, stale: table.stale };
}

export async function fromUsd(usd: number, currency: string): Promise<number> {
  const table = await getRates();
  const rate = table.usdPerUnit[currency.toUpperCase()];
  if (!rate) throw new Error(`Unsupported currency: ${currency}`);
  return usd / rate;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Minimum donation expressed in USD, applied after conversion. */
export const MIN_DONATION_USD = 1;
export const MAX_DONATION_USD = 50_000;
