import crypto from 'node:crypto';
import { env } from '../env';

const KEY = Buffer.from(env.DATA_ENCRYPTION_KEY, 'hex');

/** AES-256-GCM. Output format: v1.<iv>.<tag>.<ciphertext> (all base64url). */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), enc.toString('base64url')].join(
    '.',
  );
}

export function decrypt(payload: string): string {
  const [version, iv, tag, data] = payload.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unsupported ciphertext format');
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(data, 'base64url')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

/** Keyed hash so we can detect duplicate IDs / phones without keeping a plaintext lookup column. */
export function fingerprint(value: string): string {
  const normalised = value.replace(/[\s\-().]/g, '').toUpperCase();
  return crypto.createHmac('sha256', env.FINGERPRINT_PEPPER).update(normalised).digest('hex');
}

export function sha256(buf: Buffer | string): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** Short human-friendly verification ID, e.g. HB-KE-7F3A9C21 */
export function makeVerificationId(country: string): string {
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `HB-${country.toUpperCase().slice(0, 2)}-${suffix}`;
}

export function maskTail(value: string, visible = 4): string {
  const clean = value.replace(/\s/g, '');
  if (clean.length <= visible) return '•'.repeat(clean.length);
  return '••••' + clean.slice(-visible);
}
