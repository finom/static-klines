---
name: static-klines-usage
description: How to consume the static-klines API from TypeScript or Python, how to call the raw REST endpoints, and how to extract the OpenAPI spec. Use when the user asks about fetching Binance klines data served by this repo.
---

# static-klines — consumer guide

Pre-rendered historical Binance spot klines for the top 10 USDT pairs. Every URL is a plain static JSON file on GitHub Pages — no rate limits, no server-side compute, infinitely cacheable.

Base URL: `https://finom.github.io/static-klines/api`
Interactive docs: `https://finom.github.io/static-klines/`

## 1. Raw REST endpoints

### OpenAPI spec — served at the API root

```
GET /api
```

Returns an OpenAPI 3.1 document describing every endpoint, every parameter enum, and the candle tuple. Feed it to Scalar, Swagger UI, or any OpenAPI-based client generator.

### Supported symbols

```
GET /api/klines/symbols.json
```

Returns the hardcoded list of 10 Binance spot trading pairs.

### Valid start dates per interval

```
GET /api/klines/start-dates/{interval}.json
```

- `interval` ∈ `{15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M}`
- Returns the ordered list of valid `startDate` values for candle requests at that interval. Every value is a real calendar boundary (Monday, 1st of month, 1st of quarter, etc.).

### Candles

```
GET /api/klines/{interval}/{symbol}/{startDate}.json
```

- `symbol` ∈ the `/api/klines/symbols.json` list
- `startDate` ∈ the `/api/klines/start-dates/{interval}.json` list

Each file holds the fully-closed candles for one calendar-aligned window (always ≤ 1000 per file):

| Interval | Window | First anchor | ≤ candles/file |
|---------:|:-------|:-------------|:---------------|
| `15m`  | 1 ISO week (Mon)            | 2024-12-30 | 672 |
| `30m`  | 2 ISO weeks (Mon)           | 2024-01-01 | 672 |
| `1h`   | 1 month (1st)               | 2022-01-01 | 744 |
| `2h`   | 2 months (1st)              | 2017-07-01 | 732 |
| `4h`   | 1 quarter (Jan/Apr/Jul/Oct) | 2017-07-01 | 546 |
| `6h`   | 6 months (Jan/Jul)          | 2017-07-01 | 732 |
| `8h`   | 6 months (Jan/Jul)          | 2017-07-01 | 546 |
| `12h`  | 1 year (Jan 1)              | 2017-01-01 | 732 |
| `1d`   | 2 years (Jan 1, even years) | 2016-01-01 | 732 |
| `3d`   | 5 years (Jan 1)             | 2015-01-01 | 609 |
| `1w`   | 10 years (Jan 1)            | 2010-01-01 | 522 |
| `1M`   | 20 years (Jan 1)            | 2010-01-01 | 240 |

Candles are in Binance's native 12-tuple shape:

```json
[openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBuyBase, takerBuyQuote, "0"]
```

`openTime` / `closeTime` are ms since epoch (UTC). All decimal fields are strings (convert to `Decimal` / `BigDecimal`, not float, if precision matters).

Pre-listing windows (symbol not yet on Binance) and future windows (scaffolded ahead of the daily fill) return `[]`.

### Example: curl

```bash
curl -s https://finom.github.io/static-klines/api | jq '.paths | keys'
curl -s https://finom.github.io/static-klines/api/klines/symbols.json
curl -s https://finom.github.io/static-klines/api/klines/start-dates/1d.json
curl -s https://finom.github.io/static-klines/api/klines/1d/BTCUSDT/2018-01-01.json | jq '.[0]'
```

## 2. TypeScript client

```bash
npm install static-klines
```

```ts
import { KLinesAPI } from 'static-klines';

const symbols = await KLinesAPI.getSymbols();
const startDates = await KLinesAPI.getStartDates({ params: { interval: '1d' } });
const candles = await KLinesAPI.getKlines1d({
  params: { symbol: 'BTCUSDT', startDate: '2018-01-01' },
});
```

The default `apiRoot` is the production URL. Override for a fork or preview deploy:

```ts
const candles = await KLinesAPI.getKlines1d({
  params: { symbol: 'BTCUSDT', startDate: '2018-01-01' },
  apiRoot: 'https://my-fork.github.io/static-klines/api',
});
```

All parameter enums, output shapes, and per-field descriptions come directly from the server's Zod schemas.

## 3. Python client

```bash
pip install static-klines
```

```python
from static_klines import KLinesAPI

symbols = KLinesAPI.get_symbols()
start_dates = KLinesAPI.get_start_dates(params={"interval": "1d"})
candles = KLinesAPI.get_klines_1d(params={"symbol": "BTCUSDT", "startDate": "2018-01-01"})
```

Override `api_root=` the same way.

## 4. Extracting OpenAPI for other client generators

If you don't want to use the TypeScript or Python clients, point any OpenAPI 3.1 tool at the API root:

```bash
npx openapi-typescript https://finom.github.io/static-klines/api -o ./my-client.ts

openapi-generator-cli generate \
  -i https://finom.github.io/static-klines/api \
  -g python -o ./my-python-client
```

## 5. Gotchas

- **Start-date alignment**: `startDate` is not arbitrary — it has to come from `/api/klines/start-dates/{interval}.json`. Every value there is a real calendar boundary matching the stride table above. Any other value returns 404.
- **Decimal precision**: all OHLCV values are returned as strings. Convert to `Decimal` / `BigDecimal`, not `float`, if you care about precision.
- **Pre-listing windows**: pairs listed later than the interval's anchor return `[]` for early windows. Iterate forward until you hit the first non-empty window.
- **Future windows**: windows through 2040-01-01 are scaffolded with `[]` and filled in daily by a GitHub Action. Re-fetch the latest window if you want today's partial data — though only fully-closed candles are written.
- **Data corrections**: Binance occasionally restates historical candles. This API is a daily cache — don't rely on it for trading or compliance-grade data. Fine for ML datasets, backtests, and exploratory analysis.
