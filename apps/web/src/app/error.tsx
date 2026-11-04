'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <h1 className="text-3xl font-semibold">Something went wrong on our side</h1>
      <p className="mt-2 max-w-md text-muted">Nothing you entered was lost and no payment was taken. Try again, and if it keeps happening, tell us at support.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">Reference {error.digest}</p>}
      <button type="button" onClick={reset} className="btn-primary mt-7">Try again</button>
    </div>
  );
}
