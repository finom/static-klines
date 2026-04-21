import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RawCandle } from './binance.ts';

export const CACHE_ROOT = '.klines-cache';
export const MAX_PER_FILE = 1000;

export function cacheDir(symbol: string, interval: string): string {
  return join(CACHE_ROOT, symbol, interval);
}

export function fileNameForOpenTime(openTime: number): string {
  const d = new Date(openTime);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}.json`;
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
