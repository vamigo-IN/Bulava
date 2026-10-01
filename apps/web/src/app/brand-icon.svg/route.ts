/** Default favicon (the mandala mark), used until the Super Admin uploads one in Site settings > Branding. */
const petals = Array.from({ length: 8 }, (_, i) => `<path d="M20 6 C23 12 23 15 20 18 C17 15 17 12 20 6Z" transform="rotate(${i * 45} 20 20)"/>`).join('');
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="19" fill="#5b0e1b"/><g fill="none" stroke="#e3c585" stroke-width="1.2">${petals}<circle cx="20" cy="20" r="3" fill="#e3c585"/></g></svg>`;

export const dynamic = 'force-static';

export function GET(): Response {
  return new Response(SVG, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' } });
}
