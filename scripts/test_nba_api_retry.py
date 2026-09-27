"""Regression tests for bounded NBA Stats network retries."""
from __future__ import annotations

import unittest
from unittest.mock import Mock, patch

from requests.exceptions import ReadTimeout

from nba_api_retry import retry_nba_request


class NbaApiRetryTests(unittest.TestCase):
    def test_retries_transient_timeout_then_returns_success(self) -> None:
        calls = 0

        def operation() -> str:
            nonlocal calls
            calls += 1
            if calls < 3:
                raise ReadTimeout("temporary NBA Stats timeout")
            return "verified response"

        with patch("nba_api_retry.time.sleep") as sleep:
            result = retry_nba_request(operation, label="test endpoint")

        self.assertEqual(result, "verified response")
        self.assertEqual(calls, 3)
        self.assertEqual([call.args[0] for call in sleep.call_args_list], [1.5, 3.0])

    def test_does_not_retry_non_transport_errors(self) -> None:
        operation = Mock(side_effect=ValueError("invalid response"))
        with patch("nba_api_retry.time.sleep") as sleep:
            with self.assertRaisesRegex(ValueError, "invalid response"):
                retry_nba_request(operation, label="test endpoint")
        operation.assert_called_once()
        sleep.assert_not_called()

    def test_fails_after_the_configured_network_attempts(self) -> None:
        operation = Mock(side_effect=ReadTimeout("NBA Stats unavailable"))
        with patch("nba_api_retry.time.sleep") as sleep:
            with self.assertRaisesRegex(RuntimeError, "failed after 2 network attempts"):
                retry_nba_request(operation, label="test endpoint", attempts=2)
        self.assertEqual(operation.call_count, 2)
        sleep.assert_called_once_with(1.5)


if __name__ == "__main__":
    unittest.main()
