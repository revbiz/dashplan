'use client';

import { useEffect, useMemo, useState } from 'react';

type DashboardPrefs = {
  defaultStart: string;
  defaultEnd: string;
  roundingHoursDecimals: number;
};

type WeekRow = {
  weekStartIso: string;
  weekEndIso: string;
  label: string;
  count: number;
  totalHours: number;
  totalAmount: number;
};

type NoteTypeSection = {
  noteType: string;
  totals: { count: number; totalHours: number; totalAmount: number };
  weeks: WeekRow[];
};

type ApiResponse =
  | {
      ok: true;
      params: { start: string; end: string; limit: number };
      foundCount: number;
      noteTypes: NoteTypeSection[];
    }
  | {
      ok: false;
      error: string;
      details?: string;
      stack?: string;
    };

const PREFS_KEY = 'dashboardPreferences_v1';
const LAST_RANGE_KEY = 'dashboardLastRange_v1';
const DISPLAY_MODE_KEY = 'reportsNoteTypeDisplayMode_v1';

function formatNumber(n: number, decimals: number) {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return '$0';
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function startOfWeekIso() {
  const d = new Date();
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDefaultPrefs(): DashboardPrefs {
  return {
    defaultStart: startOfWeekIso(),
    defaultEnd: todayIso(),
    roundingHoursDecimals: 2,
  };
}

function loadPrefs(): DashboardPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return getDefaultPrefs();
    const parsed = JSON.parse(raw) as Partial<DashboardPrefs>;
    const base = getDefaultPrefs();

    return {
      defaultStart:
        typeof parsed.defaultStart === 'string' ? parsed.defaultStart : base.defaultStart,
      defaultEnd: typeof parsed.defaultEnd === 'string' ? parsed.defaultEnd : base.defaultEnd,
      roundingHoursDecimals:
        typeof parsed.roundingHoursDecimals === 'number'
          ? parsed.roundingHoursDecimals
          : base.roundingHoursDecimals,
    };
  } catch {
    return getDefaultPrefs();
  }
}

function loadLastRange(): { start: string; end: string } | null {
  try {
    const raw = localStorage.getItem(LAST_RANGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { start?: unknown; end?: unknown };
    if (typeof parsed.start !== 'string' || typeof parsed.end !== 'string') {
      return null;
    }
    return { start: parsed.start, end: parsed.end };
  } catch {
    return null;
  }
}

function saveLastRange(range: { start: string; end: string }) {
  localStorage.setItem(LAST_RANGE_KEY, JSON.stringify(range));
}

export default function ReportsNoteTypePage() {
  const [prefs, setPrefs] = useState<DashboardPrefs | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [displayMode, setDisplayMode] = useState<'weeks' | 'summary'>('weeks');
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    const p = loadPrefs();
    const last = loadLastRange();
    setPrefs(p);
    setStart(last?.start ?? p.defaultStart);
    setEnd(last?.end ?? p.defaultEnd);

    try {
      const raw = localStorage.getItem(DISPLAY_MODE_KEY);
      if (raw === 'summary' || raw === 'weeks') {
        setDisplayMode(raw);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DISPLAY_MODE_KEY, displayMode);
    } catch {
      // ignore
    }
  }, [displayMode]);

  const decimals = prefs?.roundingHoursDecimals ?? 2;

  async function run() {
    setIsLoading(true);
    setData(null);

    saveLastRange({ start, end });

    try {
      const res = await fetch(
        `/api/reports/notetype-by-week?start=${encodeURIComponent(
          start,
        )}&end=${encodeURIComponent(end)}`,
        { cache: 'no-store' },
      );

      const json = (await res.json()) as ApiResponse;

      if (!res.ok && json && typeof json === 'object' && 'ok' in json) {
        setData(json);
        return;
      }

      setData(json);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setData({ ok: false, error: message });
    } finally {
      setIsLoading(false);
    }
  }

  const sections = useMemo(() => {
    if (!data || !data.ok) return null;
    return data.noteTypes;
  }, [data]);

  return (
    <main className='min-h-screen p-4 sm:p-6'>
      <div className='mx-auto max-w-[1400px] space-y-6'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-semibold'>NoteType Report</h1>
          <p className='text-sm text-neutral-600'>
            Weekly breakdown by NoteType for the selected date range.
          </p>
        </div>

        <section className='rounded border bg-neutral-50 p-4'>
          <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
            <div className='grid gap-4 sm:grid-cols-3'>
              <div className='flex flex-col gap-1'>
                <label className='text-sm font-medium' htmlFor='start'>
                  Start
                </label>
                <input
                  className='w-full rounded border bg-white px-2 py-1 text-sm sm:w-[180px]'
                  id='start'
                  type='date'
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>

              <div className='flex flex-col gap-1'>
                <label className='text-sm font-medium' htmlFor='end'>
                  End
                </label>
                <input
                  className='w-full rounded border bg-white px-2 py-1 text-sm sm:w-[180px]'
                  id='end'
                  type='date'
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>

              <div className='flex flex-col gap-1'>
                <div className='text-sm font-medium text-transparent'>Run</div>
                <button
                  className='w-full rounded bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 sm:w-auto'
                  type='button'
                  onClick={run}
                  disabled={isLoading || !start || !end}
                >
                  {isLoading ? 'Running…' : 'Run'}
                </button>
              </div>
            </div>

            {data && data.ok ? (
              <div className='text-sm text-neutral-700'>
                Found {data.foundCount.toLocaleString()} records
              </div>
            ) : null}
          </div>

          <div className='mt-4 flex flex-wrap items-center gap-2'>
            <button
              className={
                displayMode === 'weeks'
                  ? 'rounded border bg-white px-3 py-2 text-sm font-medium'
                  : 'rounded border bg-transparent px-3 py-2 text-sm text-neutral-700'
              }
              type='button'
              onClick={() => setDisplayMode('weeks')}
            >
              Show weeks
            </button>
            <button
              className={
                displayMode === 'summary'
                  ? 'rounded border bg-white px-3 py-2 text-sm font-medium'
                  : 'rounded border bg-transparent px-3 py-2 text-sm text-neutral-700'
              }
              type='button'
              onClick={() => setDisplayMode('summary')}
            >
              Summary only
            </button>
          </div>

          {data && !data.ok ? (
            <div className='mt-4 rounded border border-red-200 bg-white p-3 text-sm text-red-700'>
              <div className='font-medium'>Error</div>
              <div className='mt-1 whitespace-pre-wrap break-words'>{data.error}</div>
              {data.details ? (
                <pre className='mt-2 max-h-[30vh] overflow-auto whitespace-pre-wrap break-words text-xs text-red-800'>
                  {data.details}
                </pre>
              ) : null}
            </div>
          ) : null}
        </section>

        {sections ? (
          <div className='space-y-6'>
            {sections.length === 0 ? (
              <div className='text-sm text-neutral-600'>No results.</div>
            ) : null}

            {sections.map((s) => (
              <section key={s.noteType} className='rounded border bg-white'>
                <div className='flex flex-col gap-2 border-b bg-neutral-50 px-4 py-3 sm:flex-row sm:items-end sm:justify-between'>
                  <div>
                    <div className='text-base font-semibold'>{s.noteType}</div>
                    <div className='text-sm text-neutral-600'>
                      {s.weeks.length} week{s.weeks.length === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div className='grid grid-cols-3 gap-3 text-sm'>
                    <div>
                      <div className='text-xs text-neutral-600'>Count</div>
                      <div className='tabular-nums'>
                        {s.totals.count.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className='text-xs text-neutral-600'>Hours</div>
                      <div className='tabular-nums'>
                        {formatNumber(s.totals.totalHours, decimals)}
                      </div>
                    </div>
                    <div>
                      <div className='text-xs text-neutral-600'>Amount</div>
                      <div className='tabular-nums'>
                        {formatMoney(s.totals.totalAmount)}
                      </div>
                    </div>
                  </div>
                </div>

                {displayMode === 'weeks' ? (
                  <div className='overflow-x-auto'>
                    <table className='w-full min-w-[720px] border-collapse'>
                      <thead>
                        <tr className='border-b bg-white text-left text-sm'>
                          <th className='px-4 py-2 font-medium'>Week</th>
                          <th className='px-4 py-2 font-medium'>Count</th>
                          <th className='px-4 py-2 font-medium'>Hours</th>
                          <th className='px-4 py-2 font-medium'>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.weeks.map((w) => (
                          <tr key={`${s.noteType}-${w.weekStartIso}`} className='border-b text-sm'>
                            <td className='px-4 py-2 tabular-nums'>{w.label}</td>
                            <td className='px-4 py-2 tabular-nums'>
                              {w.count.toLocaleString()}
                            </td>
                            <td className='px-4 py-2 tabular-nums'>
                              {formatNumber(w.totalHours, decimals)}
                            </td>
                            <td className='px-4 py-2 tabular-nums'>
                              {formatMoney(w.totalAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}
