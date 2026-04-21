export const INTERVALS = [
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M',
] as const;

export type Interval = (typeof INTERVALS)[number];

// The first window's start date for each interval. Every window of that
// interval begins `WINDOW_STRIDE[interval]` after the previous one, so all
// filenames are predictable calendar dates anchored here. Keep these aligned
// to a natural calendar boundary (Monday, 1st of month, 1st of year).
export const INTERVAL_START_DATES: Record<Interval, string> = {
  '15m': '2024-12-30', // Mon of ISO week containing Jan 1, 2025 (recent-only; shortest-granularity = biggest file count)
  '30m': '2024-01-01', // Mon; recent-only for file-count control
  '1h':  '2022-01-01', // 1st of month; moderate history
  '2h':  '2017-07-01', // bi-month containing Binance launch (2017-08-17)
  '4h':  '2017-07-01', // quarter containing launch
  '6h':  '2017-07-01', // half-year containing launch
  '8h':  '2017-07-01',
  '12h': '2017-01-01',
  '1d':  '2016-01-01', // 2-year window containing launch (even-year anchored)
  '3d':  '2015-01-01', // 5-year window
  '1w':  '2010-01-01', // 10-year window
  '1M':  '2010-01-01', // 20-year window
};

export const END_DATE_EXCLUSIVE_ISO = '2040-01-01';
export const END_DATE_EXCLUSIVE_MS = Date.UTC(2040, 0, 1);

export const MAX_CANDLES_PER_WINDOW = 1000;

type WindowStride =
  | { kind: 'days'; days: number }
  | { kind: 'months'; months: number };

export const WINDOW_STRIDE: Record<Interval, WindowStride> = {
  '15m': { kind: 'days', days: 7 },
  '30m': { kind: 'days', days: 14 },
  '1h':  { kind: 'months', months: 1 },
  '2h':  { kind: 'months', months: 2 },
  '4h':  { kind: 'months', months: 3 },
  '6h':  { kind: 'months', months: 6 },
  '8h':  { kind: 'months', months: 6 },
  '12h': { kind: 'months', months: 12 },
  '1d':  { kind: 'months', months: 24 },
  '3d':  { kind: 'months', months: 60 },
  '1w':  { kind: 'months', months: 120 },
  '1M':  { kind: 'months', months: 240 },
};

export const WINDOW_STRIDE_LABEL: Record<Interval, string> = {
  '15m': '1 week (Monday-aligned)',
  '30m': '2 weeks (Monday-aligned)',
  '1h':  '1 calendar month',
  '2h':  '2 calendar months',
  '4h':  '1 calendar quarter',
  '6h':  '6 months (Jan/Jul)',
  '8h':  '6 months (Jan/Jul)',
  '12h': '1 calendar year',
  '1d':  '2 calendar years',
  '3d':  '5 calendar years',
  '1w':  '10 calendar years',
  '1M':  '20 calendar years',
};

const MS_BY_INTERVAL: Record<Exclude<Interval, '1M'>, number> = {
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h': 3_600_000,
  '2h': 2 * 3_600_000,
  '4h': 4 * 3_600_000,
  '6h': 6 * 3_600_000,
  '8h': 8 * 3_600_000,
  '12h': 12 * 3_600_000,
  '1d': 86_400_000,
  '3d': 3 * 86_400_000,
  '1w': 7 * 86_400_000,
};

export function intervalMs(interval: Interval): number | null {
  return interval === '1M' ? null : MS_BY_INTERVAL[interval];
}

function isoToMs(iso: string): number {
  return Date.UTC(
    Number.parseInt(iso.slice(0, 4), 10),
    Number.parseInt(iso.slice(5, 7), 10) - 1,
    Number.parseInt(iso.slice(8, 10), 10),
  );
}

export function startDateMs(interval: Interval): number {
  return isoToMs(INTERVAL_START_DATES[interval]);
}

export function nextCandleOpenTime(openTime: number, interval: Interval): number {
  if (interval === '1M') {
    const d = new Date(openTime);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }
  return openTime + MS_BY_INTERVAL[interval];
}

export function windowFileBasename(openTime: number): string {
  const d = new Date(openTime);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function windowFileName(openTime: number): string {
  return `${windowFileBasename(openTime)}.json`;
}

export function windowStartForOpenTime(interval: Interval, time: number): number {
  const anchor = startDateMs(interval);
  const stride = WINDOW_STRIDE[interval];
  if (stride.kind === 'days') {
    const daysFromAnchor = Math.floor((time - anchor) / 86_400_000);
    const alignedDays = daysFromAnchor - ((daysFromAnchor % stride.days) + stride.days) % stride.days;
    return anchor + alignedDays * 86_400_000;
  }
  const t = new Date(time);
  const a = new Date(anchor);
  const monthsFromAnchor =
    (t.getUTCFullYear() - a.getUTCFullYear()) * 12 + (t.getUTCMonth() - a.getUTCMonth());
  const alignedMonths =
    monthsFromAnchor - ((monthsFromAnchor % stride.months) + stride.months) % stride.months;
  return Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + alignedMonths, 1);
}

export function nextWindowStart(interval: Interval, windowStart: number): number {
  const stride = WINDOW_STRIDE[interval];
  if (stride.kind === 'days') {
    return windowStart + stride.days * 86_400_000;
  }
  const d = new Date(windowStart);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + stride.months, 1);
}

export function windowStartsForInterval(interval: Interval): number[] {
  const starts: number[] = [];
  let w = startDateMs(interval);
  while (w < END_DATE_EXCLUSIVE_MS) {
    starts.push(w);
    w = nextWindowStart(interval, w);
  }
  return starts;
}
