import Image from 'next/image';
import { cn } from '@/lib/utils';

/** A bridge arch resting on two banks, with a single point of light underneath it. */
export function LogoMark({ className, size = 32 }: { className?: string; size?: number }) {
  return <Image src="/luma-bridge-icon.svg" width={size} height={size} alt="" aria-hidden="true" className={cn('shrink-0', className)} />;
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Image src="/logo.svg" width={80} height={92} alt="Luma Bridge" priority className="h-[92px] w-[80px] shrink-0 object-contain" />
    </span>
  );
}
