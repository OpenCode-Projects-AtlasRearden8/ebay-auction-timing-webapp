# STATUS — eBay Auction Timing

Last updated: 2026-10-31

## What was built

A complete, offline, single-file web app (`index.html`) that helps resellers time eBay listings and relists, in the "explain like a friend would" style of Asdale Dynamics. Pure HTML/CSS/JS in one file, zero dependencies, opens directly from `file://`, no network calls, no scraping — all data in the browser's localStorage.

Feature checklist against the original goal:

- [x] End-of-auction hour suggestions — ranked 24-hour lists per day with score bars, Gold/Good/So-so/Risky verdicts
- [x] Reason chips — every slot carries chips explaining why (Sunday-evening peak, garage-sale conflict, family-night penalty, etc.), plus a whole-week cheat sheet
- [x] Weekend windows for flea-market / garage-sale flippers — this-weekend cards (source Sat, batch-photograph, list Sun for next Sunday's peak) plus one-button schedule drop
- [x] Relist cadence planner — ages an item and returns wait / watch / relist-rotated-slot / reframe / renew-or-retire at day 30, with different behavior for "sells fast" vs "sits slow" categories
- [x] Manual sell-fast vs sat-slow notes per category — editable notebook with fuzzy category matching, read automatically by the relist planner
- [x] Nudges toward renewal targets — store-subscription and GTC 30-day presets, countdown that shifts tone (horizon / soon / now / overdue)
- [x] Sunset summary — end-of-day logging with counts plus a tomorrow-nudge that schedules unsold-item relists
- [x] Printable weekly schedule — Monday–Sunday grid, `window.print()` with print CSS that hides app chrome and keeps only the schedule
- [x] LocalStorage only, nothing scraped — verified: no `fetch`, no `XMLHttpRequest`, no external `src`/`href` anywhere in the file
- [x] Pure HTML/JS/CSS, zero dependencies, single file from `file://`
- [x] Complements ebay-profit-calculator-cli — credited in the app's About panel and README
- [x] MIT LICENSE with the exact line `Copyright (c) 2026 Asdale Dynamics, LLC`
- [x] README crediting Asdale Dynamics, LLC, with run/test instructions
- [x] Tests for hour and cadence logic

## How to run

- Use the app: open `index.html` in any modern browser (double-click works; `file://` is fine).
- Run tests: `npm test` (wraps `node --test tests/`; Node 18+ required for `node:test`).

## Verification results (this build)

- `node --test tests/` — **34/34 tests pass**, zero failures (24 logic tests in `tests/timing.test.js`, 10 boot-and-click smoke tests in `tests/smoke.test.js`).
- Smoke tests confirm the full script boots with an empty storage, that every panel's handler runs without throwing, that writes land in localStorage under the `ebt.*.v1` keys, and that a second boot picks saved items back up.
- Static checks: no external scripts/links/fonts/fetches in `index.html` (grep-verified); app script extracted from the single file and runs in a bare VM sandbox with no `document` (proves the logic layer is DOM-independent).
- Bugs found and fixed during verification:
  1. Week grid was labeled Sunday-first but filled Monday-first, so weekday names didn't match their dates — labels and buckets now derive from actual dates, bucket positions remapped (`(dayIndex + 6) % 7`).
  2. Times sorted alphabetically ("9:00 AM" after "2:00 PM") — replaced with a `timeKey()` chronological sort; untimed entries land last.
  3. Fast-category cadence skipped the 30-day renew-or-retier tier — added.
  4. Category notes only matched exact strings — added forgiving case-insensitive substring matching.
  5. All date math confirmed UTC-anchored (`parseISO`/`toISO` use `Date.UTC`), so day-boundary logic can't drift with the viewer's local timezone; covered by the "stable across the whole week" test over all 168 day-hour slots.

## Known gaps

- **Hour advice is U.S.-evening-heuristic.** Scores are opinionated defaults (Sunday 6–9 PM peaks) tuned to US habits; there's no per-buyer-time-zone adjustment. In-market users should lean on their category notes to override chips.
- **No time-zone handling for buyers.** Everything assumes your local evening ≈ your buyers' evening.
- **Sunset summary is free-text.** Listing/sold/unsold entries are manual strings counted per kind, not structured records with prices.
- **No import/export.** Data lives in one browser's localStorage; if that browser wipes it, it's gone. A JSON export/import button would be a safe next step.
- **Schedule items store one date each.** Items saved while viewing a later week appear in the column matching their weekday, and the week-picker lets you find them — but there's no explicit "this ends next Sunday" reminder tying an ending hour to its auction start date.
- **Smoke tests stub the DOM.** Rendering itself is exercised through handler output in the stubs; a real-browser screenshot pass (or Playwright once, locally, never in CI deps) would be the remaining belt-and-braces.
- **Print styling is conservative.** Verified logically via CSS rules, not visually on specific printers.

## Layout

```
index.html            the entire app (HTML + CSS + JS, single file)
package.json          test runner wiring only (npm test); no dependencies
LICENSE               MIT, Copyright (c) 2026 Asdale Dynamics, LLC
README.md             run/test docs, feature table, credits
tests/timing.test.js  unit tests: hour scoring, cadence, renewals, summaries
tests/smoke.test.js   boots the app against a stub DOM, clicks every panel
STATUS.md             this file
```
