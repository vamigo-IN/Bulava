import { t } from '@/lib/i18n';
import type { QueueCounts } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';
import { EmptyState, Table, Td, Th } from './ui';

const COLUMNS = ['waiting', 'active', 'delayed', 'failed', 'completed'] as const;

export function QueueTable({ counts }: { counts: QueueCounts }) {
  const names = Object.keys(counts);
  if (!names.length) return <EmptyState>{t('common.empty')}</EmptyState>;
  return (
    <Table>
      <thead>
        <tr>
          <Th>{t('queue.name')}</Th>
          {COLUMNS.map((c) => (
            <Th key={c} className="text-right">
              {t(`queue.${c}`)}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {names.map((name) => (
          <tr key={name}>
            <Td className="font-medium text-stone-900">{name}</Td>
            {COLUMNS.map((c) => {
              const n = counts[name]?.[c] ?? 0;
              return (
                <Td key={c} className={cn('text-right tabular-nums', c === 'failed' && n > 0 && 'font-semibold text-red-700', c === 'waiting' && n > 100 && 'font-semibold text-amber-700')}>
                  {formatNumber(n)}
                </Td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
