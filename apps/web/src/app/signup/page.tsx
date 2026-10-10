import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Signing up is the same form as signing in (/login): old links keep their next step, plan or template. */
export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') params.set(key, value);
  }
  const query = params.toString();
  redirect(query ? `/login?${query}` : '/login');
}
