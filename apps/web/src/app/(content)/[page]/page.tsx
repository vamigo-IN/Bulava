import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { PAGES } from '@/content/pages';

export function generateStaticParams() {
  return Object.keys(PAGES).map((page) => ({ page }));
}

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }): Promise<Metadata> {
  const { page } = await params;
  const content = PAGES[page];
  return content ? { title: content.title, description: content.description, alternates: { canonical: `/${page}` } } : {};
}

export default async function ContentRoute({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const content = PAGES[page];
  if (!content) notFound();
  return (
    <>
      <SiteHeader />
      <main className="relative isolate min-h-dvh bg-ivory">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_55%_70%_at_50%_0%,rgba(227,197,133,0.3),transparent_70%)]" />
        <article className="mx-auto max-w-3xl px-4 pt-16 pb-28 sm:px-6 sm:pt-24">
          <header className="border-b border-gold-200/80 pb-10 text-center">
            <h1 className="font-display text-5xl leading-[1.05] tracking-tight text-balance sm:text-6xl">{content.title}</h1>
            <p className="mt-4 text-sm text-stone-500">Last updated {new Date(content.updated).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </header>
          <div className="mt-12 space-y-12">
            {content.sections.map((s) => (
              <section key={s.heading}>
                <h2 className="font-display text-3xl tracking-tight">{s.heading}</h2>
                <div className="mt-4 space-y-4 text-[1.0625rem] leading-relaxed text-pretty text-stone-700">
                  {s.body.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
