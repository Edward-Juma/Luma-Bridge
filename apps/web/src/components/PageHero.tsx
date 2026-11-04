import type { ReactNode } from 'react';

export function PageHero({ eyebrow, title, body, children }: { eyebrow?: string; title: string; body?: string; children?: ReactNode }) {
  return (
    <header className="container pb-6 pt-8 md:pb-10 md:pt-14">
      <div className="max-w-3xl">
        {eyebrow && <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-brand">{eyebrow}</p>}
        <h1 className="text-4xl font-semibold md:text-6xl md:leading-[1.02]">{title}</h1>
        {body && <p className="mt-5 text-lg text-muted md:text-xl">{body}</p>}
        {children}
      </div>
    </header>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return <div className="container pb-8"><div className="prose-hb max-w-3xl">{children}</div></div>;
}
