import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Touch targets are at least 44px tall for thumb-friendly mobile use. Buttons are the clay 3D
// buttons of globals.css (btn-3d), the same as on the marketing site.

export const buttonVariants = cva('rounded-xl font-semibold disabled:pointer-events-none', {
  variants: {
    variant: {
      primary: 'btn-3d',
      secondary: 'btn-3d btn-3d-light',
      ghost: 'inline-flex items-center justify-center gap-2 font-medium text-stone-700 transition-colors duration-300 hover:bg-sand/80 hover:text-ink disabled:opacity-50',
      danger: 'btn-3d btn-3d-light !text-red-700',
      whatsapp: 'btn-3d btn-3d-green',
    },
    size: {
      md: 'min-h-11 px-5 text-sm',
      sm: 'min-h-9 px-3.5 text-sm',
      lg: 'min-h-12 px-6 text-base',
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

export const Button = forwardRef<HTMLButtonElement, ComponentProps<'button'> & VariantProps<typeof buttonVariants>>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';

// Fields are pressed into the clay (shadow-clay-inset) and lift to white while focused.
const fieldClass =
  'block w-full rounded-xl border border-[#e2d2c0] bg-[#f8f2ea] px-3.5 text-base text-stone-900 shadow-clay-inset placeholder:text-stone-500 transition-[border-color,box-shadow,background-color] duration-200 hover:border-[#d3bda5] focus:border-brand-600 focus:bg-white focus:ring-4 focus:ring-brand-100 focus:outline-none aria-invalid:border-red-500 aria-invalid:focus:ring-red-100';

export const Input = forwardRef<HTMLInputElement, ComponentProps<'input'>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldClass, 'min-h-11', className)} {...props} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<'textarea'>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldClass, 'min-h-20 py-2', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, ComponentProps<'select'>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(fieldClass, 'min-h-11', className)} {...props} />
));
Select.displayName = 'Select';

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('mb-1 block text-sm font-medium text-stone-700', className)} {...props} />;
}

/** Label + control + hint/error, wired up with ids for screen readers. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700 animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-stone-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<'input'> & { label: ReactNode }) {
  return (
    <label className={cn('flex min-h-11 cursor-pointer items-center gap-3 text-sm text-stone-800 group', className)}>
      <input type="checkbox" className="size-5 rounded border-stone-300 accent-brand-700" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('clay rounded-2xl p-4 sm:p-6', className)} {...props} />;
}

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', {
  variants: {
    tone: {
      neutral: 'bg-stone-100 text-stone-700 ring-stone-200',
      success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
      warning: 'bg-amber-50 text-amber-900 ring-amber-200',
      danger: 'bg-red-50 text-red-800 ring-red-200',
      brand: 'bg-brand-50 text-brand-700 ring-brand-200',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Badge({ className, tone, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function Alert({ children, tone = 'danger' }: { children: ReactNode; tone?: 'danger' | 'success' | 'info' | 'warning' }) {
  const styles = {
    danger: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-green-200 bg-green-50 text-green-800',
    info: 'border-stone-200 bg-stone-50 text-stone-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  }[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-xl border px-4 py-3 text-sm animate-scale-in', styles)}>
      {children}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-8 text-sm text-stone-500">
      <span className="size-5 animate-spin rounded-full border-2 border-gold-200 border-t-brand-700 shadow-sm" />
      {label}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-gold-300 bg-white/60 px-6 py-10 text-center text-sm text-stone-600">{children}</p>;
}
