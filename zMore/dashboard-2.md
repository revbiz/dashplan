# Dashboard 2

## Purpose

Capture what was implemented during this build session:

- FileMaker Data API connectivity working end-to-end.
- Shared-password protected routes.
- A reusable date-range reporting API that rolls up totals by `NoteType`.
- Split between:
  - `/preferences` (settings only)
  - `/dashboard` (results UI using saved settings)

## Routes

Public:

- `/`
  - Simple navigation.
- `/login`
  - Shared-password login page.

Protected (requires auth cookie):

- `/test`
  - Fetches `/api/fm/test` and shows raw JSON in a readable format.
- `/preferences`
  - Settings only (saved to browser storage).
- `/dashboard`
  - Results UI. Reads saved preferences and calls dashboard API.

API (protected):

- `/api/fm/test?limit=5`
  - Raw FileMaker records from the configured layout.
- `/api/dashboard/notetype-by-date-range?start=YYYY-MM-DD&end=YYYY-MM-DD`
  - Aggregated totals by `NoteType`.

## Preferences

Current storage:

- Stored in the browser via `localStorage` key `dashboardPreferences_v1`.

Current settings:

- `defaultStart`
  - Default start date used by `/dashboard`.
- `defaultEnd`
  - Default end date used by `/dashboard`.
- `roundingHoursDecimals`
  - Controls display precision for hours in `/dashboard`.

Notes:

- The date input widgets use ISO format (`YYYY-MM-DD`) because that is what HTML
  date inputs require.
- The API layer converts ISO dates to FileMaker format (`MM/DD/YYYY`) when
  calling `_find`.

## API Endpoints

### FileMaker raw test

`GET /api/fm/test?limit=5`

- Purpose: confirm connectivity and see available fields from FileMaker.
- Reads:
  - `FILEMAKER_HOST`, `FILEMAKER_DATABASE`, `FILEMAKER_LAYOUT`
- Returns raw JSON from FileMaker.

### NoteType rollup by date range

`GET /api/dashboard/notetype-by-date-range?start=YYYY-MM-DD&end=YYYY-MM-DD`

- Purpose: reusable backend for weekly/monthly/custom summaries.
- Query:
  - `start`, `end` required
  - Accepts `YYYY-MM-DD` (or `MM/DD/YYYY`), converts to FileMaker `MM/DD/YYYY`.
- FileMaker call:
  - Data API `_find` on layout `FILEMAKER_LAYOUT`.
  - Uses `StartDate: "MM/DD/YYYY...MM/DD/YYYY"`.
- Grouping:
  - `NoteType` (fallback: `NoteType_c`, fallback: `Unknown`).
- Totals:
  - `count`
  - `totalHours` = sum(`LenTime`)
  - `totalAmount` = sum(`pl_Amount`) (must be present on the layout)
- Returns JSON:
  - `{ ok: true, params, foundCount, rows: [...] }`

## Notes / Next Steps

### Key fixes made

- FileMaker session creation was failing with code `1708` due to invalid content
  type.
  - Fix: session `POST` now sends `Accept: application/json` and
    `Content-Type: application/json` and an empty JSON body.

- `/test` JSON readability improvements
  - Pretty-prints JSON and increases viewport/scroll area.

### Auth / protection

- `proxy.ts` protects:
  - `/test`, `/preferences`, `/dashboard`
  - `/api/fm/*`, `/api/dashboard/*`

### Environment variables (required)

- `DASHBOARD_PASSWORD`
- `DASHBOARD_AUTH_TOKEN`
- `FILEMAKER_HOST`
- `FILEMAKER_DATABASE`
- `FILEMAKER_LAYOUT`
- `FILEMAKER_USERNAME`
- `FILEMAKER_PASSWORD`

### Candidate next enhancements

- Add quick range buttons on `/dashboard`:
  - This week / last week / this month / last month.
- Add simple charts (hours by NoteType).
- Expand `/preferences`:
  - default view (week vs month), include/exclude amount toggle, employee filter
    toggle.
- Persist preferences server-side later (instead of only localStorage) if you
  want settings shared across browsers/devices.

### Files changed/added in this session (high level)

- `lib/filemaker.ts`
  - Fix session login content-type.
- `app/api/fm/test/route.ts`
  - Error payload improvements for debugging.
- `app/api/dashboard/notetype-by-date-range/route.ts`
  - New date-range rollup API.
- `proxy.ts`
  - Protect `/api/dashboard`, `/preferences`, `/dashboard`.
- `app/test/page.tsx`
  - Better JSON rendering.
- `app/preferences/page.tsx`
  - Refactored to settings-only, stores to localStorage.
- `app/dashboard/page.tsx`
  - New dashboard UI page.
- `app/page.tsx`
  - Added nav links.
