/** Fire-and-forget client analytics (PostHog/GA4 when configured; no-op otherwise). */
export function track(name: string, properties: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { posthog?: { capture: (n: string, p: object) => void }; gtag?: (...a: unknown[]) => void };
  w.posthog?.capture(name, properties);
  w.gtag?.('event', name, properties);
}
