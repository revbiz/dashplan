'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { formatUsd } from '../../lib/format';

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
const THEME_KEY = 'dashplanThemeSandbox_v1';

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
  const [theme, setTheme] = useState<'a' | 'b' | 'c'>('a');
  const [displayMode, setDisplayMode] = useState<'weeks' | 'summary'>('weeks');
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const didAutoRun = useRef(false);

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

    try {
      const rawTheme = localStorage.getItem(THEME_KEY);
      if (rawTheme === 'a' || rawTheme === 'b' || rawTheme === 'c') {
        setTheme(rawTheme);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

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

  useEffect(() => {
    if (didAutoRun.current) return;
    if (!start || !end) return;
    didAutoRun.current = true;
    void run();
  }, [start, end]);

  const sections = useMemo(() => {
    if (!data || !data.ok) return null;
    return data.noteTypes;
  }, [data]);

  return (
    <main
      className={`min-h-screen p-4 sm:p-6 dp-theme-sandbox ${
        theme === 'a' ? 'dp-theme-a' : theme === 'b' ? 'dp-theme-b' : 'dp-theme-c'
      }`}
    >
      <div className='mx-auto max-w-[1400px] space-y-6'>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div className='space-y-1'>
            <h1 className='text-2xl font-semibold'>NoteType Report</h1>
            <p className='text-sm text-neutral-600'>
              Weekly breakdown by NoteType for the selected date range.
            </p>
          </div>

          <div className='flex overflow-hidden rounded border bg-white'>
            <button
              className={
                theme === 'a'
                  ? 'px-3 py-1 text-xs font-semibold'
                  : 'px-3 py-1 text-xs text-neutral-700'
              }
              type='button'
              onClick={() => setTheme('a')}
            >
              Theme A
            </button>
            <button
              className={
                theme === 'b'
                  ? 'px-3 py-1 text-xs font-semibold'
                  : 'px-3 py-1 text-xs text-neutral-700'
              }
              type='button'
              onClick={() => setTheme('b')}
            >
              Theme B
            </button>
            <button
              className={
                theme === 'c'
                  ? 'px-3 py-1 text-xs font-semibold'
                  : 'px-3 py-1 text-xs text-neutral-700'
              }
              type='button'
              onClick={() => setTheme('c')}
            >
              Theme C
            </button>
          </div>
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
                <div className='dp-nt-header flex flex-col gap-2 border-b bg-neutral-50 px-4 py-3 sm:flex-row sm:items-end sm:justify-between'>
                  <div>
                    <div className='dp-nt-title'>
                      <span className='dp-nt-chip'>
                        <span className='dp-nt-chip-text'>{s.noteType}</span>
                      </span>
                    </div>
                    <div className='text-sm text-neutral-600'>
                      {s.weeks.length} week{s.weeks.length === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div className='grid grid-cols-3 gap-3 text-sm'>
                    <div className='w-[10ch] justify-self-end text-right'>
                      <div className='text-xs text-neutral-600'>Count</div>
                      <div className='tabular-nums text-base font-semibold text-neutral-900'>
                        {s.totals.count.toLocaleString()}
                      </div>
                    </div>
                    <div className='w-[10ch] justify-self-end text-right'>
                      <div className='text-xs text-neutral-600'>Hours</div>
                      <div className='tabular-nums text-base font-semibold text-neutral-900'>
                        {formatNumber(s.totals.totalHours, decimals)}
                      </div>
                    </div>
                    <div className='w-[10ch] justify-self-end text-right'>
                      <div className='text-xs text-neutral-600'>Amount</div>
                      <div className='tabular-nums text-base font-semibold text-neutral-900'>
                        {formatUsd(s.totals.totalAmount)}
                      </div>
                    </div>
                  </div>
                </div>

                {displayMode === 'weeks' ? (
                  <>
                    <div className='space-y-2 p-3 sm:hidden'>
                      {s.weeks.map((w) => (
                        <div
                          key={`${s.noteType}-m-${w.weekStartIso}`}
                          className='rounded border bg-white p-3'
                        >
                          <div className='tabular-nums text-base font-semibold text-neutral-900'>
                            {w.label}
                          </div>
                          <div className='mt-2 grid grid-cols-3 gap-x-3 text-base text-neutral-700'>
                            <div className='tabular-nums'>
                              <span className='font-semibold'>{formatUsd(w.totalAmount)}</span>
                            </div>
                            <div className='tabular-nums text-right'>
                              <span className='text-neutral-500'>Hrs</span>{' '}
                              <span className='font-semibold'>
                                {formatNumber(w.totalHours, decimals)}
                              </span>
                            </div>
                            <div className='tabular-nums text-right'>
                              <span className='text-neutral-500'>Cnt</span>{' '}
                              <span className='font-semibold'>{w.count.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className='hidden overflow-x-auto sm:block'>
                      <table className='w-full min-w-[720px] border-collapse'>
                        <thead>
                          <tr className='dp-table-head border-b bg-white text-left text-sm'>
                            <th className='px-4 py-2 font-medium'>Week</th>
                            <th className='px-4 py-2 font-medium text-right'>Count</th>
                            <th className='px-4 py-2 font-medium text-right'>Hours</th>
                            <th className='px-4 py-2 font-medium text-right'>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.weeks.map((w) => (
                            <tr
                              key={`${s.noteType}-${w.weekStartIso}`}
                              className='dp-row border-b text-sm'
                            >
                              <td className='px-4 py-2 tabular-nums'>{w.label}</td>
                              <td className='px-4 py-2 tabular-nums text-right'>
                                {w.count.toLocaleString()}
                              </td>
                              <td className='px-4 py-2 tabular-nums text-right'>
                                {formatNumber(w.totalHours, decimals)}
                              </td>
                              <td className='px-4 py-2 tabular-nums text-right'>
                                {formatUsd(w.totalAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
              </section>
            ))}
          </div>
        ) : null}
      </div>

      <style jsx global>{`
        .dp-theme-sandbox {
          background: #f8fafc;
          color: #0f172a;
        }

        .dp-theme-a {
          --dp-accent: #4f46e5;
          --dp-accent-soft: #e0e7ff;
        }

        .dp-theme-b {
          --dp-accent: #0284c7;
          --dp-accent-soft: #bae6fd;
        }

        .dp-theme-c {
          --dp-accent: #f59e0b;
          --dp-accent-soft: #fef3c7;
        }

        .dp-theme-sandbox .dp-table-head th {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #475569;
        }

        .dp-theme-sandbox .dp-row:nth-child(odd) {
          background: rgba(241, 245, 249, 0.35);
        }

        .dp-theme-sandbox .dp-row:hover {
          background: rgba(226, 232, 240, 0.55);
        }

        .dp-theme-sandbox .dp-nt-header {
          background-color: rgba(255, 255, 255, 0.72);
          backdrop-filter: saturate(140%) blur(10px);
        }

        .dp-theme-sandbox .dp-nt-title {
          display: flex;
          align-items: center;
        }

        .dp-theme-sandbox .dp-nt-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 15ch;
          max-width: 100%;
          padding: 6px 10px;
          border-radius: 10px;
          background: color-mix(in srgb, var(--dp-accent-soft) 55%, white);
          border: 1px solid color-mix(in srgb, var(--dp-accent) 28%, rgba(148, 163, 184, 0.55));
          color: #0f172a;
          font-weight: 800;
          letter-spacing: 0.01em;
          box-shadow:
            0 1px 0 rgba(15, 23, 42, 0.04),
            inset 0 0 0 1px rgba(255, 255, 255, 0.55);
          cursor: default;
          user-select: text;
          position: relative;
        }

        .dp-theme-sandbox .dp-nt-chip-text {
          display: block;
          width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: center;
        }

        .dp-theme-sandbox .bg-neutral-50 {
          background-color: rgba(255, 255, 255, 0.72);
          backdrop-filter: saturate(140%) blur(10px);
        }

        .dp-theme-sandbox .bg-white {
          background-color: #ffffff;
        }

        .dp-theme-sandbox .border {
          border-color: rgba(148, 163, 184, 0.55);
        }

        .dp-theme-sandbox .text-neutral-600 {
          color: #475569;
        }

        .dp-theme-sandbox .text-neutral-700 {
          color: #334155;
        }

        .dp-theme-sandbox .text-neutral-500 {
          color: #64748b;
        }

        .dp-theme-sandbox .bg-neutral-50 {
          background-color: rgba(255, 255, 255, 0.72);
        }

        .dp-theme-sandbox .bg-neutral-100 {
          background-color: rgba(241, 245, 249, 0.9);
        }

        .dp-theme-sandbox .bg-neutral-200 {
          background-color: rgba(226, 232, 240, 1);
        }

        .dp-theme-a .bg-black {
          background-color: #4f46e5;
        }

        .dp-theme-a .bg-blue-200 {
          background-color: #e0e7ff;
        }

        .dp-theme-a .text-blue-950 {
          color: #1e1b4b;
        }

        .dp-theme-a .bg-neutral-900 {
          background-color: #312e81;
        }

        .dp-theme-b {
          background: linear-gradient(180deg, #ecfeff 0%, #f8fafc 55%, #fff7ed 100%);
        }

        .dp-theme-b .bg-black {
          background-color: #0284c7;
        }

        .dp-theme-b .bg-blue-200 {
          background-color: var(--dp-accent-soft);
        }

        .dp-theme-b .text-blue-950 {
          color: #0c4a6e;
        }

        .dp-theme-b .bg-neutral-900 {
          background-color: #0369a1;
        }

        .dp-theme-b .dp-row:hover {
          background: rgba(186, 230, 253, 0.55);
        }

        .dp-theme-c {
          background: linear-gradient(180deg, #0b1220 0%, #111827 26%, #f8fafc 90%);
        }

        .dp-theme-c .bg-black {
          background-color: #f59e0b;
        }

        .dp-theme-c .text-blue-950 {
          color: #0b1220;
        }

        .dp-theme-c .bg-neutral-900 {
          background-color: #b45309;
        }

        .dp-theme-c .dp-table-head th {
          background-color: color-mix(in srgb, var(--dp-accent-soft) 65%, white);
          color: #0b1220;
        }

        .dp-theme-c .dp-row:hover {
          background: rgba(254, 243, 199, 0.65);
        }
      `}</style>
    </main>
  );
}
