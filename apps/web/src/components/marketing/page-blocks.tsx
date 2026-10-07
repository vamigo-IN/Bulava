import Link from 'next/link';
import type { PageBlock, PageInline } from '@bulava/validation';
import { cn } from '@/lib/utils';

const LINK = 'font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 transition-colors duration-300 hover:decoration-brand-700';

function Inline({ nodes }: { nodes: PageInline[] }) {
  return nodes.map((node, i) => {
    if (node.type === 'strong') return <strong key={i} className="font-semibold text-ink">{node.text}</strong>;
    if (node.type === 'text') return node.text;
    if (node.href.startsWith('/') || node.href.startsWith('#')) {
      return (
        <Link key={i} href={node.href} className={LINK}>
          {node.text}
        </Link>
      );
    }
    const external = node.href.startsWith('https://');
    return (
      <a key={i} href={node.href} className={cn(LINK, 'break-words')} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {node.text}
      </a>
    );
  });
}

/**
 * A site page section's text (parsed by `parsePageBody` in @bulava/validation):
 * paragraphs, sub-headings and lists in the page's reading style.
 */
export function PageBlocks({ blocks, className }: { blocks: PageBlock[]; className?: string }) {
  return (
    <div className={cn('space-y-4 text-[1.0625rem] leading-relaxed text-pretty text-stone-700', className)}>
      {blocks.map((block, i) => {
        if (block.type === 'h3') {
          return (
            <h3 key={i} className="pt-3 font-display text-xl text-ink first:pt-0">
              <Inline nodes={block.content} />
            </h3>
          );
        }
        if (block.type === 'p') {
          return (
            <p key={i}>
              <Inline nodes={block.content} />
            </p>
          );
        }
        if (block.type === 'ol') {
          return (
            <ol key={i} className="list-decimal space-y-2.5 pl-7 marker:font-semibold marker:text-gold-600">
              {block.items.map((item, j) => (
                <li key={j} className="pl-1">
                  <Inline nodes={item} />
                </li>
              ))}
            </ol>
          );
        }
        return (
          <ul key={i} className="space-y-2.5 pl-1">
            {block.items.map((item, j) => (
              <li key={j} className="relative pl-7">
                {/* A small gold diamond, the clay system's bullet. */}
                <span aria-hidden="true" className="absolute top-[0.62em] left-1.5 size-2 rotate-45 rounded-[2px] bg-gradient-to-br from-gold-300 to-gold-600 shadow-[0_1px_2px_rgba(122,90,62,0.35)]" />
                <Inline nodes={item} />
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}
