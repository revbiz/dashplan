# Time Tracking Business Dashboard Plan (V1)
This plan builds a secure, separate web dashboard backed by FileMaker, using FileMaker for authoritative calculations and a web UI for charts, filtering, and drill-down.

## Decisions we’ll lock in
- **Duration unit**: You already compute **decimal hours** (e.g. `1`, `.5`). We’ll treat this as canonical and only normalize if needed.
- **Time entry constraint**: Time entries do not cross midnight (start/end are on the same date).
- **Scope (V1)**: Dashboard is for **one employee only**.
- **Integration (V1)**: Use **FileMaker Data API** via backend API routes (token/session handled server-side).
- **Pricing fields**: Each time entry row has:
  - `pl_Rate` (hourly)
  - `pl_Amount` (record total) which is **billable-only** (non-billable entries are 0/blank) and is a calculation (`pl_Rate * LenTime`)
- **Categorization**: Each time entry has `notetype` (e.g. Dev, Health, DB, Note) and the dashboard must support summaries/charts by this category.
- **Assignment dimension**: Each time entry is assigned either to a client (e.g. Joe Smith) or to self (time management) and the dashboard must support filtering/breakdowns by this assignment.
- **Reuse-first**: Prefer leveraging your existing FileMaker calculations/summaries/reports; only add new summary tables/scripts where needed for performance or API simplicity.
- **Working style**: Proceed iteratively by having you specify the next desired output and what you already have in FileMaker that we can reuse.
- **V1 KPIs**: Hours + Billable $, Utilization, Project/Client breakdowns.
- **Refresh**: Manual refresh button plus optional scheduled refresh (e.g. hourly) depending on performance and hosting constraints.

## Milestone 1: Data contract (FileMaker -> Web)
### Phase 1A: Backend connectivity spike (start here)
Implement the smallest possible end-to-end slice so you can paste JSON payloads and confirm field names.

- Create a Next.js app in the workspace root (`/Users/revdave/SiteWork-AIR/dashboard`).
- Add server-side FileMaker Data API connectivity (no browser-to-FileMaker calls).
- Add a protected test route/page that fetches a small set of TimeEntry records and prints raw JSON.
- Configure via environment variables (FileMaker host/database/layout, credentials, dashboard shared password).
- After the JSON test is working, you will paste sample JSON output and confirm which fields to use for aggregations (hours, amount, notetype, assignment, etc.).

### Phase 1B: Confirm fields for reporting
  - Identify the **minimum set of fields** needed from your existing TimeEntry table:
    - `startDate`, `startTime`, `endTime`
    - `durationHoursDecimal` (your existing calc)
    - `pl_Rate`
    - `pl_Amount` (currently a calc: `pl_Rate * LenTime`)
    - `notetype`
    - assignment fields: `Name` and `Name_id` (either a client or self employee)
    - `employeeId`
    - `projectId` and/or `clientId`
    - `isBillable`
    - `status` (if exists)
  - Confirm whether billable $ should be **locked** at approval time (recommended if rates can change historically). If yes, add stored fields like `appliedRate` / `appliedAmount` and use those for dashboard rollups.

## Milestone 2: Aggregation strategy (recommended: rollup table)
To keep the dashboard fast and simple, create/update a rollup table in FileMaker.

- Add a `TimeSummary` table (or leverage your existing summaries) with a **weekly grain** for V1 charts:
  - Keys: `weekStart`, `employeeId`, `projectId` (and/or `clientId`), `notetype`, `Name_id`
  - Measures: `totalHours`, `billableHours`, `billableAmount` (sum of `pl_Amount`)
- Populate via a FileMaker script:
  - **Nightly rebuild** (baseline)
  - Optional incremental update on time entry edit/approval (later)

## Milestone 3: Secure web access (login + server-side FileMaker access)
Goal: The user never handles FileMaker tokens/credentials.

- Add a basic login layer for the dashboard (V1):
  - **Simple password (single user)** stored as an environment variable
- All FileMaker calls happen **server-side only** (API routes), never from the browser.

### FileMaker authentication handling
We’ll implement token/session management in the backend so it is automatic:
- **If using FileMaker Data API**:
  - Backend obtains a Data API session token.
  - Cache token in memory (or shared cache if needed), attach to requests.
  - On 401/expired token: automatically re-auth and retry once.

## Milestone 4: Web dashboard UI (V1)
- Dashboard page with:
  - KPI tiles: total hours, billable hours, billable $, utilization %, project/client totals
  - Charts:
    - Weekly total hours (12 weeks)
    - Weekly billable vs non-billable (12 weeks)
    - Top projects/clients (MTD)
    - Notetype analysis (deferred until after connectivity spike):
      - By-`notetype` summaries and charts (count, total hours, billable amount)
  - Filters:
    - date range (week, month-to-date, custom)
    - project/client
    - employee (optional)
- Drill-down:
  - Clicking a KPI/chart segment opens a filtered list of matching time entries.

## Operational notes
- **Auto refresh**:
  - UI can refresh every hour, but prefer a manual refresh button for reliability.
  - If hourly refresh is required, we can implement:
    - client-side polling (simple)
    - or server-side cached snapshots refreshed on a timer (better performance)

## Open items you’ll need to confirm
- What statuses exist (draft/submitted/approved/invoiced) and which you want included in KPIs.
- Whether you already have summary tables/scripts we should reuse instead of creating `TimeSummary`.
- Whether you want user-level permissions (different views per user) vs a single shared login.
