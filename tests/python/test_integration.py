"""Live integration tests against the deployed static-klines API.

Uses the package built into ../../dist_python. Point at a different host
via the TEST_API_ROOT environment variable (default: production GitHub
Pages URL).
"""

from __future__ import annotations

import os
import unittest

from static_klines import KLinesAPI

API_ROOT = os.environ.get("TEST_API_ROOT", "https://finom.github.io/static-klines/api")

SYMBOLS = [
    "BTCUSDT",
    "ETHUSDT",
    "BNBUSDT",
    "SOLUSDT",
    "XRPUSDT",
    "ADAUSDT",
    "DOGEUSDT",
    "AVAXUSDT",
    "LINKUSDT",
    "DOTUSDT",
]


class PythonClientLiveTests(unittest.TestCase):
    def test_get_symbols(self) -> None:
        symbols = KLinesAPI.get_symbols(api_root=API_ROOT)
        self.assertEqual(symbols, SYMBOLS)

    def test_get_start_dates_1d(self) -> None:
        dates = KLinesAPI.get_start_dates(
            params={"interval": "1d"},
            api_root=API_ROOT,
        )
        self.assertIsInstance(dates, list)
        self.assertIn("2018-01-01", dates)
        self.assertIn("2020-01-01", dates)
        # Anchor is 2016-01-01 (2-year stride, even years)
        self.assertEqual(dates[0], "2016-01-01")

    def test_get_klines_1_d_btcusdt_2018(self) -> None:
        candles = KLinesAPI.get_klines_1_d(
            params={"symbol": "BTCUSDT", "startDate": "2018-01-01"},
            api_root=API_ROOT,
        )
        self.assertIsInstance(candles, list)
        self.assertGreater(len(candles), 0)
        first = candles[0]
        self.assertEqual(len(first), 12, "Binance kline tuple has 12 elements")
        # 2018-01-01 00:00 UTC in ms
        self.assertEqual(first[0], 1514764800000)
        self.assertIsInstance(first[1], str, "open price is a stringified decimal")

    def test_get_klines_15_m_solusdt_week(self) -> None:
        candles = KLinesAPI.get_klines_15_m(
            params={"symbol": "SOLUSDT", "startDate": "2025-01-06"},
            api_root=API_ROOT,
        )
        # 7 days × 24 h × 4 (15-min slices) = 672
        self.assertEqual(len(candles), 672)
        self.assertEqual(candles[0][0], 1736121600000)  # 2025-01-06 UTC


class OpenApiShapeTests(unittest.TestCase):
    """Regression checks for the published spec itself, independent of the
    generated client. Catches path/server-prefix drifts like `/api/api/...`."""

    def _fetch_spec(self) -> dict:
        import urllib.request
        with urllib.request.urlopen(f"{API_ROOT}/openapi.json") as r:
            import json as _json
            return _json.loads(r.read().decode())

    def test_servers_do_not_end_in_api(self) -> None:
        spec = self._fetch_spec()
        # Paths already carry the /api prefix, so servers.url must not —
        # otherwise tools composing ${server.url}${path} produce /api/api.
        for server in spec["servers"]:
            url = server["url"].rstrip("/")
            self.assertFalse(
                url.endswith("/api"),
                f"servers.url '{url}' must not end with /api (paths already include it)",
            )

    def test_composed_url_resolves(self) -> None:
        import urllib.request
        spec = self._fetch_spec()
        server = spec["servers"][0]["url"].rstrip("/")
        with urllib.request.urlopen(f"{server}/api/klines/symbols.json") as r:
            self.assertEqual(r.status, 200)


class DefaultApiRootTests(unittest.TestCase):
    """Every client method should work without `api_root=` — the production
    URL is baked into the generated package. These tests always hit
    https://finom.github.io/static-klines/api."""

    def test_get_symbols_no_args(self) -> None:
        self.assertEqual(KLinesAPI.get_symbols(), SYMBOLS)

    def test_get_start_dates_no_api_root(self) -> None:
        dates = KLinesAPI.get_start_dates(params={"interval": "1d"})
        self.assertIn("2018-01-01", dates)
        self.assertEqual(dates[0], "2016-01-01")

    def test_get_klines_1_d_no_api_root(self) -> None:
        candles = KLinesAPI.get_klines_1_d(
            params={"symbol": "BTCUSDT", "startDate": "2018-01-01"},
        )
        self.assertGreater(len(candles), 0)
        self.assertEqual(candles[0][0], 1514764800000)


if __name__ == "__main__":
    unittest.main()
