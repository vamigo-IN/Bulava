import { useCallback, useRef, useState } from 'react';

/**
 * Undo/redo over immutable snapshots. `record` is called with every committed
 * state (not with live drag frames); undo and redo hand back the snapshot to
 * apply. Capped so a long session cannot hold hundreds of definitions.
 */
export function useHistory<T>(limit = 60) {
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const [, bump] = useState(0);

  const record = useCallback(
    (current: T) => {
      past.current.push(current);
      if (past.current.length > limit) past.current.shift();
      future.current = [];
      bump((n) => n + 1);
    },
    [limit],
  );

  const undo = useCallback((current: T): T | null => {
    const previous = past.current.pop();
    if (previous === undefined) return null;
    future.current.push(current);
    bump((n) => n + 1);
    return previous;
  }, []);

  const redo = useCallback((current: T): T | null => {
    const next = future.current.pop();
    if (next === undefined) return null;
    past.current.push(current);
    bump((n) => n + 1);
    return next;
  }, []);

  const reset = useCallback(() => {
    past.current = [];
    future.current = [];
    bump((n) => n + 1);
  }, []);

  return { record, undo, redo, reset, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
