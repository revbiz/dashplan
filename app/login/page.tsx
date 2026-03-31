import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getAuthCookieName, getExpectedCookieValue, isValidPassword } from '@/lib/auth';

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; error?: string }>;
}) {
  const sp = (await searchParams) ?? {};

  async function login(formData: FormData) {
    'use server';

    const password = String(formData.get('password') ?? '');
    if (!isValidPassword(password)) {
      redirect('/login?error=1');
    }

    const expected = getExpectedCookieValue();
    if (!expected) {
      redirect('/login?error=1');
    }

    const cookieName = getAuthCookieName();
    const cookieStore = await cookies();

    cookieStore.set(cookieName, expected, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    });

    const nextPath = sp.next;
    redirect(nextPath && nextPath.startsWith('/') ? nextPath : '/dashboard');
  }

  const hasError = sp.error === '1';

  return (
    <main className='min-h-screen p-6'>
      <div className='mx-auto w-full max-w-sm space-y-4'>
        <h1 className='text-xl font-semibold'>Login</h1>
        {hasError ? (
          <div className='rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800'>
            Invalid password.
          </div>
        ) : null}
        <form action={login} className='space-y-3'>
          <input
            className='w-full rounded border px-3 py-2'
            name='password'
            type='password'
            placeholder='Dashboard password'
          />
          <button className='rounded bg-black px-3 py-2 text-white' type='submit'>
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
