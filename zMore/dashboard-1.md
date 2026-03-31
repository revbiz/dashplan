# Dashboard 1 - Time Tracking Business Dashboard (V1)

## Goal
Create a separate web dashboard that reads from FileMaker, while keeping business rules and core calculations authoritative in FileMaker.

## Target users
- Admin/Owner
- Project Manager
- Employee (optional, limited view)

## V1 dashboard layout
### KPI tiles (top row)
- Total Hours (This Week)
- Billable Hours (This Week)
- Billable $ (This Week)
- Utilization % (This Week)
- Unapproved Hours
- Uninvoiced Approved Hours

### Trend charts
- Weekly Total Hours (last 12 weeks)
- Weekly Billable vs Non-billable (last 12 weeks)

### Breakdowns
- Hours by Project (This Month, top 5 + Other)
- Hours by Employee (This Month)

### Drill-down behavior
Every KPI and chart element should support click-through to a filtered list of underlying time entry records.

## Data model assumptions (minimum viable)
### TimeEntry
Recommended fields:
- id
- employeeId
- projectId (or clientId)
- startTimestamp, endTimestamp (or durationMinutes)
- entryDate (derived if using timestamps)
- durationMinutes (stored or calculated)
- isBillable
- hourlyRate (stored or derived)
- status: draft | submitted | approved | invoiced

### Employee
- id
- name
- defaultRate (optional)
- active

### Project (or Client + Project)
- id
- name
- clientId (optional)
- billableDefault (optional)
- active

## Core calculations (do in FileMaker)
- durationMinutes
- billableAmount = (durationMinutes / 60) * hourlyRate
- utilization rules (define denominator)
- overtime rules (if required)
- status rules (what counts as approved/invoiced)

## Aggregation strategy (recommended)
### Summary table: TimeSummary
Create a summary/rollup table to avoid expensive aggregation from raw time entries.

Suggested grains (choose based on chart needs):
- Employee + Week
- Project + Week
- (Optional) Client + Month

Suggested fields:
- summaryType (employee_week | project_week | client_month)
- weekStart (date)
- monthKey (text, YYYY-MM)
- employeeId
- projectId
- clientId
- totalMinutes
- billableMinutes
- unapprovedMinutes
- uninvoicedApprovedMinutes
- billableAmount

### Refresh cadence
- Nightly scheduled refresh (safe baseline)
- Optional incremental refresh when:
  - a time entry is edited
  - status changes to approved/invoiced

## API needs (web dashboard)
Expose endpoints that return:
- KPIs (single numbers)
- Time series (array of week buckets)
- Breakdowns (grouped totals)
- Drill-down list data (paged)

Filters:
- dateRange
- employeeId
- projectId
- clientId
- status
- isBillable

## Open questions to confirm
- How is duration stored today (timestamps vs duration field)?
- Is there an approval workflow?
- Are rates per employee, per project, or fixed?
- Expected scale (time entries/week, number of employees)?
