/**
 * Cards and purchases kept on this device (localStorage), without the card
 * schema: the gallery reads them without loading the editor's code.
 */

export interface StoredOrder {
  orderToken: string;
  reference: string;
  templateKey: string;
  templateName: string;
  createdAt: number;
}

export const RECENT_KEY = 'bulava.cards.recent';
const ORDERS_KEY = 'bulava.cards.orders';

export function readStore<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeStore(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private windows and full storage: the server copy (once saved) still holds the card.
  }
}

export function recentCards(): Array<{ templateKey: string; templateName: string; savedAt: number }> {
  return readStore(RECENT_KEY) ?? [];
}

export function storedOrders(): StoredOrder[] {
  return readStore<StoredOrder[]>(ORDERS_KEY) ?? [];
}

export function rememberOrder(order: StoredOrder): void {
  writeStore(ORDERS_KEY, [order, ...storedOrders().filter((o) => o.orderToken !== order.orderToken)].slice(0, 20));
}
