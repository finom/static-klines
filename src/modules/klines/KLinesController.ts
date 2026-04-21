import { get, operation, prefix, procedure } from 'vovk';
import { z } from 'zod';
import {
  INTERVALS,
  type Interval,
  WINDOW_STRIDE_LABEL,
} from '@/config/intervals';
import { PAIRS } from '@/config/pairs';
import {
  START_DATES,
  START_DATES_12h,
  START_DATES_15m,
  START_DATES_1M,
  START_DATES_1d,
  START_DATES_1h,
  START_DATES_1w,
  START_DATES_2h,
  START_DATES_30m,
  START_DATES_3d,
  START_DATES_4h,
  START_DATES_6h,
  START_DATES_8h,
} from '@/config/start-dates.generated';

const Candle = z
  .tuple([
    z.number().int().meta({ description: 'Open time (ms since epoch, UTC)', example: 1514764800000 }),
    z.string().meta({ description: 'Open price (stringified decimal)', example: '13715.65000000' }),
    z.string().meta({ description: 'High price (stringified decimal)', example: '13818.55000000' }),
    z.string().meta({ description: 'Low price (stringified decimal)', example: '12750.00000000' }),
    z.string().meta({ description: 'Close price (stringified decimal)', example: '13380.00000000' }),
    z.string().meta({ description: 'Base asset volume (stringified decimal)', example: '8609.91584400' }),
    z.number().int().meta({ description: 'Close time (ms since epoch, UTC)', example: 1514851199999 }),
    z.string().meta({ description: 'Quote asset volume (stringified decimal)', example: '114799747.44197057' }),
    z.number().int().meta({ description: 'Number of trades in the candle', example: 105595 }),
    z.string().meta({ description: 'Taker buy base asset volume (stringified decimal)', example: '3961.93894600' }),
    z.string().meta({ description: 'Taker buy quote asset volume (stringified decimal)', example: '52809747.44038045' }),
    z.string().meta({ description: 'Unused field (Binance legacy, historically "ignore")', example: '0' }),
  ])
  .meta({
    description: 'Single Binance spot kline row — 12-tuple, exactly as the Binance REST API returns it.',
    example: [
      1514764800000,
      '13715.65000000',
      '13818.55000000',
      '12750.00000000',
      '13380.00000000',
      '8609.91584400',
      1514851199999,
      '114799747.44197057',
      105595,
      '3961.93894600',
      '52809747.44038045',
      '0',
    ],
  });

const Candles = z
  .array(Candle)
  .meta({
    description:
      'Fully-closed candles for one (symbol, interval) window, ordered by openTime ascending. Each file covers one calendar-aligned stride (e.g. 1 ISO week for 15m, 1 month for 1h, 2 years for 1d). Returns an empty array for windows before the symbol was listed on Binance, or for future windows that have not yet been populated.',
    example: [
      [
        1514764800000,
        '13715.65000000',
        '13818.55000000',
        '12750.00000000',
        '13380.00000000',
        '8609.91584400',
        1514851199999,
        '114799747.44197057',
        105595,
        '3961.93894600',
        '52809747.44038045',
        '0',
      ],
      [
        1514851200000,
        '13382.16000000',
        '15473.49000000',
        '12890.02000000',
        '14675.11000000',
        '20078.09211100',
        1514937599999,
        '275545340.79810440',
        197229,
        '9915.30471600',
        '136355703.49029400',
        '0',
      ],
    ],
  });

export type RawCandle = z.infer<typeof Candle>;

const Symbol = z.enum(PAIRS).meta({ description: 'Trading pair (Binance spot symbol, hardcoded list of 10)' });

async function loadCandles(
  interval: Interval,
  symbol: string,
  startDate: string,
): Promise<RawCandle[]> {
  const mod = (await import(
    `../../../.klines-cache/${symbol}/${interval}/${startDate}.json`,
    { with: { type: 'json' } }
  )) as { default: RawCandle[] };
  return mod.default;
}

function staticParamsFor<T extends readonly string[]>(
  dates: T,
): { symbol: string; startDate: T[number] }[] {
  return PAIRS.flatMap((symbol) => dates.map((startDate) => ({ symbol, startDate })));
}

function klinesDescription(interval: Interval): string {
  return `Fully-closed Binance spot candles at the ${interval} interval. Each file covers exactly ${WINDOW_STRIDE_LABEL[interval]}, anchored at the calendar boundary shown by \`startDate\`. Call \`GET /api/klines/start-dates/${interval}.json\` for the full list of valid startDates.`;
}

@prefix('klines')
export default class KLinesController {
  @operation({
    summary: 'List supported symbols',
    description:
      'Returns the hardcoded list of Binance spot trading pairs covered by this cache. Same enum used by every `symbol` path parameter.',
    tags: ['meta'],
  })
  @get('symbols.json', { staticParams: [{}] })
  static getSymbols = procedure({
    output: z.array(Symbol).meta({
      description: 'Ordered list of supported Binance spot trading pair symbols.',
      example: [...PAIRS],
    }),
  }).handle(() => [...PAIRS]);

  @operation({
    summary: 'List valid startDates for an interval',
    description:
      'Returns the ordered list of `startDate` values accepted by the candle endpoints for a given interval. Every value is a calendar-aligned UTC date; iterate in order to walk the full history.',
    tags: ['meta'],
  })
  @get('start-dates/{interval}.json', {
    staticParams: INTERVALS.map((interval) => ({ interval })),
  })
  static getStartDates = procedure({
    params: z.object({
      interval: z.enum(INTERVALS).meta({ description: 'Binance kline interval code' }),
    }),
    output: z
      .array(
        z.string().meta({
          description: 'Calendar-aligned window-start date (UTC, YYYY-MM-DD).',
          example: '2024-01-01',
        }),
      )
      .meta({
        description:
          'Ordered list of window-start dates (UTC, YYYY-MM-DD) for the given interval. Every value is a real calendar boundary (Monday, 1st of month, 1st of quarter, etc.) — pass any one of these back as `startDate` on the candle endpoints.',
        example: ['2024-01-01', '2024-02-01', '2024-03-01', '2024-04-01'],
      }),
  }).handle((_req, { interval }) => [...START_DATES[interval]]);

  @operation({
    summary: 'Get 15m klines window',
    description: klinesDescription('15m'),
    tags: ['klines'],
  })
  @get('15m/{symbol}/{startDate}.json', { staticParams: staticParamsFor(START_DATES_15m) })
  static getKlines15m = procedure({
    params: z.object({
      symbol: Symbol,
      startDate: z
        .enum(START_DATES_15m)
        .meta({ description: '15m window start date (Monday, UTC, YYYY-MM-DD). Window covers 7 days / 672 candles.' }),
    }),
    output: Candles,
  }).handle((_req, { symbol, startDate }) => loadCandles('15m', symbol, startDate));

  @operation({
    summary: 'Get 30m klines window',
    description: klinesDescription('30m'),
    tags: ['klines'],
  })
  @get('30m/{symbol}/{startDate}.json', { staticParams: staticParamsFor(START_DATES_30m) })
  static getKlines30m = procedure({
    params: z.object({
      symbol: Symbol,
      startDate: z
        .enum(START_DATES_30m)
        .meta({ description: '30m window start date (Monday, UTC). Window covers 14 days / 672 candles.' }),
    }),
    output: Candles,
  }).handle((_req, { symbol, startDate }) => loadCandles('30m', symbol, startDate));

  @operation({
    summary: 'Get 1h klines window',
    description: klinesDescription('1h'),
    tags: ['klines'],
  })
  @get('1h/{symbol}/{startDate}.json', { staticParams: staticParamsFor(START_DATES_1h) })
  static getKlines1h = procedure({
    params: z.object({
      symbol: Symbol,
      startDate: z
        .enum(START_DATES_1h)
        .meta({ description: '1h window start date (1st of month, UTC). Window covers 1 calendar month.' }),
    }),
    output: Candles,
  }).handle((_req, { symbol, startDate }) => loadCandles('1h', symbol, startDate));

  @operation({
    summary: 'Get 2h klines window',
    description: klinesDescription('2h'),
    tags: ['klines'],
  })
  @get('2h/{symbol}/{startDate}.json', { staticParams: staticParamsFor(START_DATES_2h) })
  static getKlines2h = procedure({
    params: z.object({
      symbol: Symbol,
      startDate: z
        .enum(START_DATES_2h)
        .meta({ description: '2h window start date (UTC). Window covers 2 calendar months.' }),
    }),
    output: Candles,
  }).handle((_req, { symbol, startDate }) => loadCandles('2h', symbol, startDate));

  @operation({
    summary: 'Get 4h klines window',
    description: klinesDescription('4h'),
    tags: ['klines'],
  })
  @get('4h/{symbol}/{startDate}.json', { staticParams: staticParamsFor(START_DATES_4h) })
  static getKlines4h = procedure({
    params: z.object({
      symbol: Symbol,
      startDate: z
        .enum(START_DATES_4h)
        .meta({ description: '4h window start date (1st of Jan/Apr/Jul/Oct, UTC). Window covers 1 calendar quarter.' }),
    }),
    output: Candles,
  }).handle((_req, { symbol, startDate }) => loadCandles('4h', symbol, startDate));

  @operation({
    summary: 'Get 6h klines window',
    description: klinesDescription('6h'),
    tags: ['klines'],
  })
  @get('6h/{symbol}/{startDate}.json', { staticParams: staticParamsFor(START_DATES_6h) })
  static getKlines6h = procedure({
    params: z.object({
      symbol: Symbol,
      startDate: z
        .enum(START_DATES_6h)
        .meta({ description: '6h window start date (1st of Jan/Jul, UTC). Window covers 6 calendar months.' }),
    }),
    output: Candles,
  }).handle((_req, { symbol, startDate }) => loadCandles('6h', symbol, startDate));

  @operation({
    summary: 'Get 8h klines window',
    description: klinesDescription('8h'),
    tags: ['klines'],
  })
  @get('8h/{symbol}/{startDate}.json', { staticParams: staticParamsFor(START_DATES_8h) })
  static getKlines8h = procedure({
    params: z.object({
      symbol: Symbol,
      startDate: z
        .enum(START_DATES_8h)
        .meta({ description: '8h window start date (1st of Jan/Jul, UTC). Window covers 6 calendar months.' }),
    }),
    output: Candles,
  }).handle((_req, { symbol, startDate }) => loadCandles('8h', symbol, startDate));

  @operation({
    summary: 'Get 12h klines window',
    description: klinesDescription('12h'),
    tags: ['klines'],
  })
  @get('12h/{symbol}/{startDate}.json', { staticParams: staticParamsFor(START_DATES_12h) })
  static getKlines12h = procedure({
    params: z.object({
      symbol: Symbol,
      startDate: z
        .enum(START_DATES_12h)
        .meta({ description: '12h window start date (1st of Jan, UTC). Window covers 1 calendar year.' }),
    }),
    output: Candles,
  }).handle((_req, { symbol, startDate }) => loadCandles('12h', symbol, startDate));

  @operation({
    summary: 'Get 1d klines window',
    description: klinesDescription('1d'),
    tags: ['klines'],
  })
  @get('1d/{symbol}/{startDate}.json', { staticParams: staticParamsFor(START_DATES_1d) })
  static getKlines1d = procedure({
    params: z.object({
      symbol: Symbol,
      startDate: z
        .enum(START_DATES_1d)
        .meta({ description: '1d window start date (1st of Jan, even years, UTC). Window covers 2 calendar years.' }),
    }),
    output: Candles,
  }).handle((_req, { symbol, startDate }) => loadCandles('1d', symbol, startDate));

  @operation({
    summary: 'Get 3d klines window',
    description: klinesDescription('3d'),
    tags: ['klines'],
  })
  @get('3d/{symbol}/{startDate}.json', { staticParams: staticParamsFor(START_DATES_3d) })
  static getKlines3d = procedure({
    params: z.object({
      symbol: Symbol,
      startDate: z
        .enum(START_DATES_3d)
        .meta({ description: '3d window start date (1st of Jan, every 5 years, UTC). Window covers 5 calendar years.' }),
    }),
    output: Candles,
  }).handle((_req, { symbol, startDate }) => loadCandles('3d', symbol, startDate));

  @operation({
    summary: 'Get 1w klines window',
    description: klinesDescription('1w'),
    tags: ['klines'],
  })
  @get('1w/{symbol}/{startDate}.json', { staticParams: staticParamsFor(START_DATES_1w) })
  static getKlines1w = procedure({
    params: z.object({
      symbol: Symbol,
      startDate: z
        .enum(START_DATES_1w)
        .meta({ description: '1w window start date (1st of Jan, every 10 years, UTC). Window covers 10 calendar years.' }),
    }),
    output: Candles,
  }).handle((_req, { symbol, startDate }) => loadCandles('1w', symbol, startDate));

  @operation({
    summary: 'Get 1M klines window',
    description: klinesDescription('1M'),
    tags: ['klines'],
  })
  @get('1M/{symbol}/{startDate}.json', { staticParams: staticParamsFor(START_DATES_1M) })
  static getKlines1M = procedure({
    params: z.object({
      symbol: Symbol,
      startDate: z
        .enum(START_DATES_1M)
        .meta({ description: '1M window start date (1st of Jan, every 10 years, UTC). Window covers 10 calendar years of monthly candles.' }),
    }),
    output: Candles,
  }).handle((_req, { symbol, startDate }) => loadCandles('1M', symbol, startDate));
}
