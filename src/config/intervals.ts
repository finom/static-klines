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

export const INTERVAL_START_DATES: Record<Interval, string> = {
  '15m': '2020-01-01',
  '30m': '2019-01-01',
  '1h': '2018-01-01',
  '2h': '2017-08-17',
  '4h': '2017-08-17',
  '6h': '2017-08-17',
  '8h': '2017-08-17',
  '12h': '2017-08-17',
  '1d': '2017-08-17',
  '3d': '2017-08-17',
  '1w': '2017-08-17',
  '1M': '2017-08-01',
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

export function startDateMs(interval: Interval): number {
  const iso = INTERVAL_START_DATES[interval];
  return Date.UTC(
    Number.parseInt(iso.slice(0, 4), 10),
    Number.parseInt(iso.slice(5, 7), 10) - 1,
    Number.parseInt(iso.slice(8, 10), 10),
  );
}

export function nextCandleOpenTime(openTime: number, interval: Interval): number {
  if (interval === '1M') {
    const d = new Date(openTime);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }
  return openTime + MS_BY_INTERVAL[interval];
}
