import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') });
dotenv.config();

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default('https://luma-bridge.vercel.app'),
  DATABASE_URL: z.string().min(1),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().email().default('onboarding@resend.dev'),
  REDIS_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  DATA_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'DATA_ENCRYPTION_KEY must be 64 hex chars (32 bytes)'),
  FINGERPRINT_PEPPER: z.string().min(8),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(30).default(0),
  PAYMENTS_MOCK: bool,

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_ENV: z.enum(['sandbox', 'live']).default('sandbox'),
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_WEBHOOK_HASH: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  MPESA_CONSUMER_KEY: z.string().optional(),
  MPESA_CONSUMER_SECRET: z.string().optional(),
  MPESA_SHORTCODE: z.string().optional(),
  MPESA_PASSKEY: z.string().optional(),
  MPESA_CALLBACK_URL: z.string().optional(),
  MPESA_ENV: z.enum(['sandbox', 'live']).default('sandbox'),
  WISE_API_TOKEN: z.string().optional(),
  CRYPTO_GATEWAY_API_KEY: z.string().optional(),
  CRYPTO_GATEWAY_IPN_SECRET: z.string().optional(),
  CRYPTO_GATEWAY_URL: z.string().default('https://api.nowpayments.io/v1'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
