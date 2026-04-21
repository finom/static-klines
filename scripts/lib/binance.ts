// Hosts are tried in order. The first one that doesn't geo-block becomes
// "sticky" for the rest of the session — we don't keep round-tripping every
// request through the fallback chain.
//
// - data-api.binance.vision: Binance's public market-data endpoint; reachable
//   from US IPs (i.e. GitHub-hosted runners).
// - api.binance.com: primary spot endpoint. Geo-blocked from the US, but
//   works fine from non-US networks.
// - api1-4.binance.com: load-balancer siblings of api.binance.com, documented
//   as spot API alternates.
// - data.binance.com: another public market-data alias.
//
// Override with BINANCE_API_BASE to pin a single host.
const DEFAULT_HOSTS: readonly string[] = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
  'https://api4.binance.com',
  'https://data.binance.com',
];

const HOSTS: readonly string[] = process.env.BINANCE_API_BASE
  ? [process.env.BINANCE_API_BASE, ...DEFAULT_HOSTS.filter((h) => h !== process.env.BINANCE_API_BASE)]
  : DEFAULT_HOSTS;

const MIN_REQUEST_GAP_MS = 100;
const WEIGHT_BUDGET = 1200;
const WEIGHT_PAUSE_AT = 1000;
const MAX_ATTEMPTS_PER_HOST = 5;

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
  stickyHostIndex: 0,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttle(): Promise<void> {
  if (state.usedWeight1m > WEIGHT_PAUSE_AT) {
    console.log(`Used weight ${state.usedWeight1m}/${WEIGHT_BUDGET} — pausing 10s`);
    await sleep(10_000);
    state.usedWeight1m = 0;
  }
  const gap = Date.now() - state.lastRequestAt;
  if (gap < MIN_REQUEST_GAP_MS) await sleep(MIN_REQUEST_GAP_MS - gap);
}

function isGeoBlock(status: number): boolean {
  return status === 451 || status === 403;
}

export async function fetchKlines(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number,
  limit = 1000,
): Promise<RawCandle[]> {
  const query = new URLSearchParams({
    symbol,
    interval,
    startTime: String(startTime),
    endTime: String(endTime),
    limit: String(limit),
  });

  await throttle();

  let lastError: unknown = null;

  // Try hosts in order, starting from the last known-good one.
  for (let hostOffset = 0; hostOffset < HOSTS.length; hostOffset++) {
    const hostIdx = (state.stickyHostIndex + hostOffset) % HOSTS.length;
    const host = HOSTS[hostIdx];
    const url = new URL('/api/v3/klines', host);
    url.search = query.toString();

    let giveUpOnHost = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_HOST && !giveUpOnHost; attempt++) {
      state.lastRequestAt = Date.now();

      let res: Response;
      try {
        res = await fetch(url);
      } catch (err) {
        lastError = err;
        if (attempt === MAX_ATTEMPTS_PER_HOST) {
          console.warn(`[${host}] network error after ${attempt} attempts, failing over`);
          giveUpOnHost = true;
          break;
        }
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }

      const weight = res.headers.get('x-mbx-used-weight-1m');
      if (weight) state.usedWeight1m = Number.parseInt(weight, 10);

      if (isGeoBlock(res.status)) {
        const body = await res.text();
        console.warn(`[${host}] ${res.status} (geo-block) — failing over. ${body.slice(0, 120)}`);
        lastError = new Error(`${host}: ${res.status}`);
        giveUpOnHost = true;
        break;
      }

      if (res.status === 429 || res.status === 418) {
        const retryAfter = Number.parseInt(res.headers.get('retry-after') ?? '60', 10);
        console.warn(`[${host}] rate-limited (${res.status}) — sleeping ${retryAfter}s`);
        await sleep(retryAfter * 1000);
        continue;
      }

      if (res.status >= 500) {
        lastError = new Error(`${host} ${res.status}`);
        if (attempt === MAX_ATTEMPTS_PER_HOST) {
          console.warn(`[${host}] ${res.status} after ${attempt} attempts, failing over`);
          giveUpOnHost = true;
          break;
        }
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }

      if (!res.ok) {
        // 4xx other than geo/rate: caller error, don't fail over.
        throw new Error(`Binance ${res.status}: ${await res.text()}`);
      }

      state.stickyHostIndex = hostIdx;
      return (await res.json()) as RawCandle[];
    }
  }

  throw new Error(
    `All ${HOSTS.length} Binance hosts failed; last error: ${String(lastError)}`,
  );
}
