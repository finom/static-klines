import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type Interval,
  MAX_CANDLES_PER_WINDOW,
  windowFileName,
  windowStartsForInterval,
} from '../../src/config/intervals.ts';
import type { RawCandle } from './binance.ts';

export const CACHE_ROOT = '.klines-cache';
export const MAX_PER_FILE = MAX_CANDLES_PER_WINDOW;

export function cacheDir(symbol: string, interval: string): string {
  return join(CACHE_ROOT, symbol, interval);
}

export function fileNameForOpenTime(openTime: number): string {
  return windowFileName(openTime);
}

export async function listCachedFiles(symbol: string, interval: string): Promise<string[]> {
  const dir = cacheDir(symbol, interval);
  if (!existsSync(dir)) return [];
  const files = await readdir(dir);
  return files.filter((f) => f.endsWith('.json')).sort();
}

export async function readCachedFile(
  symbol: string,
  interval: string,
  filename: string,
): Promise<RawCandle[]> {
  const path = join(cacheDir(symbol, interval), filename);
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as RawCandle[];
}

export async function writeCachedFile(
  symbol: string,
  interval: string,
  filename: string,
  candles: RawCandle[],
): Promise<void> {
  const dir = cacheDir(symbol, interval);
  await mkdir(dir, { recursive: true });
  const path = join(dir, filename);
  if (candles.length === 0) {
    await writeFile(path, '[]\n', 'utf8');
    return;
  }
  const lines = candles.map((c) => `  ${JSON.stringify(c)}`);
  const json = `[\n${lines.join(',\n')}\n]\n`;
  await writeFile(path, json, 'utf8');
}

export function mergeCandles(existing: RawCandle[], incoming: RawCandle[]): RawCandle[] {
  const map = new Map<number, RawCandle>();
  for (const c of existing) map.set(c[0], c);
  for (const c of incoming) map.set(c[0], c);
  return [...map.values()].sort((a, b) => a[0] - b[0]).slice(0, MAX_PER_FILE);
}

export async function scaffoldEmptyWindows(symbol: string, interval: Interval): Promise<number> {
  const dir = cacheDir(symbol, interval);
  await mkdir(dir, { recursive: true });
  let created = 0;
  for (const start of windowStartsForInterval(interval)) {
    const path = join(dir, windowFileName(start));
    if (!existsSync(path)) {
      await writeFile(path, '[]\n', 'utf8');
      created += 1;
    }
  }
  return created;
}
