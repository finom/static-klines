import { writeFile } from 'node:fs/promises';
import { INTERVALS, WINDOW_STRIDE_LABEL } from '../src/config/intervals.ts';
import { PAIRS } from '../src/config/pairs.ts';
import { START_DATES } from '../src/config/start-dates.generated.ts';

const API_BASE = 'https://finom.github.io/static-klines/api';

function metaSection(): string {
  const lines = [
    '## Meta',
    '',
    `- \`GET /api/openapi.json\` — full OpenAPI 3.1 document`,
    `- \`GET /api/klines/symbols.json\` — list of the 10 supported pairs`,
    ...INTERVALS.map(
      (i) => `- \`GET /api/klines/start-dates/${i}.json\` — valid startDates for \`${i}\``,
    ),
  ];
  return lines.join('\n');
}

function candleSection(): string {
  const out: string[] = ['## Candles', ''];
  for (const interval of INTERVALS) {
    const dates = START_DATES[interval];
    const totalFiles = dates.length * PAIRS.length;
    out.push(
      `### \`${interval}\` — ${WINDOW_STRIDE_LABEL[interval]} (${dates.length} windows × ${PAIRS.length} pairs = ${totalFiles.toLocaleString()} files)`,
      '',
    );
    out.push('<details><summary>Show all URLs</summary>', '');
    for (const symbol of PAIRS) {
      out.push(`**${symbol}**`, '');
      for (const d of dates) {
        out.push(`- \`/api/klines/${interval}/${symbol}/${d}.json\``);
      }
      out.push('');
    }
    out.push('</details>', '');
  }
  return out.join('\n');
}

const total =
  2 +
  INTERVALS.length +
  INTERVALS.reduce((sum, i) => sum + START_DATES[i].length, 0) * PAIRS.length;

const body = `# Every static endpoint served by static-klines

Auto-generated from [\`src/config/start-dates.generated.ts\`](src/config/start-dates.generated.ts) + [\`src/config/pairs.ts\`](src/config/pairs.ts) — regenerate with \`npx tsx scripts/generate-endpoints-md.ts\` (or \`node --experimental-strip-types\`).

- **Base URL:** \`${API_BASE}\`
- **Coverage window:** from each interval's anchor through **2040-01-01** (future windows are scaffolded as \`[]\` and filled in daily by [GitHub Actions](.github/workflows/fetch-daily.yml)).
- **Total static files:** **${total.toLocaleString()}**.

${metaSection()}

${candleSection()}
`;

await writeFile('ENDPOINTS.md', body, 'utf8');
console.log(`Wrote ENDPOINTS.md (${body.length} bytes, ${total.toLocaleString()} total URLs)`);
