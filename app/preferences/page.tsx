'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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

type DashboardPrefs = {
  defaultStart: string;
  defaultEnd: string;
  roundingHoursDecimals: number;
};

const PREFS_KEY = 'dashboardPreferences_v1';

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

function savePrefs(prefs: DashboardPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export default function PreferencesPage() {
  const [prefs, setPrefs] = useState<DashboardPrefs | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  function updatePrefs(next: DashboardPrefs) {
    setPrefs(next);
    setIsSaved(false);
  }

  function onSave() {
    if (!prefs) return;
    savePrefs(prefs);
    setIsSaved(true);
  }

  function onReset() {
    const next = getDefaultPrefs();
    updatePrefs(next);
    savePrefs(next);
    setIsSaved(true);
  }

  return (
    <main className='min-h-screen p-6'>
      <div className='mx-auto max-w-[1400px] space-y-6'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-semibold'>Preferences</h1>
          <p className='text-sm text-neutral-600'>
            Dashboard settings.
          </p>
        </div>

        <section className='rounded border bg-neutral-50 p-4'>
          <div className='flex flex-wrap items-end justify-between gap-4'>
            <div className='text-sm text-neutral-700'>
              These settings are saved in your browser and used by{' '}
              <Link className='underline' href='/dashboard'>
                /dashboard
              </Link>
              .
            </div>

            <div className='flex gap-3'>
              <button
                className='rounded border bg-white px-3 py-2 text-sm font-medium disabled:opacity-50'
                type='button'
                onClick={onReset}
                disabled={!prefs}
              >
                Reset
              </button>

              <button
                className='rounded bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50'
                type='button'
                onClick={onSave}
                disabled={!prefs}
              >
                Save
              </button>
            </div>
          </div>

          {isSaved ? (
            <div className='mt-3 text-sm text-neutral-700'>Saved.</div>
          ) : null}

          <div className='mt-4 grid gap-4 md:grid-cols-3'>
            <div className='flex flex-col gap-1'>
              <label className='text-sm font-medium' htmlFor='defaultStart'>
                Default start date
              </label>
              <input
                className='w-[180px] rounded border bg-white px-2 py-1 text-sm'
                id='defaultStart'
                type='date'
                value={prefs?.defaultStart ?? ''}
                onChange={(e) => {
                  if (!prefs) return;
                  updatePrefs({ ...prefs, defaultStart: e.target.value });
                }}
              />
            </div>

            <div className='flex flex-col gap-1'>
              <label className='text-sm font-medium' htmlFor='defaultEnd'>
                Default end date
              </label>
              <input
                className='w-[180px] rounded border bg-white px-2 py-1 text-sm'
                id='defaultEnd'
                type='date'
                value={prefs?.defaultEnd ?? ''}
                onChange={(e) => {
                  if (!prefs) return;
                  updatePrefs({ ...prefs, defaultEnd: e.target.value });
                }}
              />
            </div>

            <div className='flex flex-col gap-1'>
              <label className='text-sm font-medium' htmlFor='roundingHoursDecimals'>
                Hours decimals
              </label>
              <input
                className='w-[180px] rounded border bg-white px-2 py-1 text-sm'
                id='roundingHoursDecimals'
                type='number'
                min={0}
                max={4}
                step={1}
                value={prefs?.roundingHoursDecimals ?? 2}
                onChange={(e) => {
                  if (!prefs) return;
                  updatePrefs({
                    ...prefs,
                    roundingHoursDecimals: Math.max(
                      0,
                      Math.min(4, Number(e.target.value)),
                    ),
                  });
                }}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
