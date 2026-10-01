'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { RequirePermission } from '@/components/shell';
import { Studio } from '@/components/studio/studio';
import { ErrorNotice, Spinner } from '@/components/ui';
import { apiGet } from '@/lib/api';
import type { TemplateDetail } from '@/lib/types';

export default function TemplateStudioPage() {
  return (
    <RequirePermission permission="template.manage">
      <StudioLoader />
    </RequirePermission>
  );
}

function StudioLoader() {
  const { id } = useParams<{ id: string }>();
  const detail = useQuery({ queryKey: ['admin', 'template', id], queryFn: () => apiGet<TemplateDetail>(`/admin/templates/${id}`) });
  if (detail.isPending) return <Spinner />;
  if (detail.isError) return <ErrorNotice error={detail.error} />;
  return <Studio key={detail.data.template.id} detail={detail.data} />;
}
