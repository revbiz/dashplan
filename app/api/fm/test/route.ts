import { NextResponse } from 'next/server';

import { fileMakerFetch, getDatabase, getDefaultLayout } from '@/lib/filemaker';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 5), 50);

    const db = getDatabase();
    const layout = getDefaultLayout();

    const fmRes = await fileMakerFetch(
      `/fmi/data/vLatest/databases/${encodeURIComponent(
        db,
      )}/layouts/${encodeURIComponent(layout)}/records?_limit=${limit}`,
      {
        method: 'GET',
      },
    );

    const text = await fmRes.text();

    return new NextResponse(text, {
      status: fmRes.status,
      headers: {
        'Content-Type': fmRes.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;

    return NextResponse.json(
      {
        ok: false,
        error: message,
        stack,
      },
      { status: 500 },
    );
  }
}
