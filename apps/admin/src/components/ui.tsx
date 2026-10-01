'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { forwardRef, useEffect, useId, useRef, type ComponentProps, type ReactNode } from 'react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-700 text-white hover:bg-brand-900',
        secondary: 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-100',
        ghost: 'text-stone-700 hover:bg-stone-100',
        danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
        success: 'bg-green-700 text-white hover:bg-green-800',
      },
      size: {
        md: 'min-h-10 px-4 text-sm',
        sm: 'min-h-8 px-3 text-xs',
        icon: 'size-8 text-sm',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export const Button = forwardRef<HTMLButtonElement, ComponentProps<'button'> & VariantProps<typeof buttonVariants>>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';

const fieldClass =
  'block w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200 aria-invalid:border-red-500 disabled:bg-stone-100';

export const Input = forwardRef<HTMLInputElement, ComponentProps<'input'>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldClass, 'min-h-10', className)} {...props} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<'textarea'>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldClass, 'min-h-20 py-2', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, ComponentProps<'select'>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(fieldClass, 'min-h-10', className)} {...props} />
));
Select.displayName = 'Select';

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('mb-1 block text-xs font-semibold tracking-wide text-stone-600 uppercase', className)} {...props} />;
}

/** Label + control + hint, wired with ids for screen readers. */
export function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: (props: { id: string; 'aria-describedby'?: string }) => ReactNode }) {
  const id = useId();
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, 'aria-describedby': hint ? `${id}-hint` : undefined })}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-stone-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<'input'> & { label: ReactNode }) {
  return (
    <label className={cn('flex min-h-9 cursor-pointer items-center gap-2.5 text-sm text-stone-800', className)}>
      <input type="checkbox" className="size-4 rounded border-stone-300 accent-brand-700" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('rounded-xl border border-stone-200 bg-white p-5 shadow-sm', className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('mb-4 text-base font-semibold text-stone-900', className)} {...props} />;
}

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'bg-stone-100 text-stone-700',
      success: 'bg-green-100 text-green-800',
      warning: 'bg-amber-100 text-amber-800',
      danger: 'bg-red-100 text-red-800',
      brand: 'bg-brand-100 text-brand-700',
      gold: 'bg-gold-100 text-gold-700',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

export function Badge({ className, tone, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/** Colour for the statuses used across templates, assets, orders and users. */
export function statusTone(status: string): BadgeTone {
  if (['PUBLISHED', 'APPROVED', 'PAID', 'ACTIVE', 'COMPLETED', 'SUCCESS'].includes(status)) return 'success';
  if (['DRAFT', 'PENDING_REVIEW', 'CREATED', 'QUEUED'].includes(status)) return 'warning';
  if (['REJECTED', 'FAILED', 'SUSPENDED', 'EXPIRED', 'FAILURE', 'DENIED'].includes(status)) return 'danger';
  return 'neutral';
}

export function Alert({ children, tone = 'danger', className }: { children: ReactNode; tone?: 'danger' | 'success' | 'info' | 'warning'; className?: string }) {
  const styles = {
    danger: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-green-200 bg-green-50 text-green-800',
    info: 'border-stone-200 bg-stone-50 text-stone-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  }[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-lg border px-4 py-3 text-sm', styles, className)}>
      {children}
    </div>
  );
}

export function Spinner({ label = t('common.loading') }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-8 text-sm text-stone-500">
      <span className="size-4 animate-spin rounded-full border-2 border-stone-300 border-t-brand-700" />
      {label}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">{children}</p>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-3xl text-sm text-stone-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Horizontal scroll on narrow screens keeps wide tables usable. */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm', className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, ...props }: ComponentProps<'th'>) {
  return <th scope="col" className={cn('border-b border-stone-200 bg-stone-50 px-4 py-2.5 text-xs font-semibold tracking-wide text-stone-500 uppercase', className)} {...props} />;
}

export function Td({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('border-b border-stone-100 px-4 py-3 align-top text-stone-700', className)} {...props} />;
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: Array<{ key: T; label: string; hidden?: boolean }>; value: T; onChange: (key: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cn('flex gap-1 overflow-x-auto border-b border-stone-200', className)}>
      {tabs
        .filter((tab) => !tab.hidden)
        .map((tab) => (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={tab.key === value}
            onClick={() => onChange(tab.key)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              tab.key === value ? 'border-brand-700 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-800',
            )}
          >
            {tab.label}
          </button>
        ))}
    </div>
  );
}

/** Native <dialog> modal: focus trapping and Escape handling come from the browser. */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="modal-title"
      className={cn('m-auto w-[calc(100%-2rem)] rounded-2xl p-0 shadow-2xl backdrop:bg-stone-900/40', wide ? 'max-w-3xl' : 'max-w-lg')}
    >
      <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
        <h2 id="modal-title" className="text-base font-semibold">
          {title}
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label={t('common.close')}>
          <X className="size-4" />
        </Button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-5">{open ? children : null}</div>
    </dialog>
  );
}

export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'danger' }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">{label}</p>
      <p className={cn('mt-2 text-2xl font-semibold tabular-nums', tone === 'danger' ? 'text-red-700' : 'text-stone-900')}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}

export function ErrorNotice({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : t('common.error');
  return <Alert>{message}</Alert>;
}
