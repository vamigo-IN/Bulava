import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Brand mark: the logo uploaded in the admin console (Site settings >
 * Branding), or the default gold mandala on maroon with the serif wordmark.
 * `adaptive` follows the marketing header's tone (its CSS variables);
 * `light` is for dark backgrounds such as the footer.
 */
export function Logo({ light = false, adaptive = false, href = '/', name = 'Bulava', imageUrl = null }: { light?: boolean; adaptive?: boolean; href?: string; name?: string; imageUrl?: string | null }) {
  if (imageUrl) {
    return (
      <Link href={href} className="flex items-center" aria-label={`${name} home`}>
        {/* A signed, redirecting storage URL of unknown size: a plain img, height-bound. */}
        <img
          src={imageUrl}
          alt={name}
          className={cn(
            'h-9 w-auto max-w-44 object-contain transition-colors duration-500',
            light && 'rounded-md bg-ivory/95 px-2 py-1',
            adaptive && 'rounded-md group-data-[tone=dark]/header:bg-ivory/95 group-data-[tone=dark]/header:px-2 group-data-[tone=dark]/header:py-1',
          )}
        />
      </Link>
    );
  }
  const disc = adaptive ? 'var(--logo-disc)' : light ? '#fbf7f0' : '#5b0e1b';
  const mark = adaptive ? 'var(--logo-mark)' : light ? '#9c7222' : '#e3c585';
  return (
    <Link href={href} className="group/logo flex items-center gap-2.5" aria-label={`${name} home`}>
      <svg viewBox="0 0 40 40" className="size-8 transition-transform duration-700 ease-out group-hover/logo:rotate-45" aria-hidden="true">
        <circle cx="20" cy="20" r="19" style={{ fill: disc }} className="transition-[fill] duration-500" />
        <g fill="none" strokeWidth="1.2" style={{ stroke: mark }}>
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d="M20 6 C23 12 23 15 20 18 C17 15 17 12 20 6Z" transform={`rotate(${i * 45} 20 20)`} />
          ))}
          <circle cx="20" cy="20" r="3" style={{ fill: mark }} />
        </g>
      </svg>
      <span className={cn('font-display text-2xl font-semibold tracking-wide transition-colors duration-500', adaptive ? 'text-[var(--hdr-text)]' : light ? 'text-ivory' : 'text-brand-700')}>{name}</span>
    </Link>
  );
}
