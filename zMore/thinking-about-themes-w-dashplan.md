# Thinking about themes w Dashplan

Goal: explore theme directions and collect inspiration **without changing any code yet**.

## How to explore themes without code changes

### 1) Pick a few “theme directions”

Pick 2-3 directions first. We can then compare them against your existing pages:

- `/dashboard`
- `/charts`
- `/reports-notetype`

#### Direction A: Modern Neutral + Single Accent

- Clean neutrals (white/stone/slate)
- One accent color for buttons/active nav/highlights
- Works very well for data tables + KPI strips

Accents to consider:

- Indigo (professional)
- Emerald (finance/positive)
- Cyan (modern)

#### Direction B: Soft / Pastel

- Softer borders
- Tinted panels
- Friendly tone

Watch-outs:

- Keep contrast high enough for readability

#### Direction C: Dark-first / Analytics

- Dark surfaces
- Brighter charts
- Subtle borders

Watch-outs:

- Ensure charts + tables remain legible

#### Direction D: Dense Data / High-contrast

- Compact spacing
- Stronger separators
- Emphasis on scanning values fast

## Inspiration links (browse first, no implementation)

### shadcn/ui dashboard examples

- shadcn/ui dashboard example:
  - https://ui.shadcn.com/examples/dashboard

### Vercel templates (Next + shadcn)

- Next.js & shadcn/ui admin dashboard template:
  - https://vercel.com/templates/next.js/next-js-and-shadcn-ui-admin-dashboard

Notes worth reviewing from that template:

- It mentions theme presets such as:
  - Tangerine
  - Neo Brutalism
  - Soft Pop

## What to collect (simple “moodboard” checklist)

If you find a theme you like, capture:

- 1 desktop screenshot + 1 mobile screenshot
- Header/nav style
- Card style:
  - bordered vs shadowed
  - corner radius
- Table style:
  - zebra striping?
  - row separators?
- Chart style:
  - muted vs vivid
  - legend placement
- Typography:
  - system font vs Inter-like

## Design tokens to decide (before any code changes)

We can define a “theme decision” as a small set of tokens:

- Primary accent color
- Base neutrals (background/surface/border/text)
- Border radius (e.g. md vs xl)
- Shadow policy (none / subtle / heavy)
- Density (compact vs airy)

## Dashplan-specific notes

Dashplan has multiple surfaces that should feel consistent:

- KPI strip cards
- Tables (NoteType + Name)
- Charts (donut + bar)
- Report sections (`/reports-notetype`)
- Top navigation

## Next step (still no code)

Pick:

1) Your favorite direction: A/B/C/D
2) Preferred accent color (or 2 candidates)
3) Whether charts should be muted or vivid

Then we’ll narrow to 2 themes and decide which one to implement later.
