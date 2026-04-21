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
- `startDate` — the window-start date in `YYYY-MM-DD` (UTC). Must exactly match one of the allowed start dates for the given interval — see `/api/openapi.json` or `src/config/start-dates.generated.ts` for the full enum.

Each file contains up to **1000 fully-closed candles** in Binance's native 12-tuple shape:

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

The Python generator is installed and run from this repo; it emits a real Python package to `./dist_python`.

```bash
# from the static-klines repo
npm i -D vovk-python
npx vovk bundle --from-templates py   # emits ./dist_python
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
npx vovk bundle --from-templates rs   # emits ./dist_rust
cd dist_rust && cargo publish
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

- **Start-date alignment**: `startDate` is not arbitrary — it's a window-start timestamp derived from `startDate + N × (intervalMs × 1000)`. Pick from the generated enum; any other value returns 404.
- **Decimal precision**: all OHLCV values are returned as strings. Convert to `Decimal` / `BigDecimal`, not float, if you care about precision.
- **Pre-listing windows**: pairs that listed later than the interval's configured start date return `[]` for early windows. Iterate forward until you hit the first non-empty window.
- **Future windows**: windows through 2040-01-01 are scaffolded with `[]` and filled in daily by GitHub Actions. If you want live data, re-fetch the latest window each call.
- **Data corrections**: Binance occasionally restates historical candles. This API is a cache — do not rely on it for audit-grade data. See the README for the experimental-project disclaimer.
