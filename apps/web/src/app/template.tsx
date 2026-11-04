import type { ReactNode } from 'react';

/** Re-mounts on every navigation, so the CSS entrance below gives a soft page transition without JS. */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="animate-page">{children}</div>;
}
