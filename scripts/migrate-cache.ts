import { existsSync } from 'node:fs';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  INTERVALS,
  type Interval,
  nextWindowStart,
  windowFileName,
  windowStartsForInterval,
} from '../src/config/intervals.ts';
import { PAIRS } from '../src/config/pairs.ts';
import type { RawCandle } from './lib/binance.ts';

const CACHE_ROOT = '.klines-cache';
const DRY_RUN = process.env.DRY_RUN === '1';

function dirFor(symbol: string, interval: Interval): string {
  return join(CACHE_ROOT, symbol, interval);
}

async function readAllCandles(symbol: string, interval: Interval): Promise<RawCandle[]> {
  const dir = dirFor(symbol, interval);
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  const out: RawCandle[] = [];
  for (const f of files) {
    const raw = await readFile(join(dir, f), 'utf8');
    const candles = JSON.parse(raw) as RawCandle[];
    out.push(...candles);
  }
  out.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < out.length; i++) {
    if (out[i][0] === out[i - 1][0]) {
      out.splice(i, 1);
      i -= 1;
    }
  }
  return out;
}

function serialize(candles: RawCandle[]): string {
  if (candles.length === 0) return '[]\n';
  const lines = candles.map((c) => `  ${JSON.stringify(c)}`);
  return `[\n${lines.join(',\n')}\n]\n`;
}

async function migratePairInterval(symbol: string, interval: Interval): Promise<void> {
  const dir = dirFor(symbol, interval);
  const candles = await readAllCandles(symbol, interval);

  if (!existsSync(dir) && candles.length === 0) return;

  if (!DRY_RUN && existsSync(dir)) {
    await rm(dir, { recursive: true, force: true });
  }

  const starts = windowStartsForInterval(interval);
  let i = 0;
  let wrote = 0;
  let populated = 0;
  for (const start of starts) {
    const end = nextWindowStart(interval, start);
    const bucket: RawCandle[] = [];
    while (i < candles.length && candles[i][0] < end) {
      if (candles[i][0] >= start) bucket.push(candles[i]);
      i += 1;
    }
    const path = join(dir, windowFileName(start));
    if (!DRY_RUN) {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(dir, { recursive: true });
      await writeFile(path, serialize(bucket), 'utf8');
    }
    wrote += 1;
    if (bucket.length > 0) populated += 1;
  }

  console.log(
    `[${symbol} ${interval}] ${candles.length} candles → ${wrote} new window file(s) (${populated} populated)`,
  );
}

async function main(): Promise<void> {
  console.log(`Dry run: ${DRY_RUN}`);
  console.log('---');
  for (const symbol of PAIRS) {
    for (const interval of INTERVALS) {
      await migratePairInterval(symbol, interval);
    }
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
