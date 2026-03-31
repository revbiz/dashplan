import { headers } from 'next/headers';

async function getJson() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const baseUrl = host ? `${proto}://${host}` : 'http://localhost:3000';
  const cookie = h.get('cookie') ?? '';

  const res = await fetch(`${baseUrl}/api/fm/test?limit=5`, {
    headers: cookie ? { cookie } : undefined,
    cache: 'no-store',
  });

  const text = await res.text();

  let pretty = text;
  try {
    const parsed = JSON.parse(text) as unknown;
    pretty = JSON.stringify(parsed, null, 2);
  } catch {
    // leave as-is
  }

  return { status: res.status, text: pretty };
}

export default async function TestPage() {
  const { status, text } = await getJson();

  return (
    <main className='min-h-screen p-6'>
      <div className='mx-auto max-w-[1400px] space-y-4'>
        <h1 className='text-2xl font-semibold'>FileMaker JSON Test</h1>
        <p className='text-sm text-neutral-600'>
          GET <code>/api/fm/test?limit=5</code>
        </p>
        <div className='rounded border bg-neutral-50 p-4'>
          <div className='text-sm font-medium'>HTTP {status}</div>
          <pre className='mt-3 max-h-[75vh] overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed'>
            {text}
          </pre>
        </div>
      </div>
    </main>
  );
}
