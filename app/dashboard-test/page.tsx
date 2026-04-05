'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import { formatUsd } from '../../lib/format';

type Row = {
  noteType: string;
  count: number;
  totalHours: number;
  totalAmount: number;
};

type ApiResponse =
  | {
      ok: true;
      params: { start: string; end: string; limit: number };
      foundCount: number;
      totals: {
        totalCount: number;
        totalHours: number;
        totalAmount: number;
        billableHours: number;
      };
      rows: Row[];
    }
  | {
      ok: false;
      error: string;
      details?: string;
    };

type NameRow = {
  name: string;
  count: number;
  totalHours: number;
  billableHours: number;
  totalAmount: number;
};

type NameApiResponse =
  | {
      ok: true;
      params: { start: string; end: string; limit: number };
      foundCount: number;
      totals: {
        totalCount: number;
        totalHours: number;
        totalAmount: number;
        billableHours: number;
      };
      rows: NameRow[];
    }
  | {
      ok: false;
      error: string;
      details?: string;
    };

type DashboardPrefs = {
  defaultStart: string;
  defaultEnd: string;
  roundingHoursDecimals: number;
};

const PREFS_KEY = 'dashboardPreferences_v1';
const LAST_RANGE_KEY = 'dashboardLastRange_v1';
const THEME_KEY = 'dashplanThemeSandbox_v1';

function formatNumber(n: number, decimals: number) {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function startOfMonthIso(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}

function daysBetweenInclusive(startIso: string, endIso: string) {
  const a = new Date(`${startIso}T00:00:00`).getTime();
  const b = new Date(`${endIso}T00:00:00`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  const diff = Math.floor((b - a) / (24 * 60 * 60 * 1000));
  return diff >= 0 ? diff + 1 : 0;
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

export default function DashboardPage() {
  const [prefs, setPrefs] = useState<DashboardPrefs | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [theme, setTheme] = useState<'a' | 'b' | 'c'>('a');
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [nameData, setNameData] = useState<NameApiResponse | null>(null);
  const didAutoRun = useRef(false);

  useEffect(() => {
    const p = loadPrefs();
    const last = loadLastRange();
    setPrefs(p);
    setStart(last?.start ?? p.defaultStart);
    setEnd(last?.end ?? p.defaultEnd);

    try {
      const raw = localStorage.getItem(THEME_KEY);
      if (raw === 'a' || raw === 'b' || raw === 'c') {
        setTheme(raw);
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

  const totals = useMemo(() => {
    if (!data || !data.ok) return null;
    return data.totals;
  }, [data]);

  const avgHoursPerDay = useMemo(() => {
    if (!totals) return null;
    const days = daysBetweenInclusive(start, end);
    if (days <= 0) return null;
    return totals.totalHours / days;
  }, [totals, start, end]);

  async function run() {
    setIsLoading(true);
    setData(null);
    setNameData(null);

    saveLastRange({ start, end });

    try {
      const [noteTypeRes, nameRes] = await Promise.all([
        fetch(
          `/api/dashboard/notetype-by-date-range?start=${encodeURIComponent(
            start,
          )}&end=${encodeURIComponent(end)}`,
          { cache: 'no-store' },
        ),
        fetch(
          `/api/dashboard/name-by-date-range?start=${encodeURIComponent(
            start,
          )}&end=${encodeURIComponent(end)}`,
          { cache: 'no-store' },
        ),
      ]);

      const json = (await noteTypeRes.json()) as ApiResponse;
      const json2 = (await nameRes.json()) as NameApiResponse;
      setData(json);
      setNameData(json2);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setData({ ok: false, error: message });
      setNameData({ ok: false, error: message });
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

  const decimals = prefs?.roundingHoursDecimals ?? 2;

  const topNamesByHours = useMemo(() => {
    if (!nameData || !nameData.ok) return null;
    return [...nameData.rows]
      .sort((a, b) => b.totalHours - a.totalHours)
      .slice(0, 10);
  }, [nameData]);

  const topNamesByAmount = useMemo(() => {
    if (!nameData || !nameData.ok) return null;
    return [...nameData.rows]
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);
  }, [nameData]);

  const topNoteTypesByHours = useMemo(() => {
    if (!data || !data.ok) return null;
    return [...data.rows].sort((a, b) => b.totalHours - a.totalHours).slice(0, 10);
  }, [data]);

  const topNoteTypesByAmount = useMemo(() => {
    if (!data || !data.ok) return null;
    return [...data.rows]
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);
  }, [data]);

  const topNamesByHoursForChart = useMemo(() => {
    if (!nameData || !nameData.ok) return null;
    return [...nameData.rows]
      .sort((a, b) => b.totalHours - a.totalHours)
      .slice(0, 10);
  }, [nameData]);

  function maxValue(items: Array<{ value: number }>) {
    return items.reduce((m, i) => Math.max(m, i.value), 0);
  }

  function setRange(nextStart: string, nextEnd: string) {
    setStart(nextStart);
    setEnd(nextEnd);
  }

  async function applyQuickRange(kind: 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'last30') {
    const today = todayIso();

    if (kind === 'thisWeek') {
      const s = startOfWeekIso();
      setRange(s, today);
      await Promise.resolve();
      return;
    }

    if (kind === 'lastWeek') {
      const thisWeekStart = startOfWeekIso();
      const lastWeekStart = addDaysIso(thisWeekStart, -7);
      const lastWeekEnd = addDaysIso(thisWeekStart, -1);
      setRange(lastWeekStart, lastWeekEnd);
      await Promise.resolve();
      return;
    }

    if (kind === 'thisMonth') {
      const s = startOfMonthIso(today);
      setRange(s, today);
      await Promise.resolve();
      return;
    }

    if (kind === 'lastMonth') {
      const thisMonthStart = startOfMonthIso(today);
      const lastMonthEnd = addDaysIso(thisMonthStart, -1);
      const lastMonthStart = startOfMonthIso(lastMonthEnd);
      setRange(lastMonthStart, lastMonthEnd);
      await Promise.resolve();
      return;
    }

    const s = addDaysIso(today, -29);
    setRange(s, today);
    await Promise.resolve();
  }

  async function applyQuickRangeAndRun(kind: 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'last30') {
    await applyQuickRange(kind);
    await new Promise((r) => setTimeout(r, 0));
    await run();
  }

  return (
    <main
      className={`min-h-screen p-4 sm:p-6 dp-theme-sandbox ${
        theme === 'a' ? 'dp-theme-a' : theme === 'b' ? 'dp-theme-b' : 'dp-theme-c'
      }`}
    >
      <div className='mx-auto max-w-[1400px] space-y-6'>
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div className='space-y-1'>
            <h1 className='text-2xl font-semibold'>Dashboard</h1>
            <p className='text-sm text-neutral-600'>
              NoteType totals for a selected date range.
            </p>
          </div>

          <div className='flex flex-wrap items-center gap-2 text-sm'>
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
            <Link className='underline' href='/preferences'>
              Preferences
            </Link>
          </div>
        </div>

        {totals ? (
          <section className='grid gap-3 sm:grid-cols-2 md:grid-cols-5'>
            <div className='rounded border bg-neutral-50 p-4 text-center sm:text-left'>
              <div className='text-xs text-neutral-600'>Records</div>
              <div className='mt-1 text-lg font-semibold tabular-nums'>
                {totals.totalCount.toLocaleString()}
              </div>
            </div>
            <div className='rounded border bg-neutral-50 p-4 text-center sm:text-left'>
              <div className='text-xs text-neutral-600'>Total Hours</div>
              <div className='mt-1 text-lg font-semibold tabular-nums'>
                {formatNumber(totals.totalHours, decimals)}
              </div>
            </div>
            <div className='rounded border bg-neutral-50 p-4 text-center sm:text-left'>
              <div className='text-xs text-neutral-600'>Billable Hours</div>
              <div className='mt-1 text-lg font-semibold tabular-nums'>
                {formatNumber(totals.billableHours, decimals)}
              </div>
            </div>
            <div className='rounded border bg-neutral-50 p-4 text-center sm:text-left'>
              <div className='text-xs text-neutral-600'>Billable Amount</div>
              <div className='mt-1 text-lg font-semibold tabular-nums'>
                {formatUsd(totals.totalAmount)}
              </div>
            </div>
            <div className='rounded border bg-neutral-50 p-4 text-center sm:text-left'>
              <div className='text-xs text-neutral-600'>Avg Hours / Day</div>
              <div className='mt-1 text-lg font-semibold tabular-nums'>
                {avgHoursPerDay === null
                  ? '—'
                  : formatNumber(avgHoursPerDay, decimals)}
              </div>
            </div>
          </section>
        ) : null}

        <section className='rounded border bg-neutral-50 p-4'>
          <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
            <div className='flex flex-wrap gap-2'>
              <button
                className='rounded border bg-white px-2 py-1 text-xs font-medium disabled:opacity-50'
                type='button'
                onClick={() => applyQuickRangeAndRun('thisWeek')}
                disabled={isLoading}
              >
                This week
              </button>
              <button
                className='rounded border bg-white px-2 py-1 text-xs font-medium disabled:opacity-50'
                type='button'
                onClick={() => applyQuickRangeAndRun('lastWeek')}
                disabled={isLoading}
              >
                Last week
              </button>
              <button
                className='rounded border bg-white px-2 py-1 text-xs font-medium disabled:opacity-50'
                type='button'
                onClick={() => applyQuickRangeAndRun('thisMonth')}
                disabled={isLoading}
              >
                This month
              </button>
              <button
                className='rounded border bg-white px-2 py-1 text-xs font-medium disabled:opacity-50'
                type='button'
                onClick={() => applyQuickRangeAndRun('lastMonth')}
                disabled={isLoading}
              >
                Last month
              </button>
              <button
                className='rounded border bg-white px-2 py-1 text-xs font-medium disabled:opacity-50'
                type='button'
                onClick={() => applyQuickRangeAndRun('last30')}
                disabled={isLoading}
              >
                Last 30 days
              </button>
            </div>

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
                <div className='text-sm font-medium text-transparent'>
                  Run
                </div>
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

          {data && data.ok ? (
            <>
              <div className='mt-4'>
                <div className='dp-h2'>Note Type Summary</div>
                <div className='mt-1 text-xs text-neutral-600'>
                  Breakdown of notes by type — total items, total hours, and total amount.
                </div>
              </div>

              <div className='mt-4 space-y-2 sm:hidden'>
                {data.rows.map((r) => (
                  <div key={`nt-m-${r.noteType}`} className='rounded border bg-white p-3'>
                    <div className='flex justify-center'>
                      <span className='dp-nt-label'>
                        <span className='dp-nt-label-text'>{r.noteType}</span>
                      </span>
                    </div>
                    <div className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-base text-neutral-700'>
                      <div className='tabular-nums'>
                        <span className='text-neutral-500'>Cnt</span>{' '}
                        <span className='font-semibold'>
                          {r.count.toLocaleString()}
                        </span>
                      </div>
                      <div className='tabular-nums'>
                        <span className='text-neutral-500'>Hrs</span>{' '}
                        <span className='font-semibold'>
                          {formatNumber(r.totalHours, decimals)}
                        </span>
                      </div>
                      <div className='tabular-nums'>
                        <span className='text-neutral-500'>Amt</span>{' '}
                        <span className='font-semibold'>
                          {formatUsd(r.totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {totals ? (
                  <div className='rounded border bg-neutral-50 p-3'>
                    <div className='text-lg font-medium text-neutral-900'>Totals</div>
                    <div className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-base text-neutral-700'>
                      <div className='tabular-nums'>
                        <span className='text-neutral-500'>Cnt</span>{' '}
                        <span className='font-semibold'>
                          {totals.totalCount.toLocaleString()}
                        </span>
                      </div>
                      <div className='tabular-nums'>
                        <span className='text-neutral-500'>Hrs</span>{' '}
                        <span className='font-semibold'>
                          {formatNumber(totals.totalHours, decimals)}
                        </span>
                      </div>
                      <div className='tabular-nums'>
                        <span className='text-neutral-500'>Amt</span>{' '}
                        <span className='font-semibold'>
                          {formatUsd(totals.totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className='mt-4 hidden overflow-auto rounded-lg border bg-white shadow-sm sm:block'>
                <table className='dp-table w-full min-w-[520px] text-left text-sm'>
                  <thead className='dp-table-head border-b bg-neutral-100'>
                    <tr>
                      <th className='px-3 py-2 font-medium'>NoteType</th>
                      <th className='px-3 py-2 font-medium text-right'>Count</th>
                      <th className='px-3 py-2 font-medium text-right'>Hours</th>
                      <th className='px-3 py-2 font-medium text-right'>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.noteType} className='border-b last:border-b-0'>
                        <td className='px-3 py-2 text-center'>
                          <span className='dp-nt-label'>
                            <span className='dp-nt-label-text'>{r.noteType}</span>
                          </span>
                        </td>
                        <td className='px-3 py-2 tabular-nums text-right'>
                          {r.count.toLocaleString()}
                        </td>
                        <td className='px-3 py-2 tabular-nums text-right'>
                          {formatNumber(r.totalHours, decimals)}
                        </td>
                        <td className='px-3 py-2 tabular-nums text-right'>
                          {formatUsd(r.totalAmount)}
                        </td>
                      </tr>
                    ))}

                    {totals ? (
                      <tr className='bg-neutral-50'>
                        <td className='px-3 py-2 font-medium'>Totals</td>
                        <td className='px-3 py-2 font-medium tabular-nums text-right'>
                          {totals.totalCount.toLocaleString()}
                        </td>
                        <td className='px-3 py-2 font-medium tabular-nums text-right'>
                          {formatNumber(totals.totalHours, decimals)}
                        </td>
                        <td className='px-3 py-2 font-medium tabular-nums text-right'>
                          {formatUsd(totals.totalAmount)}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {prefs ? (
            <div className='mt-3 text-xs text-neutral-600'>
              Defaults loaded from preferences: {prefs.defaultStart} → {prefs.defaultEnd}
            </div>
          ) : null}
        </section>

        {topNoteTypesByHours && topNoteTypesByAmount && topNamesByHoursForChart ? (
          <section className='grid gap-4 lg:grid-cols-2'>
            <div className='rounded border bg-neutral-50 p-4'>
              <div className='text-lg font-semibold sm:text-sm sm:font-medium'>
                Chart: Hours by NoteType
              </div>
              <div className='mt-3 space-y-2'>
                {(() => {
                  const items = topNoteTypesByHours.map((r) => ({
                    label: r.noteType,
                    value: r.totalHours,
                  }));
                  const max = maxValue(items);

                  return items.map((it) => (
                    <div key={`nt-hours-${it.label}`} className='space-y-1'>
                      <div className='flex items-baseline justify-between gap-3'>
                        <div className='truncate text-base font-medium text-neutral-700 sm:text-xs sm:font-normal'>
                          {it.label}
                        </div>
                        <div className='shrink-0 text-base font-semibold tabular-nums text-neutral-700 sm:text-xs sm:font-normal'>
                          {formatNumber(it.value, decimals)}
                        </div>
                      </div>
                      <div className='h-2 w-full rounded bg-neutral-200'>
                        <div
                          className='h-2 rounded bg-neutral-900'
                          style={{ width: `${max === 0 ? 0 : (it.value / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            <div className='rounded border bg-neutral-50 p-4'>
              <div className='text-lg font-semibold sm:text-sm sm:font-medium'>
                Chart: Amount by NoteType
              </div>
              <div className='mt-3 space-y-2'>
                {(() => {
                  const items = topNoteTypesByAmount.map((r) => ({
                    label: r.noteType,
                    value: r.totalAmount,
                  }));
                  const max = maxValue(items);

                  return items.map((it) => (
                    <div key={`nt-amt-${it.label}`} className='space-y-1'>
                      <div className='flex items-baseline justify-between gap-3'>
                        <div className='truncate text-base font-medium text-neutral-700 sm:text-xs sm:font-normal'>
                          {it.label}
                        </div>
                        <div className='shrink-0 text-base font-semibold tabular-nums text-neutral-700 sm:text-xs sm:font-normal'>
                          {formatUsd(it.value)}
                        </div>
                      </div>
                      <div className='h-2 w-full rounded bg-neutral-200'>
                        <div
                          className='h-2 rounded bg-neutral-900'
                          style={{ width: `${max === 0 ? 0 : (it.value / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            <div className='rounded border bg-neutral-50 p-4 lg:col-span-2'>
              <div className='dp-h2-sm'>Chart: Hours by Name</div>
              <div className='mt-3 grid gap-2 md:grid-cols-2'>
                {(() => {
                  const items = topNamesByHoursForChart.map((r) => ({
                    label: r.name,
                    value: r.totalHours,
                  }));
                  const max = maxValue(items);

                  return items.map((it) => (
                    <div key={`name-hours-${it.label}`} className='space-y-1'>
                      <div className='flex items-baseline justify-between gap-3'>
                        <div className='truncate text-xs text-neutral-700'>
                          {it.label}
                        </div>
                        <div className='shrink-0 text-xs tabular-nums text-neutral-700'>
                          {formatNumber(it.value, decimals)}
                        </div>
                      </div>
                      <div className='h-2 w-full rounded bg-neutral-200'>
                        <div
                          className='h-2 rounded bg-neutral-900'
                          style={{ width: `${max === 0 ? 0 : (it.value / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </section>
        ) : null}

        {nameData && !nameData.ok ? (
          <section className='rounded border border-red-200 bg-white p-4 text-sm text-red-700'>
            <div className='font-medium'>Name breakdown error</div>
            <div className='mt-1 whitespace-pre-wrap break-words'>{nameData.error}</div>
            {nameData.details ? (
              <pre className='mt-2 max-h-[30vh] overflow-auto whitespace-pre-wrap break-words text-xs text-red-800'>
                {nameData.details}
              </pre>
            ) : null}
          </section>
        ) : null}

        {topNamesByHours && topNamesByAmount ? (
          <section className='grid gap-4 lg:grid-cols-2'>
            <div className='rounded border bg-neutral-50 p-4'>
              <div className='dp-h2-sm'>Top Names (by hours)</div>
              <div className='mt-3 space-y-2 sm:hidden'>
                {topNamesByHours.map((r) => (
                  <div key={`hours-m-${r.name}`} className='rounded border bg-white p-3'>
                    <div className='truncate text-lg font-medium text-neutral-900'>
                      {r.name}
                    </div>
                    <div className='mt-2 space-y-1 text-base text-neutral-700'>
                      <div className='grid grid-cols-2 gap-x-4'>
                        <div className='tabular-nums'>
                          <span className='text-neutral-500'>Hrs</span>{' '}
                          <span className='font-semibold'>
                            {formatNumber(r.totalHours, decimals)}
                          </span>
                        </div>
                        <div className='tabular-nums text-right'>
                          <span className='text-neutral-500'>Bill</span>{' '}
                          <span className='font-semibold'>
                            {formatNumber(r.billableHours, decimals)}
                          </span>
                        </div>
                      </div>

                      <div className='grid grid-cols-2 gap-x-4'>
                        <div className='tabular-nums'>
                          <span className='text-neutral-500'>Amt</span>{' '}
                          <span className='font-semibold'>
                            {formatUsd(r.totalAmount)}
                          </span>
                        </div>
                        <div className='tabular-nums text-right'>
                          <span className='text-neutral-500'>Cnt</span>{' '}
                          <span className='font-semibold'>
                            {r.count.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className='mt-3 hidden overflow-x-auto rounded border bg-white sm:block'>
                <table className='w-full min-w-[720px] text-left text-sm'>
                  <thead className='border-b bg-neutral-100'>
                    <tr>
                      <th className='px-3 py-2 font-medium'>Name</th>
                      <th className='px-3 py-2 font-medium text-right'>Hours</th>
                      <th className='px-3 py-2 font-medium text-right'>Count</th>
                      <th className='px-3 py-2 font-medium text-right'>Billable Hours</th>
                      <th className='px-3 py-2 font-medium text-right'>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topNamesByHours.map((r) => (
                      <tr key={`hours-${r.name}`} className='border-b last:border-b-0'>
                        <td className='px-3 py-2'>{r.name}</td>
                        <td className='px-3 py-2 tabular-nums text-right'>
                          {formatNumber(r.totalHours, decimals)}
                        </td>
                        <td className='px-3 py-2 tabular-nums text-right'>
                          {r.count.toLocaleString()}
                        </td>
                        <td className='px-3 py-2 tabular-nums text-right'>
                          {formatNumber(r.billableHours, decimals)}
                        </td>
                        <td className='px-3 py-2 tabular-nums text-right'>
                          {formatUsd(r.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className='rounded border bg-neutral-50 p-4'>
              <div className='dp-h2-sm'>Top Names (by amount)</div>
              <div className='mt-3 space-y-2 sm:hidden'>
                {topNamesByAmount.map((r) => (
                  <div key={`amount-m-${r.name}`} className='rounded border bg-white p-3'>
                    <div className='truncate text-lg font-medium text-neutral-900'>
                      {r.name}
                    </div>
                    <div className='mt-2 space-y-1 text-base text-neutral-700'>
                      <div className='grid grid-cols-2 gap-x-4'>
                        <div className='tabular-nums'>
                          <span className='text-neutral-500'>Hrs</span>{' '}
                          <span className='font-semibold'>
                            {formatNumber(r.totalHours, decimals)}
                          </span>
                        </div>
                        <div className='tabular-nums text-right'>
                          <span className='text-neutral-500'>Bill</span>{' '}
                          <span className='font-semibold'>
                            {formatNumber(r.billableHours, decimals)}
                          </span>
                        </div>
                      </div>

                      <div className='grid grid-cols-2 gap-x-4'>
                        <div className='tabular-nums'>
                          <span className='text-neutral-500'>Amt</span>{' '}
                          <span className='font-semibold'>
                            {formatUsd(r.totalAmount)}
                          </span>
                        </div>
                        <div className='tabular-nums text-right'>
                          <span className='text-neutral-500'>Cnt</span>{' '}
                          <span className='font-semibold'>
                            {r.count.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className='mt-3 hidden overflow-x-auto rounded border bg-white sm:block'>
                <table className='w-full min-w-[720px] text-left text-sm'>
                  <thead className='border-b bg-neutral-100'>
                    <tr>
                      <th className='px-3 py-2 font-medium'>Name</th>
                      <th className='px-3 py-2 font-medium text-right'>Hours</th>
                      <th className='px-3 py-2 font-medium text-right'>Count</th>
                      <th className='px-3 py-2 font-medium text-right'>Billable Hours</th>
                      <th className='px-3 py-2 font-medium text-right'>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topNamesByAmount.map((r) => (
                      <tr key={`amount-${r.name}`} className='border-b last:border-b-0'>
                        <td className='px-3 py-2'>{r.name}</td>
                        <td className='px-3 py-2 tabular-nums text-right'>
                          {formatNumber(r.totalHours, decimals)}
                        </td>
                        <td className='px-3 py-2 tabular-nums text-right'>
                          {r.count.toLocaleString()}
                        </td>
                        <td className='px-3 py-2 tabular-nums text-right'>
                          {formatNumber(r.billableHours, decimals)}
                        </td>
                        <td className='px-3 py-2 tabular-nums text-right'>
                          {formatUsd(r.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
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

        .dp-theme-sandbox .dp-h2 {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.01em;
          color: #0f172a;
        }

        .dp-theme-sandbox .dp-h2::after {
          content: '';
          height: 2px;
          width: 56px;
          border-radius: 999px;
          background: var(--dp-accent);
          opacity: 0.9;
        }

        .dp-theme-sandbox .dp-h2-sm {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.01em;
          color: #0f172a;
        }

        .dp-theme-sandbox .dp-nt-label {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 15ch;
          max-width: 100%;
          padding: 6px 10px;
          border-radius: 10px;
          background: color-mix(in srgb, var(--dp-accent-soft) 55%, white);
          border: 1px solid color-mix(in srgb, var(--dp-accent) 28%, rgba(148, 163, 184, 0.55));
          box-shadow:
            0 1px 0 rgba(15, 23, 42, 0.04),
            inset 0 0 0 1px rgba(255, 255, 255, 0.55);
          cursor: default;
          user-select: text;
          position: relative;
        }

        .dp-theme-sandbox .dp-nt-label-text {
          display: block;
          width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: center;
          font-weight: 800;
          letter-spacing: 0.01em;
          color: #0f172a;
        }

        .dp-theme-sandbox .dp-table-head th {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #475569;
        }

        .dp-theme-sandbox .dp-table tbody tr:nth-child(odd) {
          background: rgba(241, 245, 249, 0.35);
        }

        .dp-theme-sandbox .dp-table tbody tr:hover {
          background: rgba(226, 232, 240, 0.55);
        }

        .dp-theme-sandbox .dp-table tbody td {
          padding-top: 10px;
          padding-bottom: 10px;
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
          background-color: var(--dp-accent-soft);
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

        .dp-theme-b .dp-table-head th {
          background-color: var(--dp-accent-soft);
          color: #0f172a;
        }

        .dp-theme-b .dp-table tbody tr:nth-child(odd) {
          background-color: #f8fafc;
        }

        .dp-theme-b .dp-table tbody tr:hover {
          background-color: rgba(186, 230, 253, 0.55);
        }

        .dp-theme-b .dp-h2 {
          color: var(--dp-accent);
        }

        .dp-theme-b .dp-h2::after {
          background-color: var(--dp-accent);
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

        .dp-theme-c .dp-h2 {
          color: #0b1220;
        }

        .dp-theme-c .dp-h2::after {
          background-color: var(--dp-accent);
        }

        .dp-theme-c .dp-table-head th {
          background-color: color-mix(in srgb, var(--dp-accent-soft) 65%, white);
          color: #0b1220;
        }

        .dp-theme-c .dp-table tbody tr:hover {
          background-color: rgba(254, 243, 199, 0.65);
        }
      `}</style>
    </main>
  );
}
