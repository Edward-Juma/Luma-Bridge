import type { Category, Priority } from './types';

export const money = (usd: number, opts: { compact?: boolean; decimals?: number } = {}) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: opts.compact ? 'compact' : 'standard',
    maximumFractionDigits: opts.decimals ?? (opts.compact ? 1 : 0),
  }).format(usd);

export function formatAmount(amount: number, currency: string): string {
  if (['BTC', 'ETH'].includes(currency)) return `${amount.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${currency}`;
  if (currency === 'USDT') return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} USDT`;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: ['JPY', 'KES', 'NGN', 'INR'].includes(currency) ? 0 : 2 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function timeAgo(iso: string | Date): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'} ago`;
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return plural(d, 'day');
  if (d < 35) return plural(Math.floor(d / 7), 'week');
  return plural(Math.floor(d / 30), 'month');
}

export const fmtDate = (iso: string | Date | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export const CATEGORY_LABEL: Record<Category, string> = {
  EDUCATION: 'Education',
  FOOD: 'Food',
  MEDICAL: 'Medical',
  RENT: 'Rent',
  DISABILITY_SUPPORT: 'Disability support',
  ELDERLY: 'Elderly',
  ORPHANS: 'Orphans',
  SMALL_BUSINESS: 'Small business',
  EMERGENCY_RELIEF: 'Emergency relief',
  REFUGEES: 'Refugees',
};
export const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

export const PRIORITY_LABEL: Record<Priority, string> = { LOW: 'Ongoing', MEDIUM: 'Standard', HIGH: 'Urgent', CRITICAL: 'Critical' };

export const PAYMENT_LABEL: Record<string, string> = {
  BANK_ACCOUNT: 'Bank account', MOBILE_MONEY: 'Mobile money', MPESA: 'M-Pesa', PAYPAL: 'PayPal', WISE: 'Wise',
  STRIPE: 'Stripe', USDT: 'USDT', BITCOIN: 'Bitcoin', ETHEREUM: 'Ethereum', OTHER_WALLET: 'Other wallet',
};

export const DOC_LABEL: Record<string, string> = {
  IDENTITY: 'Identity document', PROOF_OF_ADDRESS: 'Proof of address', INCOME_PROOF: 'Income proof', MEDICAL_REPORT: 'Medical report',
  SCHOOL_LETTER: 'School letter', RENT_NOTICE: 'Rent notice', REFERENCE_LETTER: 'Reference letter', NGO_LETTER: 'NGO letter',
  COMMUNITY_LEADER_LETTER: 'Community leader letter', EMPLOYER_LETTER: 'Employer letter', HOSPITAL_LETTER: 'Hospital letter',
  GOVERNMENT_DOCUMENT: 'Government document', OTHER: 'Other',
};

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'KES', 'CAD', 'AUD', 'JPY', 'CHF', 'AED', 'SAR', 'INR', 'NGN', 'ZAR', 'BTC', 'ETH', 'USDT'] as const;

export const GATEWAY_LABEL: Record<string, string> = {
  STRIPE: 'Stripe', PAYPAL: 'PayPal', FLUTTERWAVE: 'Flutterwave', PAYSTACK: 'Paystack', MPESA: 'M-Pesa', WISE: 'Wise',
  CRYPTO: 'Crypto', APPLE_PAY: 'Apple Pay', GOOGLE_PAY: 'Google Pay', CARD: 'Card', MOCK: 'Test payment',
};

/** Deterministic pseudo-random in [0,1) from a string, so each card keeps a stable masonry height. */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}
