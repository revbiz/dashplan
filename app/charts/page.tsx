'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import { formatUsd } from '../../lib/format';

type NoteTypeRow = {
  noteType: string;
  count: number;
  totalHours: number;
  totalAmount: number;
};

type NoteTypeApiResponse =
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
      rows: NoteTypeRow[];
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

const COLORS = [
  '#2563eb',
  '#16a34a',
  '#f97316',
  '#a855f7',
  '#ef4444',
  '#06b6d4',
  '#eab308',
  '#64748b',
  '#db2777',
  '#22c55e',
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function DonutChart({
  title,
  items,
  valueLabel,
  valueTextClassName,
  valueSvgClassName,
  trackStroke,
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
  valueLabel: (v: number) => string;
  valueTextClassName?: string;
  valueSvgClassName?: string;
  trackStroke?: string;
}) {
  const filtered = items.filter((i) => i.value > 0);
  const total = filtered.reduce((s, i) => s + i.value, 0);
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const r = 90;
  const stroke = 22;

  let currentAngle = 0;

  return (
    <div className='rounded border bg-neutral-50 p-4'>
      <div className='text-sm font-medium'>{title}</div>

      <div className='mt-3 grid gap-4 md:grid-cols-[260px_1fr]'>
        <div className='flex justify-center'>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill='none'
              stroke={trackStroke ?? '#e5e7eb'}
              strokeWidth={stroke}
            />

            {filtered.map((it, idx) => {
              const pct = total === 0 ? 0 : it.value / total;
              const angle = pct * 360;
              const start = currentAngle;
              const end = currentAngle + angle;
              currentAngle = end;

              const d = describeArc(cx, cy, r, start, end);

              return (
                <path
                  key={`${title}-${it.label}`}
                  d={d}
                  fill='none'
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={stroke}
                  strokeLinecap='butt'
                />
              );
            })}

            <circle cx={cx} cy={cy} r={r - stroke / 2} fill='transparent' />
            <text
              x={cx}
              y={cy - 4}
              textAnchor='middle'
              className='fill-neutral-900'
              style={{ fontSize: 14, fontWeight: 600 }}
            >
              Total
            </text>
            <text
              x={cx}
              y={cy + 16}
              textAnchor='middle'
              className={valueSvgClassName ?? 'fill-neutral-700'}
              style={{ fontSize: 16, fontWeight: 700 }}
            >
              {valueLabel(total)}
            </text>
          </svg>
        </div>

        <div className='space-y-2'>
          {filtered.length === 0 ? (
            <div className='text-sm text-neutral-600'>No data for this range.</div>
          ) : (
            filtered.map((it, idx) => (
              <div key={`${title}-legend-${it.label}`} className='flex items-center gap-3'>
                <div
                  className='h-3 w-3 shrink-0 rounded'
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <div className='min-w-0 flex-1 truncate text-sm text-neutral-800'>
                  {it.label}
                </div>
                <div
                  className={`shrink-0 text-sm tabular-nums ${
                    valueTextClassName ?? 'text-neutral-700'
                  }`}
                >
                  {valueLabel(it.value)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChartsPage() {
  const [prefs, setPrefs] = useState<DashboardPrefs | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [noteTypeData, setNoteTypeData] = useState<NoteTypeApiResponse | null>(null);
  const [nameData, setNameData] = useState<NameApiResponse | null>(null);
  const didAutoRun = useRef(false);

  useEffect(() => {
    const p = loadPrefs();
    const last = loadLastRange();
    setPrefs(p);
    setStart(last?.start ?? p.defaultStart);
    setEnd(last?.end ?? p.defaultEnd);
  }, []);

  const decimals = prefs?.roundingHoursDecimals ?? 2;

  async function run() {
    setIsLoading(true);
    setNoteTypeData(null);
    setNameData(null);

    saveLastRange({ start, end });

    try {
      const [a, b] = await Promise.all([
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

      const json = (await a.json()) as NoteTypeApiResponse;
      const json2 = (await b.json()) as NameApiResponse;

      setNoteTypeData(json);
      setNameData(json2);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setNoteTypeData({ ok: false, error: message });
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

  const noteTypeHoursItems = useMemo(() => {
    if (!noteTypeData || !noteTypeData.ok) return null;
    return [...noteTypeData.rows]
      .sort((a, b) => b.totalHours - a.totalHours)
      .slice(0, 8)
      .map((r) => ({ label: r.noteType, value: r.totalHours }));
  }, [noteTypeData]);

  const noteTypeAmountItems = useMemo(() => {
    if (!noteTypeData || !noteTypeData.ok) return null;
    return [...noteTypeData.rows]
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 8)
      .map((r) => ({ label: r.noteType, value: r.totalAmount }));
  }, [noteTypeData]);

  const nameHoursItems = useMemo(() => {
    if (!nameData || !nameData.ok) return null;
    return [...nameData.rows]
      .sort((a, b) => b.totalHours - a.totalHours)
      .slice(0, 8)
      .map((r) => ({ label: r.name, value: r.totalHours }));
  }, [nameData]);

  return (
    <main className='min-h-screen p-4 sm:p-6'>
      <div className='mx-auto max-w-[1400px] space-y-6'>
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div className='space-y-1'>
            <h1 className='text-2xl font-semibold'>Charts</h1>
            <p className='text-sm text-neutral-600'>
              Visual charts based on the same reporting data as the dashboard.
            </p>
          </div>

          <div className='flex gap-4 text-sm'>
            <Link className='underline' href='/dashboard'>
              Dashboard
            </Link>
            <Link className='underline' href='/preferences'>
              Preferences
            </Link>
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

            {noteTypeData && noteTypeData.ok ? (
              <div className='text-sm text-neutral-700'>
                Found {noteTypeData.foundCount.toLocaleString()} records
              </div>
            ) : null}
          </div>

          {noteTypeData && !noteTypeData.ok ? (
            <div className='mt-4 rounded border border-red-200 bg-white p-3 text-sm text-red-700'>
              <div className='font-medium'>Error</div>
              <div className='mt-1 whitespace-pre-wrap break-words'>
                {noteTypeData.error}
              </div>
              {noteTypeData.details ? (
                <pre className='mt-2 max-h-[30vh] overflow-auto whitespace-pre-wrap break-words text-xs text-red-800'>
                  {noteTypeData.details}
                </pre>
              ) : null}
            </div>
          ) : null}
        </section>

        {noteTypeHoursItems && noteTypeAmountItems && nameHoursItems ? (
          <section className='grid gap-4 lg:grid-cols-2'>
            <DonutChart
              title='NoteType (Hours)'
              items={noteTypeHoursItems}
              valueLabel={(v) => formatNumber(v, decimals)}
            />
            <DonutChart
              title='NoteType (Amount)'
              items={noteTypeAmountItems}
              valueLabel={(v) => formatUsd(v)}
              valueTextClassName='text-emerald-700'
              valueSvgClassName='fill-emerald-700'
              trackStroke='#059669'
            />
            <div className='lg:col-span-2'>
              <DonutChart
                title='Name (Hours)'
                items={nameHoursItems}
                valueLabel={(v) => formatNumber(v, decimals)}
              />
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
