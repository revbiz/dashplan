import { NextResponse } from 'next/server';

import { fileMakerFetch, getDatabase, getDefaultLayout } from '@/lib/filemaker';

type FmRecord = {
  fieldData: Record<string, unknown>;
};

type FmFindResponse = {
  response?: {
    dataInfo?: {
      foundCount?: number;
      returnedCount?: number;
      totalRecordCount?: number;
    };
    data?: FmRecord[];
  };
  messages?: Array<{ code: string; message: string }>;
};

function parseIsoDateParam(value: string) {
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(value);
  if (!m) return null;

  const [y, mo, d] = value.split('-').map((p) => Number(p));
  if (!y || !mo || !d) return null;

  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(dt.getTime())) return null;

  return { y, mo, d };
}

function toFileMakerDate(value: string) {
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;

  const iso = parseIsoDateParam(value);
  if (!iso) return null;

  const mm = String(iso.mo).padStart(2, '0');
  const dd = String(iso.d).padStart(2, '0');
  return `${mm}/${dd}/${iso.y}`;
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const startParam = url.searchParams.get('start');
    const endParam = url.searchParams.get('end');

    if (!startParam || !endParam) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing required query params: start, end (YYYY-MM-DD)',
        },
        { status: 400 },
      );
    }

    const start = toFileMakerDate(startParam);
    const end = toFileMakerDate(endParam);

    if (!start || !end) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid date format. Use YYYY-MM-DD (or MM/DD/YYYY).',
        },
        { status: 400 },
      );
    }

    const limit = Math.min(Number(url.searchParams.get('limit') ?? 2000), 5000);

    const db = getDatabase();
    const layout = getDefaultLayout();

    const findBody = {
      query: [{ StartDate: `${start}...${end}` }],
      limit,
    };

    const fmRes = await fileMakerFetch(
      `/fmi/data/vLatest/databases/${encodeURIComponent(
        db,
      )}/layouts/${encodeURIComponent(layout)}/_find`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(findBody),
      },
    );

    const text = await fmRes.text();

    if (!fmRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `FileMaker _find failed (${fmRes.status})`,
          details: text,
        },
        { status: fmRes.status },
      );
    }

    const json = JSON.parse(text) as FmFindResponse;
    const data = json.response?.data ?? [];

    let totalCount = 0;
    let totalHours = 0;
    let totalAmount = 0;
    let billableHours = 0;

    const byName: Record<
      string,
      {
        name: string;
        count: number;
        totalHours: number;
        billableHours: number;
        totalAmount: number;
      }
    > = {};

    for (const rec of data) {
      const nameRaw = rec.fieldData?.Name;
      const name =
        typeof nameRaw === 'string' && nameRaw.trim() !== '' ? nameRaw : 'Unknown';

      const hours = toNumber(rec.fieldData?.LenTime);
      const amount = toNumber(rec.fieldData?.pl_Amount);

      totalCount += 1;
      totalHours += hours;
      totalAmount += amount;
      if (amount > 0) billableHours += hours;

      if (!byName[name]) {
        byName[name] = {
          name,
          count: 0,
          totalHours: 0,
          billableHours: 0,
          totalAmount: 0,
        };
      }

      byName[name].count += 1;
      byName[name].totalHours += hours;
      byName[name].totalAmount += amount;
      if (amount > 0) byName[name].billableHours += hours;
    }

    const rows = Object.values(byName).sort((a, b) => {
      if (b.totalHours !== a.totalHours) return b.totalHours - a.totalHours;
      return a.name.localeCompare(b.name);
    });

    const foundCount = json.response?.dataInfo?.foundCount ?? data.length;

    return NextResponse.json({
      ok: true,
      params: {
        start,
        end,
        limit,
      },
      foundCount,
      totals: {
        totalCount,
        totalHours,
        totalAmount,
        billableHours,
      },
      rows,
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
