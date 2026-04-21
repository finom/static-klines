import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { KLinesAPI, OpenAPI } from '../dist/index.mjs';
import { PAIRS } from '../src/config/pairs.ts';
import { START_DATES_1d } from '../src/config/start-dates.generated.ts';

// Tests run against the DEPLOYED site. Set TEST_API_ROOT to override (e.g. to
// point at a preview deploy). Default is the production GitHub Pages URL.
const apiRoot = process.env.TEST_API_ROOT ?? 'https://finom.github.io/static-klines/api';

describe('raw REST endpoints (live)', () => {
  test('openapi.json exposes every klines endpoint', async () => {
    const res = await fetch(`${apiRoot}/openapi.json`);
    assert.equal(res.status, 200);
    const spec = (await res.json()) as { paths: Record<string, unknown> };
    const paths = Object.keys(spec.paths);
    assert.ok(paths.includes('/api/klines/symbols.json'), 'has symbols');
    assert.ok(paths.includes('/api/klines/start-dates/{interval}.json'), 'has start-dates');
    assert.ok(paths.includes('/api/klines/1d/{symbol}/{startDate}.json'), 'has 1d');
    assert.ok(paths.includes('/api/klines/15m/{symbol}/{startDate}.json'), 'has 15m');
  });

  test('symbols.json returns the expected 10 pairs', async () => {
    const res = await fetch(`${apiRoot}/klines/symbols.json`);
    assert.equal(res.status, 200);
    const symbols = (await res.json()) as string[];
    assert.deepEqual(symbols, [...PAIRS]);
  });

  test('start-dates/1d.json matches committed enum', async () => {
    const res = await fetch(`${apiRoot}/klines/start-dates/1d.json`);
    assert.equal(res.status, 200);
    const dates = (await res.json()) as string[];
    assert.deepEqual(dates, [...START_DATES_1d]);
  });

  test('1d/BTCUSDT/2018-01-01.json returns 12-tuple candles starting on Jan 1', async () => {
    const res = await fetch(`${apiRoot}/klines/1d/BTCUSDT/2018-01-01.json`);
    assert.equal(res.status, 200);
    const candles = (await res.json()) as unknown[][];
    assert.ok(candles.length > 0, 'window should have candles');
    const [first] = candles;
    assert.equal(first.length, 12, 'Binance kline tuple is 12 elements');
    assert.equal(first[0], Date.UTC(2018, 0, 1), 'first openTime is 2018-01-01 00:00 UTC');
    assert.equal(typeof first[1], 'string', 'open is a stringified decimal');
  });

  test('15m/SOLUSDT/2024-01-01.json returns a full 672-candle week', async () => {
    const res = await fetch(`${apiRoot}/klines/15m/SOLUSDT/2024-01-01.json`);
    assert.equal(res.status, 200);
    const candles = (await res.json()) as unknown[][];
    assert.equal(candles.length, 672, '7 days × 96 candles/day');
    assert.equal(candles[0][0], Date.UTC(2024, 0, 1));
  });

  test('unknown window returns 404', async () => {
    const res = await fetch(`${apiRoot}/klines/1d/DOESNOTEXIST/2018-01-01.json`);
    assert.equal(res.status, 404);
  });
});

describe('TypeScript RPC client (./dist, live API)', () => {
  test('getSymbols returns the expected 10 pairs', async () => {
    const symbols = await KLinesAPI.getSymbols({ apiRoot });
    assert.deepEqual(symbols, [...PAIRS]);
  });

  test('getStartDates narrows per interval', async () => {
    const dates = await KLinesAPI.getStartDates({
      params: { interval: '1d' },
      apiRoot,
    });
    assert.deepEqual(dates, [...START_DATES_1d]);
  });

  test('getKlines1d returns decoded candles for BTCUSDT 2018', async () => {
    const candles = await KLinesAPI.getKlines1d({
      params: { symbol: 'BTCUSDT', startDate: '2018-01-01' },
      apiRoot,
    });
    assert.ok(Array.isArray(candles));
    assert.ok(candles.length > 0);
    const [first] = candles;
    assert.equal(first.length, 12);
    assert.equal(first[0], Date.UTC(2018, 0, 1));
  });

  test('getKlines1h for ETHUSDT Jan 2024 has up to 744 candles (31 days × 24)', async () => {
    const candles = await KLinesAPI.getKlines1h({
      params: { symbol: 'ETHUSDT', startDate: '2024-01-01' },
      apiRoot,
    });
    assert.ok(candles.length > 700);
    assert.ok(candles.length <= 744);
  });

  test('getSpec returns the OpenAPI document', async () => {
    const spec = await OpenAPI.getSpec({ apiRoot });
    assert.ok(typeof spec === 'object' && spec !== null);
    const { paths } = spec as { paths: Record<string, unknown> };
    assert.ok('/api/klines/start-dates/{interval}.json' in paths);
    assert.ok('/api/klines/symbols.json' in paths);
  });

  test('getURL helper composes the correct path', () => {
    const url = KLinesAPI.getKlines1d.getURL({
      params: { symbol: 'BTCUSDT', startDate: '2018-01-01' },
      apiRoot,
    });
    assert.equal(url, `${apiRoot}/klines/1d/BTCUSDT/2018-01-01.json`);
  });
});
