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

    def test_get_klines_1d_btcusdt_2018(self) -> None:
        candles = KLinesAPI.get_klines_1d(
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

    def test_get_klines_15m_solusdt_week(self) -> None:
        candles = KLinesAPI.get_klines_15m(
            params={"symbol": "SOLUSDT", "startDate": "2025-01-06"},
            api_root=API_ROOT,
        )
        # 7 days × 24 h × 4 (15-min slices) = 672
        self.assertEqual(len(candles), 672)
        self.assertEqual(candles[0][0], 1736121600000)  # 2025-01-06 UTC


if __name__ == "__main__":
    unittest.main()
