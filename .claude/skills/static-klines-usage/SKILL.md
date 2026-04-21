---
name: static-klines-usage
description: How to consume the static-klines API from TypeScript, Python, or Rust, how to call the raw REST endpoints, and how to extract the OpenAPI spec. Use when the user asks about fetching Binance klines data served by this repo.
---

# static-klines — consumer guide

This repository publishes historical Binance spot klines as **pre-rendered static JSON files**, served by Next.js static export. Every response is a plain JSON file on disk — no server-side compute, no rate limits, and every URL is cacheable forever.

Base URL (GitHub Pages default): `https://<owner>.github.io/static-klines/`
Local dev: `http://localhost:3000/`

## 1. Raw REST endpoints

### Candles

```
GET {base}/api/klines/{interval}/{symbol}/{startDate}.json
```

- `interval` — one of `15m`, `30m`, `1h`, `2h`, `4h`, `6h`, `8h`, `12h`, `1d`, `3d`, `1w`, `1M`.
- `symbol` — one of `BTCUSDT`, `ETHUSDT`, `BNBUSDT`, `SOLUSDT`, `XRPUSDT`, `ADAUSDT`, `DOGEUSDT`, `AVAXUSDT`, `LINKUSDT`, `DOTUSDT`.
- `startDate` — the window-start date in `YYYY-MM-DD` (UTC). Calendar-aligned (Monday of an ISO week, 1st of a month, 1st of Jan/Apr/Jul/Oct, etc.). Must exactly match one of the allowed start dates for the given interval — call `GET {base}/api/klines/start-dates/{interval}.json` for the runtime enum.

Each file holds the fully-closed Binance spot candles for one calendar-aligned window (always ≤ 1000 candles, so you can drop a file straight into a Binance-style tuple parser):

| Interval | Window | First anchor | ≤ candles/file |
|---------:|:-------|:-------------|:---------------|
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

Candles are in Binance's native 12-tuple shape:

```json
[
  [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBuyBase, takerBuyQuote, "0"]
]
```

`openTime` and `closeTime` are ms since epoch (UTC). All decimal fields are stringified to preserve precision.

Empty windows (symbol not yet listed, or future windows) return `[]`.

### OpenAPI spec

```
GET {base}/api/openapi.json
```

Returns an OpenAPI 3.1 document describing every endpoint, parameter enum, and the candle tuple. Feed this to Scalar, Swagger UI, or any OpenAPI-based client generator.

### Example: curl

```bash
curl -s https://<owner>.github.io/static-klines/api/klines/1d/BTCUSDT/2017-08-17.json | jq '.[0]'
curl -s https://<owner>.github.io/static-klines/api/openapi.json | jq '.paths | keys'
```

## 2. TypeScript client (Vovk RPC)

The repo generates a type-safe RPC client using `vovk-cli`. To publish it as an npm package:

```bash
# from the static-klines repo
npm run build              # also runs `vovk dev --next-dev --exit` which populates the client
npx vovk bundle            # emits the bundled client to ./dist
npm publish ./dist         # (after setting name, version in vovk.config.mjs outputConfig.package)
```

Consumer usage (after the package is published — replace `@static-klines/ts` with the actual published name):

```ts
import { KLinesAPI } from '@static-klines/ts';

// Point at the deployed static host
const candles = await KLinesAPI.getKlines1d(
  { params: { symbol: 'BTCUSDT', startDate: '2017-08-17' } },
  { apiRoot: 'https://<owner>.github.io/static-klines/api' },
);
```

All parameter enums, output shapes, and per-field descriptions come directly from the controller's Zod schema.

## 3. Python client (vovk-python)

The Python generator is installed and run from this repo; it emits a real Python package to `./dist_python`. Note: `vovk bundle` is TypeScript-only — Python and Rust use `vovk generate` instead.

```bash
# from the static-klines repo
npm i -D vovk-python
npx vovk generate --from py --out ./dist_python --origin https://<owner>.github.io/static-klines/api
cd dist_python && python -m build && twine upload dist/*
```

Consumer usage (package name is configured in `vovk.config.mjs`):

```python
from static_klines_py import KLinesAPI

candles = KLinesAPI.get_klines_1d(
    params={"symbol": "BTCUSDT", "startDate": "2017-08-17"},
    api_root="https://<owner>.github.io/static-klines/api",
)
```

## 4. Rust client (vovk-rust)

```bash
npm i -D vovk-rust
npx vovk generate --from rs --out ./dist_rust --origin https://<owner>.github.io/static-klines/api
cargo publish --manifest-path dist_rust/Cargo.toml
```

Consumer usage:

```rust
use static_klines_rs::k_lines_api::KLinesAPI;

let client = KLinesAPI::new("https://<owner>.github.io/static-klines/api");
let candles = client.get_klines_1d("BTCUSDT", "2017-08-17").await?;
```

## 5. Extracting OpenAPI for code generation

If you don't want to use the Vovk generators, point any OpenAPI-based tool at `/api/openapi.json`:

```bash
# openapi-typescript
npx openapi-typescript https://<owner>.github.io/static-klines/api/openapi.json \
  -o ./my-client.ts

# openapi-generator CLI (Java)
openapi-generator-cli generate \
  -i https://<owner>.github.io/static-klines/api/openapi.json \
  -g python -o ./my-python-client
```

## 6. Gotchas

- **Start-date alignment**: every `startDate` is a real calendar boundary (Monday for 15m/30m, 1st of month for 1h/2h, 1st of quarter for 4h, etc. — see the table above). Pick from the runtime enum (`/api/klines/start-dates/{interval}.json`); any other value returns 404.
- **Decimal precision**: all OHLCV values are returned as strings. Convert to `Decimal` / `BigDecimal`, not float, if you care about precision.
- **Pre-listing windows**: pairs that listed later than the interval's configured start date return `[]` for early windows. Iterate forward until you hit the first non-empty window.
- **Future windows**: windows through 2040-01-01 are scaffolded with `[]` and filled in daily by GitHub Actions. If you want live data, re-fetch the latest window each call.
- **Data corrections**: Binance occasionally restates historical candles. This API is a cache — do not rely on it for audit-grade data. See the README for the experimental-project disclaimer.
