'use client';

import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { t } from '@/lib/i18n';
import type { CheckReport } from '@/lib/types';
import { Alert, Badge, Button, Table, Td, Th } from '../ui';

export function ChecksTab({ report, running, dirty, onRun, error }: { report: CheckReport | null; running: boolean; dirty: boolean; onRun: () => void; error: string | null }) {
  const failing = report?.matrix.filter((m) => m.empty.length) ?? [];
  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">{t('checks.run')}</p>
      {dirty ? <Alert tone="warning">{t('checks.saveFirst')}</Alert> : null}
      <Button onClick={onRun} disabled={running || dirty}>
        <ShieldCheck className="size-4" /> {running ? t('common.loading') : t('studio.runChecks')}
      </Button>
      {error ? <Alert>{error}</Alert> : null}

      {report ? (
        <div className="space-y-4">
          {report.ok ? (
            <Alert tone="success">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="size-4" /> {t('checks.ok')}
              </span>
            </Alert>
          ) : (
            <Alert tone="warning">{t('checks.failed')}</Alert>
          )}

          {report.issues.length ? (
            <section>
              <h3 className="mb-2 text-sm font-semibold">{t('checks.issues')}</h3>
              <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 font-mono text-xs text-red-800">
                {report.issues.map((i) => (
                  <li key={`${i.path}${i.message}`}>
                    {i.path || '(root)'}: {i.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {report.licenseIssues.length ? (
            <section>
              <h3 className="mb-2 text-sm font-semibold">{t('checks.licenses')}</h3>
              <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                {report.licenseIssues.map((i) => (
                  <li key={i.assetId}>
                    <span className="font-mono">{i.assetId}</span>: {i.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {report.matrix.length ? (
            <section>
              <h3 className="mb-2 text-sm font-semibold">
                {t('checks.matrix')} <span className="font-normal text-stone-500">({report.matrix.length - failing.length}/{report.matrix.length})</span>
              </h3>
              <Table>
                <thead>
                  <tr>
                    <Th>{t('checks.case')}</Th>
                    <Th>{t('checks.empty')}</Th>
                    <Th>{t('checks.long')}</Th>
                    {report.matrix[0]?.durationSec !== undefined ? <Th className="text-right">{t('checks.duration')}</Th> : null}
                  </tr>
                </thead>
                <tbody>
                  {report.matrix.map((row) => (
                    <tr key={row.case}>
                      <Td className="font-mono text-xs whitespace-nowrap">{row.case}</Td>
                      <Td>
                        {row.empty.length ? (
                          <div className="flex flex-wrap gap-1">
                            {row.empty.map((p) => (
                              <Badge key={p} tone="danger" className="font-mono">
                                {p}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <Badge tone="success">{t('checks.clean')}</Badge>
                        )}
                      </Td>
                      <Td>
                        {row.long.length ? (
                          <div className="flex flex-wrap gap-1">
                            {row.long.map((p) => (
                              <Badge key={p} tone="warning" className="font-mono">
                                {p}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-stone-400">{t('common.none')}</span>
                        )}
                      </Td>
                      {row.durationSec !== undefined ? <Td className="text-right tabular-nums">{row.durationSec.toFixed(1)}s</Td> : null}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
