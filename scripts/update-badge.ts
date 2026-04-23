// Updates the "Data through YYYY-MM-DD" shields.io badge in README.md
// by scanning .klines-cache/ for the latest closed 1d candle.
//
// Runs as a step in .github/workflows/fetch-daily.yml after the cache pull,
// so the commit that ships new candles also bumps the badge.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const CACHE_ROOT = '.klines-cache';
const README_PATH = 'README.md';
const INTERVAL = '1d'; // canonical "through which UTC day do we have data"

async function latestClosedDay(): Promise<Date> {
  const symbols = await readdir(CACHE_ROOT);
  let maxClose = 0;

  for (const symbol of symbols) {
    const dir = join(CACHE_ROOT, symbol, INTERVAL);
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      continue;
    }
    // Walk newest → oldest and stop at the first partition with data.
    for (const file of files.sort().reverse()) {
      const raw = await readFile(join(dir, file), 'utf8');
      const content = JSON.parse(raw);
      if (!Array.isArray(content) || content.length === 0) continue;
      const lastCandle = content[content.length - 1];
      const closeTime = lastCandle?.[6];
      if (typeof closeTime === 'number' && closeTime > maxClose) {
        maxClose = closeTime;
      }
      break;
    }
  }

  if (!maxClose) {
    throw new Error(`No 1d candle data found under ${CACHE_ROOT}`);
  }
  return new Date(maxClose);
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildBadgeMarkdown(day: string): string {
  const escaped = day.replace(/-/g, '--');
  const url = `https://img.shields.io/badge/data%20through-${escaped}-brightgreen`;
  const alt = `Data through ${day}`;
  const href = 'https://github.com/finom/static-klines/actions/workflows/fetch-daily.yml';
  return `[![${alt}](${url})](${href})`;
}

// Matches any previously-rendered "Data through …" badge line.
const BADGE_PATTERN =
  /\[!\[Data through [^\]]+\]\(https:\/\/img\.shields\.io\/badge\/data%20through-[^)]+\)\]\([^)]+\)/;

// Anchor used to insert the badge the first time, right after the
// "Fetch klines daily" workflow badge so the two live side-by-side.
const FETCH_BADGE_ANCHOR =
  /(\[!\[Fetch klines daily\]\(https:\/\/github\.com\/finom\/static-klines\/actions\/workflows\/fetch-daily\.yml\/badge\.svg\)\]\(https:\/\/github\.com\/finom\/static-klines\/actions\/workflows\/fetch-daily\.yml\)\n)/;

async function main() {
  const day = formatDay(await latestClosedDay());
  const nextBadge = buildBadgeMarkdown(day);

  const readme = await readFile(README_PATH, 'utf8');

  let updated: string;
  if (BADGE_PATTERN.test(readme)) {
    updated = readme.replace(BADGE_PATTERN, nextBadge);
  } else if (FETCH_BADGE_ANCHOR.test(readme)) {
    updated = readme.replace(FETCH_BADGE_ANCHOR, `$1${nextBadge}\n`);
  } else {
    throw new Error(
      'Could not find an existing "Data through …" badge or the "Fetch klines daily" anchor to insert after.',
    );
  }

  if (updated === readme) {
    console.log(`Badge already current: data through ${day}`);
    return;
  }

  await writeFile(README_PATH, updated, 'utf8');
  console.log(`Badge updated: data through ${day}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
