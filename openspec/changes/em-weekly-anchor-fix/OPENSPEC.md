# Expected Moves: weekly anchor + tier semantics fix

**Status:** Proposed → Implemented
**Owner:** Idan / Kash
**Date:** 2026-04-17

## Why

User observed on Fri Apr 17 (pre-open): every ticker on the EM page showed
"50% of range" in the Position column. That's statistically impossible.

Root cause (two bugs stacked):

1. **`window.btPrices` was never exposed.** Top-level `const` in a classic
   `<script>` is not global, so `btPrices.price(sym)` returned `undefined`
   and the fallback chain collapsed to `wl.price` which equals the EM
   anchor close — forcing 50%. (**Fixed in commit `9ece6f0`.**)

2. **Weekly EM was not actually weekly.** The exporter picked the nearest
   option expiry in a 1–8 DTE window *every night* and labeled it
   "weekly". On a Thursday run for a Friday expiry, that meant:

   - `weekly_dte = 1` (literally one-day straddle!)
   - `weekly.value = straddle_of_1DTE * 0.85` (way too small)
   - anchor = yesterday's close, not last Friday's close
   - range recenters daily, shrinking as expiry approaches

   By Tom's framework the weekly EM should be **anchored at last Friday's
   close** and derived from **that Friday's ATM straddle for the NEXT
   Friday expiry**. It should be constant Mon→Fri until the next weekly
   roll. What we had was effectively a rolling "days-to-friday" EM.

## What changes

### Exporter (`scripts/update-expected-moves.py`)

1. **Weekly anchor is last Friday's close.** New helper
   `find_weekly_anchor_close(history)` returns the close of the most
   recent Friday (or pre-holiday effective Friday) from the stored
   `history` array. Falls back to same-day close on first run.

2. **Weekly straddle is locked at Friday's value.** When running Mon–Thu
   with `--tier daily`, do NOT recompute `weekly` at all. Preserve the
   existing `weekly` block from last Friday's run so anchor + straddle +
   bands stay constant through the week.

3. **Friday run writes the definitive weekly band.**
   - Anchor = today's close (which *becomes* last-Friday anchor for the
     next week)
   - Straddle = ATM straddle priced today for the 5–10 DTE (next-Friday)
     expiry — not the 1-DTE expiring-tomorrow contract
   - `weekly_anchor_date` field added so the UI can display the anchor
     explicitly ("Anchor: Fri Apr 10 $610.19")

4. **New fields in each ticker object:**
   ```json
   "weekly": {
     "value": 9.78, "pct": 1.60,
     "upper": 619.97, "lower": 600.41,
     "anchor_close": 610.19,      // <-- NEW
     "anchor_date": "2026-04-10",  // <-- NEW
     "straddle": 11.51,            // <-- NEW (weekly straddle specifically)
     "expiry": "20260417"          // <-- NEW (Friday we're pricing to)
   }
   ```

5. **Tier-guarded merge.** When the exporter writes with `--tier daily`,
   it only rewrites `close`, `spot`, `updated`, `daily`, and appends to
   `history`. It **does NOT touch** the `weekly` / `monthly` / `quarterly`
   blocks on daily runs. This is the single most important invariant.

### Dashboard (`js/pages/expected-moves.js`)

1. **Display the weekly anchor.** Under the "Weekly" tier header, show
   "Anchor: Fri MMM DD $XXX.XX" so users trust where the band came from.

2. **No client-side recompute by default.** The exporter is now the
   source of truth. However, add a `BT.recomputeEM(ticker, tier)` utility
   (non-destructive; returns computed values) for debugging.

3. **Consume new fields.** If `tier.anchor_close` present, use it for
   range math and for the subtitle label. If absent (older data), fall
   back to current behavior for one release cycle.

## Non-goals

- No change to daily tier semantics (it's legit a 1-DTE / overnight EM).
- No change to monthly/quarterly tiers.
- No change to IB data path contract — both paths (`yf_process_ticker`,
  `ib_process_ticker`) get the same anchor/straddle selection logic.

## Guardrails against regression

1. Python unit test `tests/test_em_weekly_anchor.py`:
   - Given a mock history with a Friday close $100 and a Thursday close
     $110, weekly anchor must be $100 not $110.
   - Mon–Thu daily run must leave `weekly` block byte-identical to prior
     state.
   - Friday run must write new `weekly` with `anchor_date` = today.

2. Jest test `tests/em-weekly-render.test.js` (document-level):
   - Given `weekly.anchor_close` present, position math uses it.
   - Given `weekly.anchor_close` absent, falls back to `close`.

3. **Rule encoded in MEMORY.md (already present):** "EM anchor must NEVER
   be updated to live price. Anchor = previousClose always." — extend to
   weekly: "Weekly anchor = last Friday close, locked for the whole week."

## Rollout

1. Merge exporter + tests.
2. Run `--tier all` manually post-merge to seed the `anchor_close`
   fields across all tickers (backfill). Otherwise the first daily run
   would skip rewriting weekly and leave the stale 1-DTE values.
3. Deploy dashboard changes.
4. Verify on open Friday that `anchor_date` is today and band matches
   expectation.
