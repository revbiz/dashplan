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

function parseFileMakerDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!m) return null;
  const mo = Number(m[1]);
  const d = Number(m[2]);
  const y = Number(m[3]);
  if (!y || !mo || !d) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toIso(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysUtc(d: Date, days: number) {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function startOfWeekMondayUtc(d: Date) {
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  return addDaysUtc(d, -diff);
}

function weekLabel(weekStart: Date, weekEnd: Date) {
  const s = weekStart.toLocaleDateString(undefined, {
    year: '2-digit',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const e = weekEnd.toLocaleDateString(undefined, {
    year: '2-digit',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return `${s} - ${e}`;
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

    const limit = Math.min(Number(url.searchParams.get('limit') ?? 5000), 10000);

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

    type WeekAgg = {
      weekStartIso: string;
      weekEndIso: string;
      label: string;
      count: number;
      totalHours: number;
      totalAmount: number;
    };

    const byNoteType: Record<string, Record<string, WeekAgg>> = {};

    for (const rec of data) {
      const noteTypeRaw = rec.fieldData?.NoteType ?? rec.fieldData?.NoteType_c;
      const noteType =
        typeof noteTypeRaw === 'string' && noteTypeRaw.trim() !== ''
          ? noteTypeRaw
          : 'Unknown';

      const startDate = parseFileMakerDate(rec.fieldData?.StartDate);
      if (!startDate) continue;

      const weekStart = startOfWeekMondayUtc(startDate);
      const weekEnd = addDaysUtc(weekStart, 6);
      const key = toIso(weekStart);

      const hours = toNumber(rec.fieldData?.LenTime);
      const amount = toNumber(rec.fieldData?.pl_Amount);

      if (!byNoteType[noteType]) byNoteType[noteType] = {};
      if (!byNoteType[noteType][key]) {
        byNoteType[noteType][key] = {
          weekStartIso: toIso(weekStart),
          weekEndIso: toIso(weekEnd),
          label: weekLabel(weekStart, weekEnd),
          count: 0,
          totalHours: 0,
          totalAmount: 0,
        };
      }

      byNoteType[noteType][key].count += 1;
      byNoteType[noteType][key].totalHours += hours;
      byNoteType[noteType][key].totalAmount += amount;
    }

    const noteTypes = Object.entries(byNoteType)
      .map(([noteType, weeksObj]) => {
        const weeks = Object.values(weeksObj).sort((a, b) =>
          a.weekStartIso.localeCompare(b.weekStartIso),
        );

        const totals = weeks.reduce(
          (acc, w) => {
            acc.count += w.count;
            acc.totalHours += w.totalHours;
            acc.totalAmount += w.totalAmount;
            return acc;
          },
          { count: 0, totalHours: 0, totalAmount: 0 },
        );

        return { noteType, totals, weeks };
      })
      .sort((a, b) => {
        if (b.totals.totalHours !== a.totals.totalHours) {
          return b.totals.totalHours - a.totals.totalHours;
        }
        return a.noteType.localeCompare(b.noteType);
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
      noteTypes,
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
