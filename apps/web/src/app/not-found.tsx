import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-display text-7xl font-semibold text-brand">404</p>
      <h1 className="mt-4 text-3xl font-semibold">We couldn't find that page</h1>
      <p className="mt-2 max-w-md text-muted">The link may be old, or the campaign may have ended or been paused while auditors review it.</p>
      <div className="mt-7 flex gap-3">
        <Link href="/needs" className="btn-primary">Browse campaigns</Link>
        <Link href="/" className="btn-ghost">Go home</Link>
      </div>
    </div>
  );
}
