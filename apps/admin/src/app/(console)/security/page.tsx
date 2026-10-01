'use client';

import { PageHeader } from '@/components/ui';
import { TwoStepPanel } from '@/components/two-step';
import { t } from '@/lib/i18n';

export default function SecurityPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t('nav.security')} />
      <TwoStepPanel />
    </div>
  );
}
