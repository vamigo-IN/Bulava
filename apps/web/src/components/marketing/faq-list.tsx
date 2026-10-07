import { Plus } from 'lucide-react';
import type { Translator } from '@bulava/localization';

/** Frequently asked questions (home and pricing): answers open in place inside one clay card. */
export function FaqList({ questions, t }: { questions: Array<1 | 2 | 3 | 4 | 5 | 6>; t: Translator }) {
  return (
    <div className="clay divide-y divide-gold-200/60 overflow-hidden rounded-[2rem]">
      {questions.map((n) => (
        <details key={n} className="group px-6 py-5 transition-colors duration-300 open:bg-gold-100/25 sm:px-8 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-1 font-display text-xl">
            {t(`home.faq.${n}.q`)}
            <span aria-hidden className="btn-3d btn-3d-light size-10 shrink-0 rounded-full text-brand-700 transition-[rotate,translate,box-shadow] duration-500 group-open:rotate-45">
              <Plus className="size-4" />
            </span>
          </summary>
          <p className="mt-3 pr-12 leading-relaxed text-stone-600">{t(`home.faq.${n}.a`)}</p>
        </details>
      ))}
    </div>
  );
}
