'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { CONTACT_TOPICS, ContactMessageSchema, type z } from '@bulava/validation';
import { Alert, Button, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { apiPost } from '@/lib/api';
import { errorMessage, I18nProvider, useT } from '@/lib/i18n';

type FormInput = z.input<typeof ContactMessageSchema>;

function ContactFormInner({ supportEmail }: { supportEmail: string }) {
  const t = useT();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ reference: string; name: string; email: string } | null>(null);
  const form = useForm<FormInput>({
    resolver: zodResolver(ContactMessageSchema),
    defaultValues: { name: '', email: '', phone: '', topic: 'GENERAL', message: '', website: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const result = await apiPost<{ reference: string }>('/public/contact', values);
      setSent({ reference: result.reference, name: values.name.trim(), email: values.email.trim() });
    } catch (error) {
      setServerError(errorMessage(t, error));
    }
  });

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-start gap-5 py-4">
        <span className="icon-3d size-14 rounded-2xl">
          <CheckCircle2 aria-hidden className="size-7" />
        </span>
        <h2 className="font-display text-3xl tracking-[-0.01em]">{t('contact.form.sentTitle', { name: sent.name.split(' ')[0] ?? sent.name })}</h2>
        <p className="text-[1.0625rem] leading-relaxed text-stone-700">{t('contact.form.sentBody', { email: sent.email })}</p>
        <p className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-brand-700 shadow-clay-sm">{t('contact.form.reference', { reference: sent.reference })}</p>
        <button
          type="button"
          className="text-sm font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700"
          onClick={() => {
            form.reset();
            setSent(null);
          }}
        >
          {t('contact.form.another')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <h2 className="font-display text-3xl tracking-[-0.01em]">{t('contact.form.title')}</h2>
        <p className="mt-1.5 text-stone-600">{t('contact.form.subtitle')}</p>
      </div>
      {serverError ? <Alert>{serverError}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('contact.form.name')} error={errors.name?.message}>
          {(p) => <Input {...p} autoComplete="name" maxLength={80} {...form.register('name')} />}
        </Field>
        <Field label={t('contact.form.email')} error={errors.email?.message}>
          {(p) => <Input {...p} type="email" inputMode="email" autoComplete="email" maxLength={254} {...form.register('email')} />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('contact.form.phone')} hint={t('contact.form.phoneHint')} error={errors.phone?.message}>
          {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" maxLength={20} {...form.register('phone')} />}
        </Field>
        <Field label={t('contact.form.topic')} error={errors.topic?.message}>
          {(p) => (
            <Select {...p} {...form.register('topic')}>
              {CONTACT_TOPICS.map((topic) => (
                <option key={topic} value={topic}>
                  {t(`contact.topic.${topic}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label={t('contact.form.message')} hint={t('contact.form.messageHint')} error={errors.message?.message}>
        {(p) => <Textarea {...p} rows={6} maxLength={4000} {...form.register('message')} />}
      </Field>
      {/* People never see this field; bots fill it in, and their messages are dropped. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" {...form.register('website')} />
        </label>
      </div>
      <p className="text-sm leading-relaxed text-stone-600">
        {t('contact.form.privacy')}{' '}
        <Link href="/privacy" className="font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700">
          {t('contact.form.privacyLink')}
        </Link>
      </p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
        <Button type="submit" size="lg" className="group/send min-h-13 rounded-2xl px-7" disabled={isSubmitting}>
          {isSubmitting ? t('contact.form.sending') : t('contact.form.send')}
          <Send aria-hidden className="size-4 transition-transform duration-300 group-hover/send:translate-x-0.5 group-hover/send:-translate-y-0.5" />
        </Button>
        <p className="text-sm text-stone-600">
          {t('contact.form.orEmail')}{' '}
          <a href={`mailto:${supportEmail}`} className="font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700">
            {supportEmail}
          </a>
        </p>
      </div>
    </form>
  );
}

/** The contact page's form: posts to /public/contact and shows the message's reference. */
export function ContactForm({ supportEmail }: { supportEmail: string }) {
  return (
    <I18nProvider language="en">
      <ContactFormInner supportEmail={supportEmail} />
    </I18nProvider>
  );
}
