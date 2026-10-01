import { t } from '@/lib/i18n';
import type { AdminTemplate } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { Badge, statusTone, Table, Td, Th } from '../ui';

export function VersionsTab({ template }: { template: AdminTemplate }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>{t('versions.version')}</Th>
          <Th>{t('common.status')}</Th>
          <Th>{t('common.created')}</Th>
          <Th>{t('versions.published')}</Th>
        </tr>
      </thead>
      <tbody>
        {template.versions.map((v) => (
          <tr key={v.id}>
            <Td className="font-medium tabular-nums">
              v{v.version} {v.id === template.currentVersionId ? <Badge tone="success">{t('versions.current')}</Badge> : null}
            </Td>
            <Td>
              <Badge tone={statusTone(v.status)}>{t(`status.${v.status}`)}</Badge>
            </Td>
            <Td>{formatDateTime(v.createdAt)}</Td>
            <Td>{formatDateTime(v.publishedAt)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
