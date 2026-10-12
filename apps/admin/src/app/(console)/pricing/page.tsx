'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { FEATURE_KEYS, type FeatureKey } from '@bulava/validation';
import { RequirePermission, useInvalidate } from '@/components/shell';
import { Alert, Badge, Button, Card, CardTitle, Checkbox, EmptyState, ErrorNotice, Field, Input, PageHeader, Select, Spinner, Table, Td, Textarea, Th } from '@/components/ui';
import { apiGet, apiPatch, apiPut, errorMessage } from '@/lib/api';
import { t, tMaybe, type AdminMessageKey } from '@/lib/i18n';
import type { Coupon, Plan, PlanFeature } from '@/lib/types';
import { formatDate, formatInr, fromDateInput, toDateInput } from '@/lib/utils';

/** Features that are on/off only; the rest carry a numeric limit. */
const SWITCH_FEATURES = new Set<FeatureKey>([
  FEATURE_KEYS.VIDEO_HD,
  FEATURE_KEYS.WATERMARK,
  FEATURE_KEYS.GALLERY,
  FEATURE_KEYS.PLANNER,
  FEATURE_KEYS.CUSTOM_DOMAIN,
  FEATURE_KEYS.RSVP,
  FEATURE_KEYS.MUSIC,
  FEATURE_KEYS.CUSTOM_LINK,
  FEATURE_KEYS.DONE_FOR_YOU,
  FEATURE_KEYS.RUSH,
  FEATURE_KEYS.PRIORITY_SUPPORT,
]);
const ALL_FEATURES = Object.values(FEATURE_KEYS);

export default function PricingPage() {
  return (
    <RequirePermission permission="pricing.manage">
      <Pricing />
    </RequirePermission>
  );
}

function Pricing() {
  const plans = useQuery({ queryKey: ['admin', 'plans'], queryFn: () => apiGet<Plan[]>('/admin/plans') });
  const free = plans.data?.find((p) => p.key === 'FREE');
  const tiers = plans.data?.filter((p) => p.kind !== 'ADDON') ?? [];
  const addOns = plans.data?.filter((p) => p.kind === 'ADDON') ?? [];
  const tierKeys = tiers.filter((p) => p.priceMinor > 0).map((p) => p.key);
  return (
    <>
      <PageHeader title={t('pricing.title')} subtitle={t('pricing.subtitle')} />
      {plans.isPending ? <Spinner /> : null}
      {plans.isError ? <ErrorNotice error={plans.error} /> : null}
      <h2 className="mt-2 mb-3 text-lg font-semibold">{t('pricing.plans')}</h2>
      <div className="grid gap-5 xl:grid-cols-2">
        {tiers.map((plan) => (
          <PlanCard key={`${plan.id}-${plan.priceMinor}-${plan.active}-${plan.visibility}`} plan={plan} baseline={plan.key === 'FREE' ? null : free ?? null} tierKeys={tierKeys} />
        ))}
      </div>
      {addOns.length ? (
        <>
          <h2 className="mt-8 mb-1 text-lg font-semibold">{t('pricing.addOns')}</h2>
          <p className="mb-3 text-sm text-stone-500">{t('pricing.addOnsHint')}</p>
          <div className="grid gap-5 xl:grid-cols-2">
            {addOns.map((plan) => (
              <PlanCard key={`${plan.id}-${plan.priceMinor}-${plan.active}-${plan.offeredTo.join()}`} plan={plan} baseline={null} tierKeys={tierKeys} />
            ))}
          </div>
        </>
      ) : null}
      <Coupons />
    </>
  );
}

function PlanCard({ plan, baseline, tierKeys }: { plan: Plan; baseline: Plan | null; tierKeys: string[] }) {
  const invalidate = useInvalidate();
  const addOn = plan.kind === 'ADDON';
  const [form, setForm] = useState({
    name: plan.name,
    description: plan.description ?? '',
    price: String(plan.priceMinor / 100),
    listPrice: plan.listPriceMinor === null ? '' : String(plan.listPriceMinor / 100),
    active: plan.active,
    sortOrder: plan.sortOrder,
    visibility: plan.visibility,
    badge: plan.badge ?? '',
    tagline: plan.tagline ?? '',
    stackable: plan.stackable,
    offeredTo: plan.offeredTo,
  });
  const save = useMutation({
    mutationFn: () =>
      apiPatch(`/admin/plans/${plan.key}`, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        priceMinor: Math.round(Number(form.price) * 100),
        // Empty: no offer (the price alone).
        listPriceMinor: form.listPrice.trim() === '' ? null : Math.round(Number(form.listPrice) * 100),
        active: form.active,
        sortOrder: form.sortOrder,
        visibility: form.visibility,
        badge: form.badge.trim() || null,
        tagline: form.tagline.trim() || null,
        ...(addOn ? { stackable: form.stackable, offeredTo: form.offeredTo } : {}),
      }),
    onSuccess: () => invalidate(['admin', 'plans']),
  });
  const byKey = new Map(plan.features.map((f) => [f.featureKey, f]));
  const baseByKey = new Map(baseline?.features.map((f) => [f.featureKey, f]) ?? []);

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {plan.name} <span className="font-mono text-xs text-stone-400">{plan.key}</span>
        </h2>
        <div className="flex items-center gap-2">
          {plan.listPriceMinor && plan.listPriceMinor > plan.priceMinor ? <span className="text-sm text-stone-400 tabular-nums line-through">{formatInr(plan.listPriceMinor)}</span> : null}
          <span className="text-lg font-semibold tabular-nums">{formatInr(plan.priceMinor)}</span>
          <span className="text-xs text-stone-500">{tMaybe(`pricing.interval.${plan.interval}`, plan.interval)}</span>
          {addOn ? <Badge tone="neutral">{t('pricing.kind.ADDON')}</Badge> : null}
          {plan.visibility === 'HIDDEN' ? <Badge tone="warning">{t('pricing.visibility.HIDDEN')}</Badge> : null}
          {!plan.active ? <Badge tone="danger">{t('common.inactive')}</Badge> : null}
        </div>
      </div>
      <form onSubmit={submit} className="space-y-3">
        {save.isError ? <Alert>{errorMessage(save.error, t('common.error'))}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-[1fr_120px_120px_100px]">
          <Field label={t('pricing.planName')}>{(p) => <Input {...p} required maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
          <Field label={t('pricing.price')}>
            {(p) => <Input {...p} type="number" required min={0} step="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />}
          </Field>
          <Field label={t('pricing.listPrice')} hint={t('pricing.listPriceHint')}>
            {(p) => <Input {...p} type="number" min={0} step="1" value={form.listPrice} onChange={(e) => setForm({ ...form, listPrice: e.target.value })} />}
          </Field>
          <Field label={t('pricing.sortOrder')}>
            {(p) => <Input {...p} type="number" min={0} max={1000} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} />}
          </Field>
        </div>
        <Field label={t('pricing.planDescription')}>
          {(p) => <Textarea {...p} rows={2} maxLength={300} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t('pricing.tagline')} hint={t('pricing.taglineHint')}>
            {(p) => <Input {...p} maxLength={60} value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />}
          </Field>
          <Field label={t('pricing.badge')} hint={t('pricing.badgeHint')}>
            {(p) => <Input {...p} maxLength={40} value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} />}
          </Field>
          <Field label={t('pricing.visibility')} hint={t('pricing.visibilityHint')}>
            {(p) => (
              <Select {...p} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as Plan['visibility'] })}>
                <option value="PUBLIC">{t('pricing.visibility.PUBLIC')}</option>
                <option value="HIDDEN">{t('pricing.visibility.HIDDEN')}</option>
              </Select>
            )}
          </Field>
        </div>
        {addOn ? (
          <div className="space-y-2 rounded-lg border border-stone-200 p-3">
            <Checkbox label={t('pricing.stackable')} checked={form.stackable} onChange={(e) => setForm({ ...form, stackable: e.target.checked })} />
            <p className="text-xs font-semibold text-stone-700">{t('pricing.offeredTo')}</p>
            <div className="flex flex-wrap gap-x-4">
              {tierKeys.map((key) => (
                <Checkbox
                  key={key}
                  label={key}
                  checked={form.offeredTo.includes(key)}
                  onChange={(e) => setForm({ ...form, offeredTo: e.target.checked ? [...form.offeredTo, key] : form.offeredTo.filter((k) => k !== key) })}
                />
              ))}
            </div>
            <p className="text-xs text-stone-500">{t('pricing.offeredToHint')}</p>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <Checkbox label={t('pricing.planActive')} checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          <Button type="submit" size="sm" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('pricing.savePlan')}
          </Button>
        </div>
      </form>

      <h3 className="mt-5 mb-2 text-sm font-semibold">{t('pricing.features')}</h3>
      <p className="mb-2 text-xs text-stone-500">{addOn ? t('pricing.addOnLimitHint') : t('pricing.limitHint')}</p>
      <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
        {ALL_FEATURES.map((key) => (
          <FeatureRow key={`${key}-${byKey.get(key)?.enabled}-${byKey.get(key)?.limit}`} planKey={plan.key} featureKey={key} value={byKey.get(key) ?? null} inherited={baseByKey.get(key) ?? null} />
        ))}
      </ul>
    </Card>
  );
}

function FeatureRow({ planKey, featureKey, value, inherited }: { planKey: string; featureKey: FeatureKey; value: PlanFeature | null; inherited: PlanFeature | null }) {
  const invalidate = useInvalidate();
  const isSwitch = SWITCH_FEATURES.has(featureKey);
  const [enabled, setEnabled] = useState(value?.enabled ?? false);
  const [limit, setLimit] = useState(value?.limit == null ? '' : String(value.limit));
  const changed = !value ? enabled || limit !== '' : enabled !== value.enabled || limit !== (value.limit == null ? '' : String(value.limit));
  const save = useMutation({
    mutationFn: () => apiPut(`/admin/plans/${planKey}/features/${featureKey}`, { enabled, limit: isSwitch || limit === '' ? null : Math.max(0, Math.floor(Number(limit))) }),
    onSuccess: () => invalidate(['admin', 'plans']),
  });
  const describe = (f: PlanFeature) => (!f.enabled ? t('common.no') : isSwitch ? t('common.yes') : f.limit == null ? t('common.unlimited') : String(f.limit));

  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
      <span className="min-w-0 flex-1">
        {t(`feature.${featureKey}` as AdminMessageKey)}
        {!value && inherited ? <span className="block text-xs text-stone-400">{`${t('pricing.inherited')}: ${describe(inherited)}`}</span> : null}
      </span>
      <Checkbox className="min-h-8" label={t('pricing.enabled')} checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
      {!isSwitch ? (
        <Input
          aria-label={t('pricing.limit')}
          type="number"
          min={0}
          placeholder={t('common.unlimited')}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          className="min-h-8 w-28"
          disabled={!enabled}
        />
      ) : null}
      <Button size="sm" variant="secondary" disabled={!changed || save.isPending} onClick={() => save.mutate()}>
        {t('common.save')}
      </Button>
      {save.isError ? <p className="w-full text-xs text-red-700">{errorMessage(save.error, t('common.error'))}</p> : null}
    </li>
  );
}

const EMPTY_COUPON = { code: '', percentOff: '', amountOff: '', maxRedemptions: '', validFrom: '', validUntil: '', active: true };

function Coupons() {
  const invalidate = useInvalidate();
  const coupons = useQuery({ queryKey: ['admin', 'coupons'], queryFn: () => apiGet<Coupon[]>('/admin/coupons') });
  const [form, setForm] = useState(EMPTY_COUPON);
  const save = useMutation({
    mutationFn: () =>
      apiPut('/admin/coupons', {
        code: form.code.trim().toUpperCase(),
        percentOff: form.percentOff ? Number(form.percentOff) : null,
        amountOffMinor: form.amountOff ? Math.round(Number(form.amountOff) * 100) : null,
        maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
        validFrom: fromDateInput(form.validFrom),
        validUntil: fromDateInput(form.validUntil, true),
        active: form.active,
      }),
    onSuccess: async () => {
      await invalidate(['admin', 'coupons']);
      setForm(EMPTY_COUPON);
    },
  });

  function edit(c: Coupon) {
    setForm({
      code: c.code,
      percentOff: c.percentOff ? String(c.percentOff) : '',
      amountOff: c.amountOffMinor ? String(c.amountOffMinor / 100) : '',
      maxRedemptions: c.maxRedemptions ? String(c.maxRedemptions) : '',
      validFrom: toDateInput(c.validFrom),
      validUntil: toDateInput(c.validUntil),
      active: c.active,
    });
  }

  const oneOf = !!form.percentOff !== !!form.amountOff;

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">{t('pricing.coupons')}</h2>
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div>
          {coupons.isPending ? <Spinner /> : null}
          {coupons.data && !coupons.data.length ? <EmptyState>{t('common.empty')}</EmptyState> : null}
          {coupons.data?.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>{t('coupon.code')}</Th>
                  <Th>{t('coupon.discount')}</Th>
                  <Th>{t('coupon.redemptions')}</Th>
                  <Th>{t('coupon.window')}</Th>
                  <Th>{t('common.status')}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {coupons.data.map((c) => (
                  <tr key={c.id}>
                    <Td className="font-mono font-medium">{c.code}</Td>
                    <Td>{c.percentOff ? `${c.percentOff}%` : c.amountOffMinor ? formatInr(c.amountOffMinor) : t('common.none')}</Td>
                    <Td className="tabular-nums">
                      {c.redemptions}
                      {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}
                    </Td>
                    <Td className="text-xs whitespace-nowrap">
                      {formatDate(c.validFrom)} – {formatDate(c.validUntil)}
                    </Td>
                    <Td>
                      <Badge tone={c.active ? 'success' : 'neutral'}>{c.active ? t('common.active') : t('common.inactive')}</Badge>
                    </Td>
                    <Td className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => edit(c)}>
                        {t('common.edit')}
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : null}
        </div>

        <Card>
          <CardTitle>{t('pricing.newCoupon')}</CardTitle>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
            className="space-y-3"
          >
            {save.isError ? <Alert>{errorMessage(save.error, t('common.error'))}</Alert> : null}
            <Field label={t('coupon.code')}>
              {(p) => <Input {...p} required pattern="[A-Za-z0-9_\-]{3,40}" className="font-mono uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('coupon.percentOff')}>
                {(p) => <Input {...p} type="number" min={1} max={100} value={form.percentOff} onChange={(e) => setForm({ ...form, percentOff: e.target.value, amountOff: '' })} />}
              </Field>
              <Field label={t('coupon.amountOff')}>
                {(p) => <Input {...p} type="number" min={1} value={form.amountOff} onChange={(e) => setForm({ ...form, amountOff: e.target.value, percentOff: '' })} />}
              </Field>
            </div>
            {!oneOf ? <p className="text-xs text-stone-500">{t('coupon.oneOf')}</p> : null}
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('coupon.maxRedemptions')} className="col-span-2">
                {(p) => <Input {...p} type="number" min={1} placeholder={t('common.unlimited')} value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} />}
              </Field>
              <Field label={t('coupon.validFrom')}>{(p) => <Input {...p} type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />}</Field>
              <Field label={t('coupon.validUntil')}>{(p) => <Input {...p} type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />}</Field>
            </div>
            <Checkbox label={t('common.active')} checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setForm(EMPTY_COUPON)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={!oneOf || save.isPending}>
                {save.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </section>
  );
}
