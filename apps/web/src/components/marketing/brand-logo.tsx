'use client';

import { useQuery } from '@tanstack/react-query';
import type { PublicSiteConfig } from '@bulava/validation';
import { apiGet } from '@/lib/api';
import { Logo } from './logo';

/** Branding for client-rendered screens (dashboard, sign-in), from the public site settings. */
export function useSiteConfig() {
  return useQuery({ queryKey: ['site-config'], queryFn: () => apiGet<PublicSiteConfig>('/public/site-config'), staleTime: 5 * 60_000, retry: 1 });
}

/** The uploaded logo or the default mark; a same-sized blank while the settings load, so the brand never flickers. */
export function BrandLogo({ light = false, href = '/' }: { light?: boolean; href?: string }) {
  const config = useSiteConfig();
  if (config.isPending) return <span className="block h-9 w-32" aria-hidden="true" />;
  return <Logo light={light} href={href} name={config.data?.site.name} imageUrl={config.data?.site.logoUrl ?? null} />;
}
