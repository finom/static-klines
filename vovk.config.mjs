// @ts-check
import { readFileSync } from 'node:fs';

const rootPkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const origin = 'https://finom.github.io';
const basePath = '/static-klines';
const apiRoot = `${origin}${basePath}/api`;

const PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT',
];

const INTERVAL_WINDOWS = [
  ['15m', '1 ISO week (Mon)',            '2024-12-30', '672'],
  ['30m', '2 ISO weeks (Mon)',           '2024-01-01', '672'],
  ['1h',  '1 month (1st)',               '2022-01-01', '744'],
  ['2h',  '2 months (1st)',              '2017-07-01', '732'],
  ['4h',  '1 quarter (Jan/Apr/Jul/Oct)', '2017-07-01', '546'],
  ['6h',  '6 months (Jan/Jul)',          '2017-07-01', '732'],
  ['8h',  '6 months (Jan/Jul)',          '2017-07-01', '546'],
  ['12h', '1 year (Jan 1)',              '2017-01-01', '732'],
  ['1d',  '2 years (Jan 1, even)',       '2016-01-01', '732'],
  ['3d',  '5 years (Jan 1)',             '2015-01-01', '609'],
  ['1w',  '10 years (Jan 1)',            '2010-01-01', '522'],
  ['1M',  '20 years (Jan 1)',            '2010-01-01', '240'],
];

const intervalsTable = INTERVAL_WINDOWS
  .map(([i, window, anchor, max]) => `| \`${i}\` | ${window} | ${anchor} | ≤ ${max} |`)
  .join('\n');

const symbolsList = PAIRS.map((p) => `\`${p}\``).join(', ');

const description = `Type-safe, auto-generated client for the **static-klines** API — historical Binance spot klines served as pre-rendered static JSON. No rate limits, infinite cache lifetime, globally CDN'd.`;

const banner = `
**static-klines** — pre-rendered historical Binance spot klines for the top 10 USDT pairs, served as plain static JSON files on GitHub Pages. Built as a zero-setup dataset for AI model training, backtesting, and other crypto data experiments where you just want candles in a fetch call without signing up, paying, or managing rate limits.

No rate limits, infinite cache lifetime, globally CDN'd. Every URL is a committed JSON file — the repo itself *is* the dataset.

**Interactive docs:** ${origin}${basePath}/
**OpenAPI spec:** ${apiRoot}  ← a GET on the API root returns the full OpenAPI 3.1 document

### Try it — open any of these in a browser

- [${apiRoot}/klines/symbols.json](${apiRoot}/klines/symbols.json) — list of supported trading pairs
- [${apiRoot}/klines/start-dates/1d.json](${apiRoot}/klines/start-dates/1d.json) — every valid \`startDate\` for the 1d interval
- [${apiRoot}/klines/1d/BTCUSDT/2018-01-01.json](${apiRoot}/klines/1d/BTCUSDT/2018-01-01.json) — 2 years of BTCUSDT daily candles starting Jan 1, 2018
- [${apiRoot}/klines/1h/ETHUSDT/2024-01-01.json](${apiRoot}/klines/1h/ETHUSDT/2024-01-01.json) — January 2024 hourly candles for ETHUSDT
- [${apiRoot}/klines/15m/SOLUSDT/2025-01-06.json](${apiRoot}/klines/15m/SOLUSDT/2025-01-06.json) — first full week of 2025, 15-minute SOLUSDT candles

### Supported symbols

${symbolsList} — the 10 largest USDT pairs on Binance spot.

### Supported intervals

Every \`startDate\` is a real calendar boundary — you can guess the next URL in sequence without looking it up. Call \`getStartDates({ interval })\` for the full enum.

| Interval | Window | Anchor (first window) | ≤ candles/file |
|---------:|:-------|:----------------------|:----------------|
${intervalsTable}

Each file contains the fully-closed Binance spot candles that fall inside that calendar window (always ≤1000). Pre-listing windows return \`[]\`; future windows are scaffolded as \`[]\` and populated daily by GitHub Actions.

> **⚠️ Experimental / not audit-grade.** This is a community cache of Binance's public REST API, refreshed once a day. Binance occasionally restates historical candles and a daily cache can't reflect that. Don't use it for trading or compliance — fine for ML datasets, charts, backtests, and exploratory analysis.
`.trim();

const sharedPackage = {
  name: 'static-klines',
  version: rootPkg.version,
  description,
  license: 'MIT',
  author: 'Andrey Gubanov',
  repository: {
    type: 'git',
    url: 'https://github.com/finom/static-klines.git',
  },
  homepage: `${origin}${basePath}/`,
  bugs: {
    url: 'https://github.com/finom/static-klines/issues',
  },
  keywords: ['binance', 'klines', 'candles', 'ohlcv', 'crypto', 'vovk'],
  py_name: 'static_klines',
};

const sharedReadme = {
  banner,
  description,
};

/** @type {import('vovk').VovkConfig} */
const config = {
  outputConfig: {
    // Mirror Next.js's basePath here so `vovk dev --exit` queries the correct
    // schema URL during prebuild. Without this, with BASE_PATH=/static-klines
    // set, Next serves /static-klines/api/_schema_ while vovk (default origin
    // '') probes /api/_schema_ and hits 404 — result: openapi.json deploys
    // with empty `paths`. Published clients get their real origin from
    // bundle.outputConfig.origin (TS) and the --origin flag on `vovk generate`
    // (Python), so this path-only value doesn't leak into the libraries.
    origin: process.env.BASE_PATH || '',
    imports: {
      validateOnClient: 'vovk-ajv',
    },
    openAPIObject: {
      info: {
        title: 'static-klines',
        version: rootPkg.version,
        description,
        license: { name: 'MIT' },
      },
      servers: [{ url: apiRoot, description: 'GitHub Pages (production)' }],
    },
    package: sharedPackage,
    readme: sharedReadme,
    samples: { apiRoot },
  },
  moduleTemplates: {
    controller: 'vovk-cli/module-templates/zod/controller.ts.ejs',
    service: 'vovk-cli/module-templates/type/service.ts.ejs',
  },
  bundle: {
    outDir: './dist',
    build: async ({ entry, outDir }) => {
      const { build } = await import('tsdown');
      await build({
        entry,
        dts: true,
        format: 'esm',
        fixedExtension: true,
        outDir,
        platform: 'neutral',
        noExternal: ['!next/**'],
      });
    },
    outputConfig: {
      // NB: origin here must NOT include `/api` — vovk-cli appends rootEntry
      // ("api" by default) on top to produce the final apiRoot. If you pass
      // the full apiRoot here you get `.../api/api` as the client's default
      // URL.
      origin: `${origin}${basePath}`,
      package: {
        ...sharedPackage,
        type: 'module',
        main: './index.mjs',
        types: './index.d.mts',
        exports: {
          '.': {
            types: './index.d.mts',
            default: './index.mjs',
          },
        },
        files: ['index.mjs', 'index.d.mts', 'README.md'],
      },
      readme: {
        ...sharedReadme,
        installCommand: 'npm install static-klines',
      },
      samples: { apiRoot },
    },
  },
};

export default config;
