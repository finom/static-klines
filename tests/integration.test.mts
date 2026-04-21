import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { after, before, describe, test } from 'node:test';

import { KLinesAPI, OpenAPI } from '../dist/index.mjs';
import { PAIRS } from '../src/config/pairs.ts';
import { START_DATES_1d } from '../src/config/start-dates.generated.ts';

// Start a tiny static server that maps /api/* URLs onto .klines-cache + the
// generated openapi document. It mimics what Next.js static export publishes.
let server: Server;
let apiRoot: string;

before(async () => {
  const openapi = JSON.parse(
    await readFile('node_modules/.vovk-client/openapi.json', 'utf8'),
  );

  server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const candleMatch = /^\/api\/klines\/(\w+)\/(\w+)\/(.+)\.json$/.exec(url.pathname);
      const startDatesMatch = /^\/api\/klines\/start-dates\/(\w+)\.json$/.exec(url.pathname);

      if (url.pathname === '/api/klines/symbols.json') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify([...PAIRS]));
        return;
      }

      if (startDatesMatch) {
        const [, interval] = startDatesMatch;
        const mod = await import(`../src/config/start-dates.generated.ts`);
        const dates = (mod.START_DATES as Record<string, readonly string[]>)[interval];
        if (!dates) {
          res.writeHead(404).end('unknown interval');
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify([...dates]));
        return;
      }

      if (candleMatch) {
        const [, interval, symbol, date] = candleMatch;
        const filePath = `.klines-cache/${symbol}/${interval}/${date}.json`;
        if (!existsSync(filePath)) {
          res.writeHead(404).end('no such window');
          return;
        }
        const body = await readFile(filePath, 'utf8');
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(body);
        return;
      }

      if (url.pathname === '/api/openapi.json') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(openapi));
        return;
      }

      res.writeHead(404).end('not found');
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (typeof addr !== 'object' || addr === null) throw new Error('no address');
  apiRoot = `http://127.0.0.1:${addr.port}/api`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe('raw REST endpoints', () => {
  test('openapi.json exposes every klines endpoint', async () => {
    const res = await fetch(`${apiRoot}/openapi.json`);
    assert.equal(res.status, 200);
    const spec = (await res.json()) as { paths: Record<string, unknown> };
    const paths = Object.keys(spec.paths);
    assert.ok(paths.includes('/api/klines/symbols.json'));
    assert.ok(paths.includes('/api/klines/start-dates/{interval}.json'));
    assert.ok(paths.includes('/api/klines/1d/{symbol}/{startDate}.json'));
    assert.ok(paths.includes('/api/klines/15m/{symbol}/{startDate}.json'));
  });

  test('symbols.json returns the full supported-pairs list', async () => {
    const res = await fetch(`${apiRoot}/klines/symbols.json`);
    assert.equal(res.status, 200);
    const symbols = (await res.json()) as string[];
    assert.deepEqual(symbols, [...PAIRS]);
  });

  test('start-dates/1d.json returns the committed enum', async () => {
    const res = await fetch(`${apiRoot}/klines/start-dates/1d.json`);
    assert.equal(res.status, 200);
    const dates = (await res.json()) as string[];
    assert.deepEqual(dates, [...START_DATES_1d]);
  });

  test('1d BTCUSDT 2018-01-01 returns 12-tuple candles', async () => {
    const res = await fetch(`${apiRoot}/klines/1d/BTCUSDT/2018-01-01.json`);
    assert.equal(res.status, 200);
    const candles = (await res.json()) as unknown[][];
    assert.ok(candles.length > 0, 'window should have candles');
    const [first] = candles;
    assert.equal(first.length, 12, 'Binance kline tuple is 12 elements');
    assert.equal(first[0], Date.UTC(2018, 0, 1), 'first openTime is 2018-01-01 00:00 UTC');
    assert.equal(typeof first[1], 'string', 'open price is stringified decimal');
  });

  test('unknown symbol/interval returns 404', async () => {
    const res = await fetch(`${apiRoot}/klines/1d/DOESNOTEXIST/2018-01-01.json`);
    assert.equal(res.status, 404);
  });
});

describe('TypeScript RPC client (./dist)', () => {
  test('getSymbols returns the supported-pairs list', async () => {
    const symbols = await KLinesAPI.getSymbols({ apiRoot });
    assert.deepEqual(symbols, [...PAIRS]);
  });

  test('getStartDates is type-narrowed per interval', async () => {
    const dates = await KLinesAPI.getStartDates({
      params: { interval: '1d' },
      apiRoot,
    });
    assert.ok(Array.isArray(dates));
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

  test('getSpec returns the OpenAPI document', async () => {
    const spec = await OpenAPI.getSpec({ apiRoot });
    assert.ok(typeof spec === 'object' && spec !== null);
    const { paths } = spec as { paths: Record<string, unknown> };
    assert.ok('/api/klines/start-dates/{interval}.json' in paths);
  });

  test('getURL helper composes the correct path', () => {
    const url = KLinesAPI.getKlines1d.getURL({
      params: { symbol: 'BTCUSDT', startDate: '2018-01-01' },
      apiRoot,
    });
    assert.equal(url, `${apiRoot}/klines/1d/BTCUSDT/2018-01-01.json`);
  });
});
