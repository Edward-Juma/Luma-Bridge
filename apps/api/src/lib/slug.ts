import crypto from 'node:crypto';

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'need';
}

export function uniqueSlug(title: string): string {
  return `${slugify(title)}-${crypto.randomBytes(3).toString('hex')}`;
}
