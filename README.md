# static-klines

[![CI](https://github.com/finom/static-klines/actions/workflows/nextjs.yml/badge.svg)](https://github.com/finom/static-klines/actions/workflows/nextjs.yml)
[![npm version](https://img.shields.io/npm/v/static-klines.svg?label=npm%20%7C%20static-klines)](https://www.npmjs.com/package/static-klines)
[![PyPI version](https://img.shields.io/pypi/v/static-klines.svg?label=PyPI%20%7C%20static-klines)](https://pypi.org/project/static-klines/)
[![Vovk.ts](https://badgen.net/badge/Built%20with/Vovk.ts/333333?icon=https://vovk.dev/icon-white.svg)](https://vovk.dev)

Pre-rendered historical Binance Spot klines for the **top 10 USDT pairs**, served as plain static JSON on GitHub Pages.

**Goal:** offer a static, easily accessible, fast API and matching client libraries (TypeScript, Python) for historical Binance Spot klines. Built as a zero-setup dataset for **AI model training, backtesting, and other crypto data experiments** where you just want candles in a fetch call without signing up, paying, or managing rate limits.

Every `(interval, symbol, window)` tuple is pre-rendered at build time into a plain JSON file on GitHub Pages. No rate limits, no server-side compute, infinitely cacheable, globally CDN'd. The repo *is* the dataset.

> ⚠️ **Experimental — not audit-grade data.** This is a community cache of Binance's public REST API, refreshed once a day. Binance occasionally restates historical candles; a daily cache can't reflect that. Don't use it for trading or compliance — fine for ML datasets, charts, backtests, and exploratory analysis.

## Live site

- **Interactive docs (Scalar):** https://finom.github.io/static-klines/
- **OpenAPI spec:** https://finom.github.io/static-klines/api *(the API root serves the OpenAPI document directly)*

### Try it — open any of these

- https://finom.github.io/static-klines/api/klines/symbols.json — list of supported trading pairs
- https://finom.github.io/static-klines/api/klines/start-dates/1d.json — every valid `startDate` for the 1d interval
- https://finom.github.io/static-klines/api/klines/1d/BTCUSDT/2018-01-01.json — 2 years of BTCUSDT daily candles starting Jan 1, 2018
- https://finom.github.io/static-klines/api/klines/1h/ETHUSDT/2024-01-01.json — January 2024 hourly candles for ETHUSDT
- https://finom.github.io/static-klines/api/klines/15m/SOLUSDT/2024-01-01.json — first week of 2024, 15-minute SOLUSDT candles

## Symbols

`BTCUSDT`, `ETHUSDT`, `BNBUSDT`, `SOLUSDT`, `XRPUSDT`, `ADAUSDT`, `DOGEUSDT`, `AVAXUSDT`, `LINKUSDT`, `DOTUSDT`.

## Intervals & windows

Every `startDate` is a real, predictable calendar boundary — you can guess the next URL in sequence without looking it up. Windows are sized to fit within Binance's 1000-candles-per-request cap.

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
| `1M`   | 20 years (Jan 1)            | 2010-01-01 | 240 |

Pairs that listed later than the interval's anchor return empty `[]` for leading windows; iterate forward. Future windows (through 2040-01-01) are scaffolded empty and populated daily.

Call `GET /api/klines/start-dates/{interval}.json` (or `KLinesAPI.getStartDates({ interval })` in any client) for the full ordered enum of valid startDates.

## Clients

Auto-generated from the same Zod schemas the server uses:

- **TypeScript** — `npx vovk bundle` → `./dist` → `npm publish ./dist`
- **Python** — `npx vovk generate --from py --out ./dist_python` → `python -m build && twine upload`

`npm run patch` chains the whole release: bump version → bundle both → publish to npm and PyPI → tag + push.

Or bypass the generators entirely: point any OpenAPI 3.1 tool at `/api` (the root endpoint returns the full spec).

## Daily refresh

[`.github/workflows/fetch-daily.yml`](.github/workflows/fetch-daily.yml) runs at 03:17 UTC daily (and on `workflow_dispatch`):

1. `npm run fetch:klines` — pulls new fully-closed candles. Uses a fallback chain of Binance hosts (`data-api.binance.vision` → `api.binance.com` → `api1-4` → `data.binance.com`) so US-hosted runners work despite the geo-block on `api.binance.com`.
2. Commits `.klines-cache/` if anything changed.
3. `next build` re-renders every static page from the refreshed cache.
4. Deploys `out/` to GitHub Pages via the Pages deployment API (no push-loop).

## Scripts

```bash
npm run dev                # Next.js + Vovk dev server
npm run fetch:klines       # pull latest candles into .klines-cache
npm run fetch:klines:dry   # log intended writes, no fs changes
npm run build              # vovk dev --exit → next build → ./out
npm test                   # node --test tests/*.mts (API + TS client integration)
npm run check              # Biome format + lint
```

Requires **Node 24+** (native TypeScript stripping + decorators).

## Using this from Claude Code — skill installation

This repo ships a Claude Code skill at [`.claude/skills/static-klines-usage/SKILL.md`](.claude/skills/static-klines-usage/SKILL.md). It teaches the agent how to call every endpoint, install the TypeScript or Python client, and resolve the calendar-aligned `startDate` enum — so you can say *"fetch me BTCUSDT daily candles for 2018 from static-klines"* and Claude will know exactly which URL to hit.

### Install globally (use it from any directory)

```bash
npx skills add finom/static-klines --skill static-klines-usage -g -a claude-code -y
```

This drops the skill into `~/.claude/skills/static-klines-usage/`. The skill autoloads on any prompt mentioning Binance klines, OHLCV history, or candle-fetching from this API.

### Install project-local (just this repo)

Already installed if you cloned this repo — the skill is committed at `.claude/skills/static-klines-usage/`. Claude Code discovers it automatically when you open the directory.

```bash
npx skills add finom/static-klines --skill static-klines-usage -a claude-code -y
# (omit -g → installs to ./.claude/skills/ in the current project)
```

### Manual install (no CLI)

```bash
git clone https://github.com/finom/static-klines /tmp/sk
cp -r /tmp/sk/.claude/skills/static-klines-usage ~/.claude/skills/   # global
# or into your project's ./.claude/skills/
```

Verify with `ls ~/.claude/skills/` — no further setup; the next Claude Code session picks it up.

## Contributor notes

- `.klines-cache/` and `.vovk-schema/` are both **intentionally committed**. The cache *is* the dataset; the schema is needed by `vovk generate` in CI.
- The root `package.json` is `private: true` — it isn't itself an npm package. Published client libraries live under `./dist` (TypeScript) and `./dist_python` (Python), each with its own manifest.
- If you shift a start date or add an interval, wipe the corresponding cache subdirectory and re-scaffold — window alignment depends on the anchor.
