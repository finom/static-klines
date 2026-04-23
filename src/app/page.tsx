'use client';

import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const REPO_URL = 'https://github.com/finom/static-klines';

export default function Home() {
  return (
    <>
      {/* Always-visible "source on GitHub" link — Scalar has no built-in slot
          for this, so we float it in the corner above its chrome. */}
      <a
        href={REPO_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="View source on GitHub"
        style={{
          position: 'fixed',
          top: '0.75rem',
          right: '1rem',
          zIndex: 9999,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.4rem 0.75rem',
          borderRadius: '0.375rem',
          background: '#24292f',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: '0.8125rem',
          fontWeight: 500,
          lineHeight: 1,
          textDecoration: 'none',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
        </svg>
        View on GitHub
      </a>
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
    </>
  );
}
