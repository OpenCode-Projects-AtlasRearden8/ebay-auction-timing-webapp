# eBay Auction Timing

**When to end your listing — explained like a friend would.**

eBay Auction Timing is a tiny offline web app for resellers, flea-market diggers, and garage-sale flippers. It tells you **which hour to end an auction, when to relist an item that didn't sell, and what this week's selling rhythm looks like** — with reason chips that explain every suggestion in plain English.

Money math it does not do. For fees, margins, and break-even prices, pair it with its sibling tool, **ebay-profit-calculator-cli** (this app owns the *when*, that one owns the *how much*).

---

## What's inside

Seven small sections, each doing one job:

| Section | What it does |
| --- | --- |
| **Best end times** | Ranks all 24 hours for the day your auction ends. Every slot gets a verdict (Gold / Good / So-so / Risky) and reason chips — e.g. *"Sunday evening = the classic eBay sweet spot"*, *"Garage-sale hours: buyers are hunting, not bidding"*. Save slots straight to the schedule. |
| **Weekend windows** | The flipper rhythm: source Saturday, photograph Saturday afternoon, schedule listings Sunday so they end the *following* Sunday evening, when the week's bidding peaks. One button drops the whole rhythm on the schedule. |
| **Relist cadence planner** | Enter when an item was first listed and how its category usually behaves. You get a plain next step with a date: wait, watch, relist on a *rotated* evening (Sunday hot slot / midweek rotation), reframe photos, or renew-or-retire at the 30-day mark. Fast categories get fast answers; slow ones get patient ones. |
| **Category notes** | Your own seller's notebook: for each category, does it *sell fast* or *sit slow*, plus a one-line note to future-you. The relist planner reads these notes automatically (fuzzy match included — type "used video games" and it finds your "Video Games" note). |
| **Renewal nudges** | Store subscriptions and Good-'Til-Cancelled checkpoints sneak up on you. Add the date; this panel counts down and turns amber at one week, red when it's now or past due. Includes one-click presets. |
| **Sunset summary** | End-of-day recap: log what got listed, sold, or failed, and get today-in-numbers plus tomorrow's nudge (unsold items become a scheduled relist task). |
| **Weekly schedule** | Everything saved lands on a Monday-through-Sunday grid. Hit **Print** for a clean, pin-it-by-the-packing-table printable (the paper copy hides buttons, tabs, and screens). |

## How to run it

No install, no build, no accounts.

1. Download `index.html`.
2. Double-click it (or open it from your browser's *Open File…*). Anything modern — Chrome, Edge, Firefox, Safari — works straight from `file://`.
3. That's it. It stays fully offline; there is nothing to sign into.

Your notes, schedule items, renewal targets, and daily logs live in that browser's **localStorage**. Nothing is scraped, nothing leaves your machine, and there are no network calls in the code at all. The schedule page has a *Clear* button if you ever want a clean slate.

## How to test it

Zero dependencies, so this is just Node:

```bash
npm test        # runs node --test tests/ (34 tests)
```

The suite covers the timing logic (hour scoring across all 168 day-hour slots), the cadence planner's wait / relist / rotate / reframe / renew phases, renewal countdown tiers, and end-of-day roll-ups — plus a smoke test that boots the whole app against a stub DOM and clicks through every panel to confirm it works offline, with an empty storage, and again with saved data.

## The thinking, briefly

- **Sunday evening rules.** Peak browsing runs roughly 5–9 PM in the buyer's time zone; 6–8 PM is the gold band. A 7-day auction scheduled the previous week should end there.
- **Dead zones are real.** Overnight and Saturday daytime lose bids — on Saturday mornings your competition is literally a garage sale.
- **Relists are a rotation, not a repost.** Change the ending evening each round; same slot, same result.
- **30 days is the verdict line.** Renew what earned watchers; retire (or reframe) what sat cold.
- **Defaults, not laws.** Your category notes exist to override the chips. Keep what your own experience teaches you.

## Files

- `index.html` — the entire app (HTML + CSS + JS in one file, zero dependencies)
- `tests/timing.test.js` — unit tests for hour and cadence logic
- `tests/smoke.test.js` — boots the app against a stub DOM and exercises every panel
- `STATUS.md` — build status, verification results, and known gaps

## Who made it

Built and maintained by **Asdale Dynamics, LLC** — plain-English, tested, local-first tools from Dylan Asdale (*The Massive AI Manual*, dylanasdale.github.io). Feedback and PRs welcome; keep PRs small and dependency-free.

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 Asdale Dynamics, LLC.

*This tool offers selling guidance, not financial or medical advice. Experience varies by market — the chips are starting points, and your data stays yours.*
