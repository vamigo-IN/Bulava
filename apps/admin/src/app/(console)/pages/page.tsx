'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText, Lock, Plus } from 'lucide-react';
import Link from 'next/link';
import { RequirePermission } from '@/components/shell';
import { Badge, buttonVariants, EmptyState, ErrorNotice, PageHeader, Spinner, Table, Td, Th } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { SitePage } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

export default function PagesPage() {
  return (
    <RequirePermission permission="page.manage">
      <PageList />
    </RequirePermission>
  );
}

function PageList() {
  const list = useQuery({ queryKey: ['admin', 'pages'], queryFn: () => apiGet<SitePage[]>('/admin/pages') });
  return (
    <>
      <PageHeader
        title={t('pages.title')}
        subtitle={t('pages.subtitle')}
        actions={
          <Link href="/pages/new" className={buttonVariants()}>
            <Plus className="size-4" /> {t('pages.new')}
          </Link>
        }
      />
      {list.isPending ? <Spinner /> : null}
      {list.isError ? <ErrorNotice error={list.error} /> : null}
      {list.data && !list.data.length ? <EmptyState>{t('pages.none')}</EmptyState> : null}
      {list.data?.length ? (
        <Table>
          <thead>
            <tr>
              <Th>{t('pages.page')}</Th>
              <Th>{t('pages.layout')}</Th>
              <Th>{t('pages.footer')}</Th>
              <Th>{t('common.status')}</Th>
              <Th>{t('common.updated')}</Th>
              <Th className="text-right">{t('common.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {list.data.map((page) => (
              <tr key={page.id} className="align-top">
                <Td>
                  <Link href={`/pages/${page.id}`} className="group flex items-start gap-2.5">
                    <FileText className="mt-0.5 size-4 shrink-0 text-stone-400 group-hover:text-brand-700" aria-hidden />
                    <span>
                      <span className="block font-medium text-stone-900 group-hover:text-brand-700">{page.title}</span>
                      <span className="block font-mono text-xs text-stone-500">/{page.slug}</span>
                    </span>
                  </Link>
                </Td>
                <Td>{t(`pages.layout.${page.layout}`)}</Td>
                <Td>{page.footerGroup ? t(`pages.footer.${page.footerGroup}`) : <span className="text-stone-400">{t('pages.footer.none')}</span>}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={page.status === 'PUBLISHED' ? 'success' : 'neutral'}>{t(`status.${page.status}`)}</Badge>
                    {page.system ? (
                      <Badge tone="gold">
                        <Lock className="size-3" aria-hidden /> {t('pages.builtIn')}
                      </Badge>
                    ) : null}
                  </div>
                </Td>
                <Td className="whitespace-nowrap text-stone-600">{formatDateTime(page.updatedAt)}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`/pages/${page.id}`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                      {t('common.edit')}
                    </Link>
                    {page.status === 'PUBLISHED' ? (
                      <a href={page.url} target="_blank" rel="noopener" className={buttonVariants({ variant: 'ghost', size: 'sm' })} aria-label={`${t('pages.view')}: ${page.title}`}>
                        <ExternalLink className="size-4" aria-hidden />
                      </a>
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
    </>
  );
}
