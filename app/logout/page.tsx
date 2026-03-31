'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function doLogout() {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
        }
      } finally {
        try {
          sessionStorage.clear();
        } catch {
          // ignore
        }

        try {
          localStorage.clear();
        } catch {
          // ignore
        }

        router.replace('/login');
      }
    }

    void doLogout();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className='min-h-screen p-6'>
      <div className='mx-auto w-full max-w-md space-y-3'>
        <h1 className='text-xl font-semibold'>Logging out…</h1>
        <p className='text-sm text-neutral-600'>Clearing session and redirecting to login.</p>
        {error ? (
          <div className='rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800'>
            {error}
          </div>
        ) : null}
      </div>
    </main>
  );
}
