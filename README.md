# static-klines

Historical Binance Spot klines (candlestick) data, committed as static JSON files and kept fresh by a daily GitHub Action. Scaffolded on Next.js 16 + [Vovk.ts](https://vovk.dev) for a future type-safe RPC / npm library layer.

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

## Intervals & start dates

Each `(symbol, interval)` series is fetched from its configured start date up to the latest fully-closed candle. Pairs that listed later than the configured start date will simply have empty windows until their listing — the script advances automatically.

| Interval | Start date | Rationale |
|---------:|:-----------|:----------|
| `15m`  | 2020-01-01 | user-specified; smallest supported granularity |
| `30m`  | 2019-01-01 | |
| `1h`   | 2018-01-01 | |
| `2h`   | 2017-08-17 | Binance launch; first BTCUSDT candle |
| `4h`   | 2017-08-17 | |
| `6h`   | 2017-08-17 | |
| `8h`   | 2017-08-17 | |
| `12h`  | 2017-08-17 | |
| `1d`   | 2017-08-17 | |
| `3d`   | 2017-08-17 | |
| `1w`   | 2017-08-17 | |
| `1M`   | 2017-08-01 | month-aligned |

## Cache layout

```
.klines-cache/{SYMBOL}/{interval}/{YYYY-MM-DD}.json
```

- Each file holds up to **1000 candles** (the Binance API hard cap per request).
- File name is the UTC date of the window's first openTime.
- Only fully-closed candles are written (the currently-open candle is skipped).
- Files are committed to git.

## Scripts

```bash
npm run dev                                    # Next.js + Vovk in dev mode
npm run fetch:klines                           # pull latest candles into .klines-cache
FETCH_LIMIT_PAIRS=BTCUSDT \
  FETCH_LIMIT_INTERVALS=1d \
  npm run fetch:klines                         # narrow smoke test
npm run fetch:klines:dry                       # print intended writes, no fs changes
npm run check                                  # Biome format + lint
```

Requires **Node 24+** (native TypeScript stripping + decorators).
