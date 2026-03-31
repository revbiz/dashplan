# Start Up Updates


## 2026-02-18 - GitHub + zMore access changes

- **Problem**
  - Cascade tools could not read `zMore/startup.md` because it was gitignored.

- **Initial fix (track only startup.md)**
  - Updated `.gitignore` to stop ignoring `zMore/startup.md`.
  - Verified tool access by reading `zMore/startup.md`.
  - Set rule: ignore `zMore/*.md` but un-ignore `zMore/startup.md`.
  - Committed/pushed: `2c8885c` (`chore: track startup instructions`).

- **Updated decision (zMore is always accessible; pushing is OK)**
  - New rule: anything in `zMore/` should be readable/editable by Cascade; user will manage contents; it’s OK if it gets pushed.
  - Removed the `/zMore/*.md` ignore rule so markdown in `zMore/` is no longer blocked by tooling.
  - Created `zMore/start-up-instructions.md`.
  - Committed/pushed: `4e10749` (`chore: allow zMore markdown and add startup instructions`).

