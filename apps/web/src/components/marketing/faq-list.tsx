import { Plus } from 'lucide-react';
import type { Translator } from '@bulava/localization';

/** Frequently asked questions (home and pricing): answers open in place inside one clay card. Numbered home questions, or the page's own. */
export function FaqList({ questions = [], items = [], t }: { questions?: Array<1 | 2 | 3 | 4 | 5 | 6>; items?: Array<{ q: string; a: string }>; t: Translator }) {
  const all = [...items, ...questions.map((n) => ({ q: t(`home.faq.${n}.q`), a: t(`home.faq.${n}.a`) }))];
  return (
    <div className="clay divide-y divide-gold-200/60 overflow-hidden rounded-[2rem]">
      {all.map((item) => (
        <details key={item.q} className="group px-6 py-5 transition-colors duration-300 open:bg-gold-100/25 sm:px-8 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-1 font-display text-xl">
            {item.q}
            <span aria-hidden className="btn-3d btn-3d-light size-10 shrink-0 rounded-full text-brand-700 transition-[rotate,translate,box-shadow] duration-500 group-open:rotate-45">
              <Plus className="size-4" />
            </span>
          </summary>
          <p className="mt-3 pr-12 leading-relaxed text-stone-600">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
