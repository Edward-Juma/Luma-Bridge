import { Accessibility, Baby, GraduationCap, HeartHandshake, House, Siren, Stethoscope, Store, Tent, Utensils, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { CATEGORIES, CATEGORY_LABEL } from '@/lib/format';
import type { Category } from '@/lib/types';

export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  EDUCATION: GraduationCap,
  FOOD: Utensils,
  MEDICAL: Stethoscope,
  RENT: House,
  DISABILITY_SUPPORT: Accessibility,
  ELDERLY: HeartHandshake,
  ORPHANS: Baby,
  SMALL_BUSINESS: Store,
  EMERGENCY_RELIEF: Siren,
  REFUGEES: Tent,
};

export function Categories() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CATEGORIES.map((c) => {
        const Icon = CATEGORY_ICON[c];
        return (
          <li key={c}>
            <Link href={`/needs?category=${c}`} className="group flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-soft">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand transition group-hover:bg-brand group-hover:text-white dark:bg-brand-900/40"><Icon className="h-5 w-5" aria-hidden /></span>
              <span className="font-semibold leading-tight">{CATEGORY_LABEL[c]}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
