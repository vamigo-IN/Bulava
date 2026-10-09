'use client';

import { useEffect, useState } from 'react';
import { apiPost } from '@/lib/api';

/**
 * How a code's WhatsApp message is doing: `failed` most often means the number
 * is not on WhatsApp; `unknown` means nobody can tell (a code logged in development).
 */
export type WhatsAppDelivery = 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'unknown';

const SETTLED = new Set<WhatsAppDelivery>(['delivered', 'read', 'failed', 'unknown']);
const POLL_MS = 3000;
const MAX_POLLS = 20;

/** Asks every few seconds (for about a minute) whether the message with a code got through. */
export function useWhatsAppDelivery(sendId: string | null): WhatsAppDelivery {
  const [delivery, setDelivery] = useState<WhatsAppDelivery>('sending');
  useEffect(() => {
    setDelivery('sending');
    if (!sendId) return;
    let alive = true;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      polls += 1;
      try {
        const r = await apiPost<{ delivery: WhatsAppDelivery }>('/auth/phone/status', { sendId });
        if (!alive) return;
        setDelivery(r.delivery);
        if (SETTLED.has(r.delivery)) return;
      } catch {
        // A missed answer is asked again.
      }
      if (alive && polls < MAX_POLLS) timer = setTimeout(() => void poll(), POLL_MS);
    };
    timer = setTimeout(() => void poll(), 1500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [sendId]);
  return delivery;
}
