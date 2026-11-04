/**
 * AI-assisted document validation.
 *
 * This ships with a deterministic, dependency-free heuristic validator so the platform works
 * out of the box and the auditor UI has a real signal to show. It is intentionally behind a
 * single function (`validateDocument`) so a vision model / OCR provider can be dropped in:
 * return the same shape from your provider and nothing else changes.
 *
 * The score is ADVISORY. It never approves anything on its own – auditors make the call.
 */

export interface DocumentValidation {
  /** 0 (very suspicious) .. 1 (no concerns found) */
  score: number;
  notes: string[];
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

const EDITING_SIGNATURES = [
  'Adobe Photoshop',
  'GIMP',
  'Canva',
  'Pixlr',
  'Paint.NET',
  'Snapseed',
  'Photopea',
  'Affinity Photo',
];

export function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP')
    return 'image/webp';
  if (buf.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  return null;
}

export function validateDocument(buf: Buffer, declaredMime: string): DocumentValidation {
  const notes: string[] = [];
  let score = 1;

  const sniffed = sniffMime(buf);
  if (!sniffed) {
    notes.push('File signature is not a recognised image or PDF.');
    return { score: 0, notes };
  }
  if (!ALLOWED_MIME.has(sniffed)) {
    notes.push(`Unsupported file type ${sniffed}.`);
    return { score: 0, notes };
  }
  if (sniffed !== declaredMime) {
    notes.push(`Declared type (${declaredMime}) does not match actual content (${sniffed}).`);
    score -= 0.35;
  }

  if (buf.length < 15_000) {
    notes.push('File is very small – may be a thumbnail or screenshot rather than a scan.');
    score -= 0.2;
  }

  // Scan the first/last 256KB for editing-software fingerprints in metadata.
  const head = buf.subarray(0, 262_144).toString('latin1');
  const tail = buf.subarray(Math.max(0, buf.length - 262_144)).toString('latin1');
  const blob = head + tail;
  for (const sig of EDITING_SIGNATURES) {
    if (blob.includes(sig)) {
      notes.push(`Metadata references editing software (${sig}). Check the original document.`);
      score -= 0.3;
      break;
    }
  }

  if (sniffed === 'application/pdf' && /\/JavaScript|\/JS\s|\/Launch|\/EmbeddedFile/.test(blob)) {
    notes.push('PDF contains active content (script/launch/embedded file).');
    score -= 0.5;
  }

  if (sniffed === 'image/jpeg' && !blob.includes('Exif')) {
    notes.push('No camera metadata found (common for screenshots or re-exported images).');
    score -= 0.08;
  }

  if (notes.length === 0) notes.push('No automated concerns found.');
  return { score: Math.max(0, Math.round(score * 100) / 100), notes };
}
