'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

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
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [nameData, setNameData] = useState<NameApiResponse | null>(null);

  useEffect(() => {
    const p = loadPrefs();
    const last = loadLastRange();
    setPrefs(p);
    setStart(last?.start ?? p.defaultStart);
    setEnd(last?.end ?? p.defaultEnd);
  }, []);

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
    <main className='min-h-screen p-4 sm:p-6'>
      <div className='mx-auto max-w-[1400px] space-y-6'>
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div className='space-y-1'>
            <h1 className='text-2xl font-semibold'>Dashboard</h1>
            <p className='text-sm text-neutral-600'>
              NoteType totals for a selected date range.
            </p>
          </div>

          <div className='flex gap-4 text-sm'>
            <Link className='underline' href='/preferences'>
              Preferences
            </Link>
          </div>
        </div>

        {totals ? (
          <section className='grid gap-3 sm:grid-cols-2 md:grid-cols-5'>
            <div className='rounded border bg-neutral-50 p-4'>
              <div className='text-xs text-neutral-600'>Records</div>
              <div className='mt-1 text-lg font-semibold tabular-nums'>
                {totals.totalCount.toLocaleString()}
              </div>
            </div>
            <div className='rounded border bg-neutral-50 p-4'>
              <div className='text-xs text-neutral-600'>Total Hours</div>
              <div className='mt-1 text-lg font-semibold tabular-nums'>
                {formatNumber(totals.totalHours, decimals)}
              </div>
            </div>
            <div className='rounded border bg-neutral-50 p-4'>
              <div className='text-xs text-neutral-600'>Billable Hours</div>
              <div className='mt-1 text-lg font-semibold tabular-nums'>
                {formatNumber(totals.billableHours, decimals)}
              </div>
            </div>
            <div className='rounded border bg-neutral-50 p-4'>
              <div className='text-xs text-neutral-600'>Billable Amount</div>
              <div className='mt-1 text-lg font-semibold tabular-nums'>
                {formatNumber(totals.totalAmount, 2)}
              </div>
            </div>
            <div className='rounded border bg-neutral-50 p-4'>
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
              <div className='mt-4 space-y-2 sm:hidden'>
                {data.rows.map((r) => (
                  <div key={`nt-m-${r.noteType}`} className='rounded border bg-white p-3'>
                    <div className='truncate text-sm font-medium text-neutral-900'>
                      {r.noteType}
                    </div>
                    <div className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-700'>
                      <div className='tabular-nums'>
                        <span className='text-neutral-500'>Cnt</span> {r.count.toLocaleString()}
                      </div>
                      <div className='tabular-nums'>
                        <span className='text-neutral-500'>Hrs</span> {formatNumber(r.totalHours, decimals)}
                      </div>
                      <div className='tabular-nums'>
                        <span className='text-neutral-500'>Amt</span> {formatNumber(r.totalAmount, 2)}
                      </div>
                    </div>
                  </div>
                ))}

                {totals ? (
                  <div className='rounded border bg-neutral-50 p-3'>
                    <div className='text-sm font-medium text-neutral-900'>Totals</div>
                    <div className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-700'>
                      <div className='tabular-nums'>
                        <span className='text-neutral-500'>Cnt</span> {totals.totalCount.toLocaleString()}
                      </div>
                      <div className='tabular-nums'>
                        <span className='text-neutral-500'>Hrs</span> {formatNumber(totals.totalHours, decimals)}
                      </div>
                      <div className='tabular-nums'>
                        <span className='text-neutral-500'>Amt</span> {formatNumber(totals.totalAmount, 2)}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className='mt-4 hidden overflow-auto rounded border bg-white sm:block'>
                <table className='w-full min-w-[520px] text-left text-sm'>
                  <thead className='border-b bg-neutral-100'>
                    <tr>
                      <th className='px-3 py-2 font-medium'>NoteType</th>
                      <th className='px-3 py-2 font-medium'>Count</th>
                      <th className='px-3 py-2 font-medium'>Hours</th>
                      <th className='px-3 py-2 font-medium'>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.noteType} className='border-b last:border-b-0'>
                        <td className='px-3 py-2'>{r.noteType}</td>
                        <td className='px-3 py-2 tabular-nums'>
                          {r.count.toLocaleString()}
                        </td>
                        <td className='px-3 py-2 tabular-nums'>
                          {formatNumber(r.totalHours, decimals)}
                        </td>
                        <td className='px-3 py-2 tabular-nums'>
                          {formatNumber(r.totalAmount, 2)}
                        </td>
                      </tr>
                    ))}

                    {totals ? (
                      <tr className='bg-neutral-50'>
                        <td className='px-3 py-2 font-medium'>Totals</td>
                        <td className='px-3 py-2 font-medium tabular-nums'>
                          {totals.totalCount.toLocaleString()}
                        </td>
                        <td className='px-3 py-2 font-medium tabular-nums'>
                          {formatNumber(totals.totalHours, decimals)}
                        </td>
                        <td className='px-3 py-2 font-medium tabular-nums'>
                          {formatNumber(totals.totalAmount, 2)}
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
              <div className='text-sm font-medium'>Chart: Hours by NoteType</div>
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

            <div className='rounded border bg-neutral-50 p-4'>
              <div className='text-sm font-medium'>Chart: Amount by NoteType</div>
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
                        <div className='truncate text-xs text-neutral-700'>
                          {it.label}
                        </div>
                        <div className='shrink-0 text-xs tabular-nums text-neutral-700'>
                          {formatNumber(it.value, 2)}
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
              <div className='text-sm font-medium'>Chart: Hours by Name</div>
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
              <div className='text-sm font-medium'>Top Names (by hours)</div>
              <div className='mt-3 space-y-2 sm:hidden'>
                {topNamesByHours.map((r) => (
                  <div key={`hours-m-${r.name}`} className='rounded border bg-white p-3'>
                    <div className='truncate text-sm font-medium text-neutral-900'>
                      {r.name}
                    </div>
                    <div className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-700'>
                      <div className='tabular-nums'>
                        <span className='text-neutral-500'>Hrs</span> {formatNumber(r.totalHours, decimals)}
                      </div>
                      <div className='tabular-nums'>
                        <span className='text-neutral-500'>Cnt</span> {r.count.toLocaleString()}
                      </div>
                      <div className='tabular-nums'>
                        <span className='text-neutral-500'>Bill</span> {formatNumber(r.billableHours, decimals)}
                      </div>
                      <div className='tabular-nums'>
                        <span className='text-neutral-500'>Amt</span> {formatNumber(r.totalAmount, 2)}
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
                      <th className='px-3 py-2 font-medium'>Hours</th>
                      <th className='px-3 py-2 font-medium'>Count</th>
                      <th className='px-3 py-2 font-medium'>Billable Hours</th>
                      <th className='px-3 py-2 font-medium'>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topNamesByHours.map((r) => (
                      <tr key={`hours-${r.name}`} className='border-b last:border-b-0'>
                        <td className='px-3 py-2'>{r.name}</td>
                        <td className='px-3 py-2 tabular-nums'>
                          {formatNumber(r.totalHours, decimals)}
                        </td>
                        <td className='px-3 py-2 tabular-nums'>
                          {r.count.toLocaleString()}
                        </td>
                        <td className='px-3 py-2 tabular-nums'>
                          {formatNumber(r.billableHours, decimals)}
                        </td>
                        <td className='px-3 py-2 tabular-nums'>
                          {formatNumber(r.totalAmount, 2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className='rounded border bg-neutral-50 p-4'>
              <div className='text-sm font-medium'>Top Names (by amount)</div>
              <div className='mt-3 space-y-2 sm:hidden'>
                {topNamesByAmount.map((r) => (
                  <div key={`amount-m-${r.name}`} className='rounded border bg-white p-3'>
                    <div className='truncate text-sm font-medium text-neutral-900'>
                      {r.name}
                    </div>
                    <div className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-700'>
                      <div className='tabular-nums'>
                        <span className='text-neutral-500'>Amt</span> {formatNumber(r.totalAmount, 2)}
                      </div>
                      <div className='tabular-nums'>
                        <span className='text-neutral-500'>Hrs</span> {formatNumber(r.totalHours, decimals)}
                      </div>
                      <div className='tabular-nums'>
                        <span className='text-neutral-500'>Cnt</span> {r.count.toLocaleString()}
                      </div>
                      <div className='tabular-nums'>
                        <span className='text-neutral-500'>Bill</span> {formatNumber(r.billableHours, decimals)}
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
                      <th className='px-3 py-2 font-medium'>Hours</th>
                      <th className='px-3 py-2 font-medium'>Count</th>
                      <th className='px-3 py-2 font-medium'>Billable Hours</th>
                      <th className='px-3 py-2 font-medium'>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topNamesByAmount.map((r) => (
                      <tr key={`amount-${r.name}`} className='border-b last:border-b-0'>
                        <td className='px-3 py-2'>{r.name}</td>
                        <td className='px-3 py-2 tabular-nums'>
                          {formatNumber(r.totalHours, decimals)}
                        </td>
                        <td className='px-3 py-2 tabular-nums'>
                          {r.count.toLocaleString()}
                        </td>
                        <td className='px-3 py-2 tabular-nums'>
                          {formatNumber(r.billableHours, decimals)}
                        </td>
                        <td className='px-3 py-2 tabular-nums'>
                          {formatNumber(r.totalAmount, 2)}
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
    </main>
  );
}
