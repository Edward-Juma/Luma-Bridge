import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../env';
import { sniffMime } from './documentValidator';

export const cloudEnabled = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

if (cloudEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/** Local disk fallback for development when Cloudinary isn't configured. */
export const LOCAL_ROOT = path.resolve(process.cwd(), 'uploads');
const PUBLIC_DIR = path.join(LOCAL_ROOT, 'public');
const PRIVATE_DIR = path.join(LOCAL_ROOT, 'private');
if (!cloudEnabled) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.mkdirSync(PRIVATE_DIR, { recursive: true });
}
export const LOCAL_PUBLIC_DIR = PUBLIC_DIR;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export interface StoredFile {
  url: string;
  publicId: string;
  mime: string;
}

function assertSafe(buf: Buffer, allowPdf: boolean): string {
  // Never trust the client-declared mimetype or filename: sniff the bytes.
  const mime = sniffMime(buf);
  if (!mime) throw new Error('Unsupported or corrupt file');
  if (!allowPdf && mime === 'application/pdf') throw new Error('Images only');
  return mime;
}

/** Publicly viewable image (profile photo, gallery, update photos). */
export async function storePublicImage(buf: Buffer, folder: string): Promise<StoredFile> {
  const mime = assertSafe(buf, false);
  if (cloudEnabled) {
    const res = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: `lumabridge/${folder}`,
            resource_type: 'image',
            type: 'upload',
            transformation: [{ quality: 'auto', fetch_format: 'auto', width: 1600, crop: 'limit' }],
          },
          (err, result) => (err || !result ? reject(err) : resolve(result)),
        )
        .end(buf);
    });
    return { url: res.secure_url, publicId: res.public_id, mime };
  }
  const name = `${crypto.randomBytes(12).toString('hex')}.${EXT[mime]}`;
  await fs.promises.writeFile(path.join(PUBLIC_DIR, name), buf);
  return { url: `/files/${name}`, publicId: `public/${name}`, mime };
}

/** Private verification document. Only auditors can obtain a (short-lived) access URL. */
export async function storePrivateDocument(buf: Buffer, folder: string): Promise<StoredFile> {
  const mime = assertSafe(buf, true);
  if (cloudEnabled) {
    const res = await new Promise<{ public_id: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: `lumabridge/private/${folder}`,
            resource_type: 'auto',
            type: 'authenticated',
          },
          (err, result) => (err || !result ? reject(err) : resolve(result)),
        )
        .end(buf);
    });
    return { url: 'cloudinary:authenticated', publicId: res.public_id, mime };
  }
  const name = `${crypto.randomBytes(12).toString('hex')}.${EXT[mime]}`;
  await fs.promises.writeFile(path.join(PRIVATE_DIR, name), buf);
  return { url: 'local:private', publicId: `private/${name}`, mime };
}

/** Returns a time-limited URL (Cloudinary) or null when the caller must stream from disk. */
export function signedDocumentUrl(publicId: string, mime: string): string | null {
  if (!cloudEnabled) return null;
  const isPdf = mime === 'application/pdf';
  return cloudinary.url(publicId, {
    type: 'authenticated',
    sign_url: true,
    secure: true,
    resource_type: isPdf ? 'image' : 'image',
    format: isPdf ? 'pdf' : undefined,
    expires_at: Math.floor(Date.now() / 1000) + 15 * 60,
  });
}

export function localPrivatePath(publicId: string): string | null {
  if (cloudEnabled) return null;
  const resolved = path.resolve(LOCAL_ROOT, publicId);
  // path-traversal guard
  if (!resolved.startsWith(PRIVATE_DIR + path.sep)) return null;
  return resolved;
}
