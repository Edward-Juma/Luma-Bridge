import { z } from 'zod';

export const CATEGORIES = [
  'EDUCATION',
  'FOOD',
  'MEDICAL',
  'RENT',
  'DISABILITY_SUPPORT',
  'ELDERLY',
  'ORPHANS',
  'SMALL_BUSINESS',
  'EMERGENCY_RELIEF',
  'REFUGEES',
] as const;

export const PAYMENT_METHOD_TYPES = [
  'BANK_ACCOUNT',
  'MOBILE_MONEY',
  'MPESA',
  'PAYPAL',
  'WISE',
  'STRIPE',
  'USDT',
  'BITCOIN',
  'ETHEREUM',
  'OTHER_WALLET',
] as const;

export const DOCUMENT_KINDS = [
  'IDENTITY',
  'PROOF_OF_ADDRESS',
  'INCOME_PROOF',
  'MEDICAL_REPORT',
  'SCHOOL_LETTER',
  'RENT_NOTICE',
  'REFERENCE_LETTER',
  'NGO_LETTER',
  'COMMUNITY_LEADER_LETTER',
  'EMPLOYER_LETTER',
  'HOSPITAL_LETTER',
  'GOVERNMENT_DOCUMENT',
  'OTHER',
] as const;

const str = (min = 1, max = 200) => z.string().trim().min(min).max(max);

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128)
  .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p), {
    message: 'Include upper and lower case letters and a number',
  });

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: passwordSchema,
  fullName: str(2, 120),
  nationalId: str(4, 40),
  phone: z.string().trim().regex(/^\+?[0-9\s\-()]{7,20}$/, 'Enter a valid phone number'),
  gender: z.enum(['FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED']).default('UNDISCLOSED'),
  dateOfBirth: z.coerce.date().refine((d) => {
    const age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
    return age >= 18 && age <= 120;
  }, 'Applicants must be 18 or older. Guardians can apply on behalf of a minor.'),
  country: z.string().trim().length(2).toUpperCase(),
  city: str(1, 100),
  address: z.string().trim().max(300).optional(),
  incomeLevel: z.enum(['NONE', 'VERY_LOW', 'LOW', 'LOWER_MIDDLE', 'MIDDLE']),
  occupation: str(1, 120),
  familySize: z.coerce.number().int().min(1).max(40),
  emergencyContactName: str(2, 120),
  emergencyContactPhone: z.string().trim().regex(/^\+?[0-9\s\-()]{7,20}$/, 'Enter a valid phone number'),
  about: str(30, 3000),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export const mfaVerifySchema = z.object({
  challenge: z.string().min(10),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const paymentMethodSchema = z.object({
  type: z.enum(PAYMENT_METHOD_TYPES),
  label: str(1, 80),
  details: z.record(z.string().max(300)).refine((r) => Object.keys(r).length > 0 && Object.keys(r).length <= 10, {
    message: 'Provide the account details',
  }),
  /** Last digits / handle shown publicly; derived server-side if omitted. */
  display: z.boolean().default(true),
});

export const needCreateSchema = z.object({
  title: str(8, 120),
  summary: str(20, 240),
  story: str(200, 8000),
  category: z.enum(CATEGORIES),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  goalUsd: z.coerce.number().min(10).max(250_000),
  deadline: z.coerce.date().min(new Date(), 'Deadline must be in the future').optional(),
});

export const needUpdateSchema = needCreateSchema.partial();

export const needFeedQuery = z.object({
  q: z.string().trim().max(100).optional(),
  country: z.string().trim().length(2).toUpperCase().optional(),
  city: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORIES).optional(),
  gender: z.enum(['FEMALE', 'MALE', 'OTHER']).optional(),
  minAge: z.coerce.number().int().min(0).max(120).optional(),
  maxAge: z.coerce.number().int().min(0).max(120).optional(),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  verifiedOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v !== 'false'), // all public profiles are verified; kept for the UI filter
  sort: z.enum(['recent', 'urgent', 'nearly_funded', 'popular']).default('recent'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});

export const donationCreateSchema = z
  .object({
    needId: z.string().min(1),
    amount: z.coerce.number().positive().max(10_000_000),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .refine((c) =>
        ['USD', 'EUR', 'GBP', 'KES', 'CAD', 'AUD', 'JPY', 'CHF', 'AED', 'SAR', 'INR', 'NGN', 'ZAR', 'BTC', 'ETH', 'USDT'].includes(c),
        'Unsupported currency',
      ),
    gateway: z.enum(['STRIPE', 'PAYPAL', 'FLUTTERWAVE', 'PAYSTACK', 'MPESA', 'WISE', 'CRYPTO', 'APPLE_PAY', 'GOOGLE_PAY', 'CARD', 'MOCK']),
    anonymous: z.boolean().default(true),
    donorName: z.string().trim().max(80).optional(),
    donorCountry: z.string().trim().length(2).toUpperCase().optional(),
    donorEmail: z.string().trim().toLowerCase().email().max(200).optional(),
    donorPhone: z.string().trim().max(20).optional(),
    message: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.anonymous && !v.donorName) {
      ctx.addIssue({ code: 'custom', path: ['donorName'], message: 'Add your name or choose to give anonymously' });
    }
  });

export const reviewSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'REQUEST_INFO']),
  notes: str(10, 4000),
  checklist: z.object({
    identity: z.boolean(),
    documents: z.boolean(),
    location: z.boolean(),
    legitimacy: z.boolean(),
    income: z.boolean(),
    references: z.boolean(),
    videoInterview: z.boolean().default(false),
    fieldVisit: z.boolean().default(false),
    governmentVerified: z.boolean().default(false),
    ngoVerified: z.boolean().default(false),
    communityLeader: z.boolean().default(false),
    employer: z.boolean().default(false),
    hospital: z.boolean().default(false),
    school: z.boolean().default(false),
  }),
});

export const commentSchema = z.object({
  authorName: str(1, 60),
  body: str(2, 600),
});

export const reportSchema = z.object({
  reason: z.enum(['SUSPECTED_FRAUD', 'FALSE_INFORMATION', 'DUPLICATE_PROFILE', 'INAPPROPRIATE', 'OTHER']),
  details: z.string().trim().max(2000).optional(),
  reporterEmail: z.string().trim().toLowerCase().email().optional(),
});

export const updatePostSchema = z.object({
  title: str(3, 120),
  body: str(10, 4000),
});

export const newsletterSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200) });

export const contactSchema = z.object({
  name: str(2, 100),
  email: z.string().trim().toLowerCase().email().max(200),
  subject: str(3, 150),
  body: str(10, 4000),
});

export const suspendSchema = z.object({
  action: z.enum(['SUSPEND', 'BAN', 'REINSTATE']),
  reason: str(5, 500),
  days: z.coerce.number().int().min(1).max(365).optional(),
});
