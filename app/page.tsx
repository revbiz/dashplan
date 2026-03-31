import Link from 'next/link';

export default function HomePage() {
  return (
    <main className='min-h-screen p-6'>
      <div className='mx-auto max-w-3xl space-y-4'>
        <h1 className='text-2xl font-semibold'>Business Dashboard</h1>
        <p className='text-sm text-neutral-600'>
          Use the login page to access protected test tools.
        </p>
        <div className='flex gap-3'>
          <Link className='underline' href='/login'>
            Login
          </Link>
          <Link className='underline' href='/dashboard'>
            Dashboard
          </Link>
          <Link className='underline' href='/test'>
            Test JSON
          </Link>
          <Link className='underline' href='/preferences'>
            Preferences
          </Link>
        </div>
      </div>
    </main>
  );
}
