'use client';

import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function Home() {
  return (
    <ApiReferenceReact
      configuration={{
        url: `${basePath}/api/openapi.json`,
        hideClientButton: false,
        metaData: {
          title: 'static-klines — Binance spot klines as static JSON',
          description:
            'Historical Binance spot klines served as pre-rendered static JSON. No rate limits, infinite cache lifetime.',
        },
      }}
    />
  );
}
