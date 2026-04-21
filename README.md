# static-klines

Historical Binance Spot klines (candlestick) data, committed as static JSON files and kept fresh by a daily GitHub Action. Built on Next.js 16 + [Vovk.ts](https://vovk.dev) — every `(interval, symbol, window)` tuple is pre-rendered at build time into a static JSON file, then deployed to GitHub Pages.

> ⚠️ **Experimental project — data may be incomplete or imprecise.** This repository is a cache of Binance's public REST API; it is **not** audit-grade market data. Binance occasionally restates historical candles, and a daily-updating static cache cannot reflect that. Use the official Binance API if you need guaranteed freshness or correctness.

## Live site

- **Interactive docs (Scalar):** [https://&lt;owner&gt;.github.io/static-klines/](https://example.com)
- **OpenAPI spec:** `https://<owner>.github.io/static-klines/api/openapi.json`
- **Example candle:** `https://<owner>.github.io/static-klines/api/klines/1d/BTCUSDT/2017-08-17.json`

## Symbols

| # | Symbol |
|---|--------|
| 1 | BTCUSDT |
| 2 | ETHUSDT |
| 3 | BNBUSDT |
| 4 | SOLUSDT |
| 5 | XRPUSDT |
| 6 | ADAUSDT |
| 7 | DOGEUSDT |
| 8 | AVAXUSDT |
| 9 | LINKUSDT |
| 10 | DOTUSDT |

## Intervals, windows & start dates

Every `(symbol, interval)` series is partitioned into **calendar-aligned windows**. The `startDate` in every URL is a real, predictable calendar boundary — Monday of an ISO week, 1st of a month, 1st of Jan/Apr/Jul/Oct, etc. You can always guess the next URL in sequence without looking it up.

All windows are sized to fit within Binance's 1000-candles-per-request cap, so the fetch script never has to paginate inside a single window.

| Interval | Window | Anchor (first window) | ≤ candles/file |
|---------:|:-------|:----------------------|:---------------|
| `15m`  | 1 ISO week (Mon)            | 2023-01-02 | 672 |
| `30m`  | 2 ISO weeks (Mon)           | 2022-01-03 | 672 |
| `1h`   | 1 month (1st)               | 2018-01-01 | 744 |
| `2h`   | 2 months (1st)              | 2017-07-01 | 732 |
| `4h`   | 1 quarter (Jan/Apr/Jul/Oct) | 2017-07-01 | 546 |
| `6h`   | 6 months (Jan/Jul)          | 2017-07-01 | 732 |
| `8h`   | 6 months (Jan/Jul)          | 2017-07-01 | 546 |
| `12h`  | 1 year (Jan 1)              | 2017-01-01 | 732 |
| `1d`   | 2 years (Jan 1, even years) | 2016-01-01 | 732 |
| `3d`   | 5 years (Jan 1)             | 2015-01-01 | 609 |
| `1w`   | 10 years (Jan 1)            | 2010-01-01 | 522 |
| `1M`   | 10 years (Jan 1)            | 2010-01-01 | 120 |

Pairs that listed later than an interval's anchor simply have leading empty `[]` windows until their listing — iterate forward. Future windows (through 2040-01-01) are scaffolded with `[]` and populated daily by the GitHub Action.

**Full enum at runtime:** `GET /api/klines/start-dates/{interval}.json` returns the ordered list of every valid `startDate` for the given interval. The TypeScript / Python / Rust clients expose this as `getStartDates({ interval })`.

## How it works

### Pre-rendered static files

Each URL under `/api/klines/{interval}/{symbol}/{startDate}.json` is a plain static JSON file. There is no server-side compute at request time — Next.js's `generateStaticParams` enumerates every `(interval, symbol, startDate)` tuple at **build** time, invokes the Vovk controller once per tuple, and writes the response to disk. The output directory is published to GitHub Pages as-is.

Consequences:
- **Infinite cache lifetime.** The content of any URL with a `startDate` in the past never changes.
- **No rate limits.** You're hitting a static file, not an API.
- **Fast, globally CDN'd.** GitHub Pages serves the files from its edge.
- **Reproducible.** Anyone can re-build the site deterministically from the committed `.klines-cache/`.

### Cache layout

```
.klines-cache/{SYMBOL}/{interval}/{YYYY-MM-DD}.json
```

- Each file holds up to **1000 candles** (the Binance API hard cap per request).
- Filename is the UTC date of the window's first `openTime`. The window stride is `intervalMs × 1000`.
- Only fully-closed candles are written (the currently-open candle is skipped).
- Files are **committed to git** — the cache *is* the dataset.

### Window alignment

The `startDate` path parameter is **not** arbitrary. It must match one of the pre-computed window-start dates for the given interval — see [`src/config/start-dates.generated.ts`](src/config/start-dates.generated.ts) or [`/api/openapi.json`](https://example.com/api/openapi.json) for the full enum. Any other date returns 404.

Empty windows (symbol not yet listed on Binance at that time, or future windows scaffolded ahead of the fill script) return `[]`. Iterate forward until you hit the first non-empty window.

### Daily refresh via GitHub Actions

[`.github/workflows/fetch-daily.yml`](.github/workflows/fetch-daily.yml) runs at **03:17 UTC every day** (and on `workflow_dispatch`). It:

1. Checks out `main`.
2. Runs `npm run fetch:klines` — pulls the latest fully-closed candles from the Binance REST API, appending to (or rewriting the tail of) existing JSON files.
3. Commits updated `.klines-cache/` files as `github-actions[bot]`.
4. Runs `next build` — re-renders all 13k+ static files from the refreshed cache.
5. Deploys `./out` to GitHub Pages via the Pages deployment API (no push to a branch → no workflow loops).

Concurrency is set to `cancel-in-progress: false` so overlapping triggers queue up rather than stepping on each other. The deploy step uses the GitHub Pages deployment API rather than pushing to a `gh-pages` branch, so it won't re-trigger the workflow.

## Clients

Three auto-generated, type-safe clients are published from the same Zod schemas the server uses:

- **TypeScript** — `npx vovk bundle` → `./dist` → `npm publish`
- **Python** — `npx vovk bundle --from-templates py` → `./dist_python` → `twine upload`
- **Rust** — `npx vovk bundle --from-templates rs` → `./dist_rust` → `cargo publish`

See [`.claude/skills/static-klines-usage/SKILL.md`](.claude/skills/static-klines-usage/SKILL.md) for full usage examples.

If you don't want Vovk's generators, point any OpenAPI 3.1 client tool at [`/api/openapi.json`](https://example.com/api/openapi.json).

## Scripts

```bash
npm run dev                                    # Next.js + Vovk in dev mode
npm run fetch:klines                           # pull latest candles into .klines-cache
FETCH_LIMIT_PAIRS=BTCUSDT \
  FETCH_LIMIT_INTERVALS=1d \
  npm run fetch:klines                         # narrow smoke test
npm run fetch:klines:dry                       # print intended writes, no fs changes
npm run scaffold:cache                         # scaffold empty cache files for new windows/intervals
npm run generate:start-dates                   # regen src/config/start-dates.generated.ts
npm run build                                  # prebuild runs vovk dev --exit → next build → ./out
npm run check                                  # Biome format + lint
```

Requires **Node 24+** (native TypeScript stripping + decorators).

## Notes for contributors

- `.klines-cache/` and `.vovk-schema/` are both **intentionally committed**. `.vovk-schema/` is needed by `vovk generate` in CI; `.klines-cache/` is the dataset itself.
- Never set `"private": false` on this root package — the repo is not an npm package. The published client libraries live under `./dist` (TS), `./dist_python` (Python), `./dist_rust` (Rust), each with its own `package.json` / `pyproject.toml` / `Cargo.toml`.
- If you shift a start date, move `END_DATE_EXCLUSIVE`, or add an interval, wipe the corresponding cache subdirectory **before** re-scaffolding — window alignment changes when the start date changes.
