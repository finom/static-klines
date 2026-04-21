// Public market-data endpoint. Same schema as api.binance.com, but not
// US-geo-blocked — lets GitHub-hosted runners keep working. Override with
// BINANCE_API_BASE if you need auth endpoints (not used by this repo).
const BASE_URL = process.env.BINANCE_API_BASE ?? 'https://data-api.binance.vision';
const MIN_REQUEST_GAP_MS = 100;
const WEIGHT_BUDGET = 1200;
const WEIGHT_PAUSE_AT = 1000;

export type RawCandle = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

const state = {
  usedWeight1m: 0,
  lastRequestAt: 0,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchKlines(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number,
  limit = 1000,
): Promise<RawCandle[]> {
  const url = new URL(`${BASE_URL}/api/v3/klines`);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', interval);
  url.searchParams.set('startTime', String(startTime));
  url.searchParams.set('endTime', String(endTime));
  url.searchParams.set('limit', String(limit));

  if (state.usedWeight1m > WEIGHT_PAUSE_AT) {
    console.log(`Used weight ${state.usedWeight1m}/${WEIGHT_BUDGET} — pausing 10s`);
    await sleep(10_000);
    state.usedWeight1m = 0;
  }

  const gap = Date.now() - state.lastRequestAt;
  if (gap < MIN_REQUEST_GAP_MS) await sleep(MIN_REQUEST_GAP_MS - gap);

  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    state.lastRequestAt = Date.now();
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      const delay = 1000 * 2 ** (attempt - 1);
      console.warn(`Fetch error (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms:`, err);
      await sleep(delay);
      continue;
    }

    const weight = res.headers.get('x-mbx-used-weight-1m');
    if (weight) state.usedWeight1m = Number.parseInt(weight, 10);

    if (res.status === 429 || res.status === 418) {
      const retry = Number.parseInt(res.headers.get('retry-after') ?? '60', 10);
      console.warn(`Rate limited (${res.status}) — sleeping ${retry}s`);
      await sleep(retry * 1000);
      continue;
    }

    if (res.status >= 500) {
      if (attempt === maxAttempts) {
        throw new Error(`Binance ${res.status}: ${await res.text()}`);
      }
      const delay = 1000 * 2 ** (attempt - 1);
      console.warn(`Binance ${res.status}, retrying in ${delay}ms`);
      await sleep(delay);
      continue;
    }

    if (!res.ok) {
      throw new Error(`Binance ${res.status}: ${await res.text()}`);
    }

    return (await res.json()) as RawCandle[];
  }

  throw new Error(`Failed to fetch klines after ${maxAttempts} attempts`);
}
