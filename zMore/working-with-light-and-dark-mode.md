# Working with Light and Dark Mode

This app supports both light and dark appearance. Dark mode is primarily driven by the OS/browser preference via `prefers-color-scheme: dark`, with UI surfaces (pages, cards, tables, code blocks) styled to remain readable in both modes.

## How dark mode is determined

- `app/globals.css` defines CSS variables for base colors:
  - `--background`
  - `--foreground`
- Those variables change inside:
  - `@media (prefers-color-scheme: dark)`

This means:
- In light mode, the default foreground is dark text on a light background.
- In dark mode, the default foreground becomes light text.

## Why we needed explicit dark styling for UI surfaces

If a page/card uses a fixed light background like `bg-white`, but the OS is in dark mode, the text color may be light (from `--foreground`) on a light surface, which looks washed out.

To prevent that, we use Tailwind dark variants (via semantic classes below) so that when the OS is in dark mode:
- the page background becomes dark
- cards become dark
- borders/dividers become darker
- muted text becomes lighter

## Semantic (global) Tailwind component classes

To avoid repeating long `dark:` class lists on every page, common UI patterns are centralized in `app/globals.css` under `@layer components`.

### Page wrappers

- `page-shell`
  - Applies the app-wide page background (light and dark)
  - Also sets `min-h-screen`
- `page-pad`
  - Applies the “standard” page padding: `px-6 py-10`

Typical usage on normal pages:
- Wrap the whole page with:
  - `className="page-shell page-pad"`

Centered pages (Login/Logout) typically use `page-shell` without `page-pad`, and apply only the padding they want.

### Surfaces

- `card`
  - Standard card surface used for most sections
- `card-lg`
  - Larger padding variant for “bigger” cards

### Code / JSON blocks

- `pre-block`
  - Standard styling for `<pre>` blocks (JSON debug blocks, etc.)
  - Does not force a margin; add `mt-*` where needed

### Buttons

- `btn-primary`
  - Primary button styling (used on “Fetch” buttons)
- `btn-primary-lg`
  - Slightly larger primary button (used on large form submit buttons)
- `border-btn`
  - Small bordered button for inline actions (e.g., table row action links)

### Tables

- `table-shell`
  - Provides border + rounded + overflow container
- `table-head`
  - Table header background + header text color (light/dark)
- `table-body`
  - Divider colors for rows (light/dark)
- `table-row`
  - Default row background (light/dark)

### Muted text

- `muted`
  - For secondary paragraphs, small helper text, and empty states
- `muted-xs`
  - For tiny metadata text (e.g., `client_id: 123`)

## Practical guidelines for building new pages

### 1) Start with the standard page wrapper

Most pages:
- `className="page-shell page-pad"`

### 2) Use `card` / `card-lg` for main sections

Avoid manually adding `bg-white` / `dark:bg-*` in many places.

### 3) Use the standard table helpers

When adding a new table:
- Wrap it in `table-shell`
- Use `table-head`, `table-body`, and `table-row`

### 4) Prefer `muted` / `muted-xs` for secondary text

This keeps subdued text consistent and readable in both themes.

### 5) If you must use one-off Tailwind classes

That’s fine for unique UI.

Rule of thumb:
- If you add a new “surface” background (ex: `bg-white`), make sure it has a dark counterpart.
- If you see repetition across pages, promote it into a semantic class in `app/globals.css`.

## Notes about editor/lint warnings

You may see editor warnings like:
- “Unknown at rule `@apply`”
- “Unknown at rule `@theme`”

These are typically from the editor’s CSS linter not recognizing Tailwind/PostCSS directives. The Tailwind build pipeline still processes them correctly.
