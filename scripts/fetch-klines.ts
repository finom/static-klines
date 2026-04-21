import {
  INTERVALS,
  type Interval,
  intervalMs,
  nextCandleOpenTime,
  startDateMs,
} from '../src/config/intervals.ts';
import { PAIRS } from '../src/config/pairs.ts';
import { fetchKlines, type RawCandle } from './lib/binance.ts';
import {
  cacheDir,
  fileNameForOpenTime,
  listCachedFiles,
  MAX_PER_FILE,
  mergeCandles,
  readCachedFile,
  writeCachedFile,
} from './lib/cache.ts';

const DRY_RUN = process.env.DRY_RUN === '1';
const FETCH_LIMIT_PAIRS = process.env.FETCH_LIMIT_PAIRS?.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const FETCH_LIMIT_INTERVALS = process.env.FETCH_LIMIT_INTERVALS?.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const pairsToProcess = FETCH_LIMIT_PAIRS?.length
  ? PAIRS.filter((p) => FETCH_LIMIT_PAIRS.includes(p))
  : PAIRS;

const intervalsToProcess = FETCH_LIMIT_INTERVALS?.length
  ? INTERVALS.filter((i) => FETCH_LIMIT_INTERVALS.includes(i))
  : INTERVALS;

const MAX_EMPTY_WINDOWS = 200;

function windowStartForOpenTime(interval: Interval, openTime: number): number {
  const start = startDateMs(interval);
  if (interval === '1M') return start;
  const ms = intervalMs(interval);
  if (ms === null) return start;
  const windowMs = ms * MAX_PER_FILE;
  const offset = openTime - start;
  return start + Math.floor(offset / windowMs) * windowMs;
}

function nextWindowStart(interval: Interval, windowStart: number): number {
  if (interval === '1M') {
    const d = new Date(windowStart);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + MAX_PER_FILE, 1);
  }
  const ms = intervalMs(interval);
  if (ms === null) return windowStart;
  return windowStart + ms * MAX_PER_FILE;
}

async function processPairInterval(symbol: string, interval: Interval): Promise<void> {
  const cachedFiles = await listCachedFiles(symbol, interval);
  const initialStart = startDateMs(interval);

  let resumeTime: number;
  if (cachedFiles.length === 0) {
    resumeTime = initialStart;
  } else {
    const lastFile = cachedFiles[cachedFiles.length - 1];
    const candles = await readCachedFile(symbol, interval, lastFile);
    if (candles.length === 0) {
      resumeTime = initialStart;
    } else {
      const last = candles[candles.length - 1];
      resumeTime = nextCandleOpenTime(last[0], interval);
    }
  }

  const now = Date.now();
  let startTime = resumeTime;
  let emptyWindowsSeen = 0;

  while (startTime < now) {
    const windowStart = windowStartForOpenTime(interval, startTime);
    const windowEnd = nextWindowStart(interval, windowStart) - 1;
    const requestEnd = Math.min(now - 1, windowEnd);

    if (startTime > requestEnd) break;

    console.log(
      `[${symbol} ${interval}] ${new Date(startTime).toISOString()} → ${new Date(requestEnd).toISOString()}`,
    );
    const candles = await fetchKlines(symbol, interval, startTime, requestEnd, MAX_PER_FILE);
    const closed = candles.filter((c) => c[6] < now);

    if (closed.length === 0) {
      emptyWindowsSeen += 1;
      if (emptyWindowsSeen >= MAX_EMPTY_WINDOWS) {
        console.log(
          `[${symbol} ${interval}] no data after ${MAX_EMPTY_WINDOWS} empty windows — stopping`,
        );
        break;
      }
      startTime = nextWindowStart(interval, windowStart);
      continue;
    }

    emptyWindowsSeen = 0;

    const filename = fileNameForOpenTime(windowStart);
    if (DRY_RUN) {
      console.log(
        `[DRY] would write ${closed.length} candles to ${cacheDir(symbol, interval)}/${filename}`,
      );
    } else {
      const existingFiles = await listCachedFiles(symbol, interval);
      const existing: RawCandle[] = existingFiles.includes(filename)
        ? await readCachedFile(symbol, interval, filename)
        : [];
      const merged = mergeCandles(existing, closed);
      await writeCachedFile(symbol, interval, filename, merged);
      console.log(`[${symbol} ${interval}] wrote ${merged.length} candles → ${filename}`);
    }

    const last = closed[closed.length - 1];
    startTime = nextCandleOpenTime(last[0], interval);
  }
}

async function main(): Promise<void> {
  console.log('Pairs:', pairsToProcess.join(', '));
  console.log('Intervals:', intervalsToProcess.join(', '));
  console.log('Dry run:', DRY_RUN);
  console.log('---');

  for (const symbol of pairsToProcess) {
    for (const interval of intervalsToProcess) {
      await processPairInterval(symbol, interval);
    }
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
