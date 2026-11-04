import { HttpError } from '../lib/errors';

export async function jsonFetch<T = unknown>(
  url: string,
  init: RequestInit & { label: string },
): Promise<T> {
  const { label, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, { ...rest, signal: AbortSignal.timeout(15_000) });
  } catch (e) {
    console.error(`[payments:${label}] network error`, e);
    throw new HttpError(502, `${label} is temporarily unreachable.`, 'gateway_unreachable');
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    console.error(`[payments:${label}] ${res.status}`, body);
    throw new HttpError(502, `${label} rejected the payment request.`, 'gateway_error');
  }
  return body as T;
}
