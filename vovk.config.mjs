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
  ['15m', '1 ISO week (Mon)',            '2023-01-02', '672'],
  ['30m', '2 ISO weeks (Mon)',           '2022-01-03', '672'],
  ['1h',  '1 month (1st)',               '2018-01-01', '744'],
  ['2h',  '2 months (1st)',              '2017-07-01', '732'],
  ['4h',  '1 quarter (Jan/Apr/Jul/Oct)', '2017-07-01', '546'],
  ['6h',  '6 months (Jan/Jul)',          '2017-07-01', '732'],
  ['8h',  '6 months (Jan/Jul)',          '2017-07-01', '546'],
  ['12h', '1 year (Jan 1)',              '2017-01-01', '732'],
  ['1d',  '2 years (Jan 1, even)',       '2016-01-01', '732'],
  ['3d',  '5 years (Jan 1)',             '2015-01-01', '609'],
  ['1w',  '10 years (Jan 1)',            '2010-01-01', '522'],
  ['1M',  '10 years (Jan 1)',            '2010-01-01', '120'],
];

const intervalsTable = INTERVAL_WINDOWS
  .map(([i, window, anchor, max]) => `| \`${i}\` | ${window} | ${anchor} | ≤ ${max} |`)
  .join('\n');

const symbolsList = PAIRS.map((p) => `\`${p}\``).join(', ');

const description = `Type-safe, auto-generated client for the **static-klines** API — historical Binance spot klines served as pre-rendered static JSON. No rate limits, infinite cache lifetime, globally CDN'd.`;

const banner = `
> **⚠️ Experimental** — this is a community cache of the Binance public REST API, not audit-grade market data. Binance occasionally restates historical candles; this snapshot is refreshed once a day. Use the official Binance API if you need guaranteed freshness or correctness.

**Live API:** ${apiRoot}
**OpenAPI spec:** ${apiRoot}/openapi.json
**Interactive docs:** ${origin}${basePath}/

### Supported symbols

${symbolsList}

### Supported intervals

Every \`startDate\` is a real calendar boundary — you can guess the next URL in sequence without looking it up. Call \`getStartDates({ interval })\` for the full enum.

| Interval | Window | Anchor (first window) | ≤ candles/file |
|---------:|:-------|:----------------------|:----------------|
${intervalsTable}

Each file contains the fully-closed Binance spot candles that fall inside that calendar window (always ≤1000). Pre-listing windows return \`[]\`; future windows are scaffolded as \`[]\` and populated daily by GitHub Actions.
`.trim();

const sharedPackage = {
  name: 'static-klines',
  version: rootPkg.version,
  description,
  license: 'MIT',
  author: 'Andrey Gubanov',
  repository: {
    type: 'git',
    url: 'git+https://github.com/finom/static-klines.git',
  },
  homepage: `${origin}${basePath}/`,
  bugs: {
    url: 'https://github.com/finom/static-klines/issues',
  },
  keywords: ['binance', 'klines', 'candles', 'ohlcv', 'crypto', 'vovk'],
  py_name: 'static_klines',
  rs_name: 'static-klines',
};

const sharedReadme = {
  banner,
  description,
};

/** @type {import('vovk').VovkConfig} */
const config = {
  outputConfig: {
    // Intentionally no top-level `origin` — it breaks `vovk dev` (the watcher
    // concatenates it onto localhost). The published clients set origin via
    // bundle.outputConfig.origin + the `--origin` flag on `vovk generate`.
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
      origin: apiRoot,
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
