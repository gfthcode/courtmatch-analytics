"""Bounded retries for transient transport failures from the NBA Stats API."""
from __future__ import annotations

import time
from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")
TRANSIENT_NETWORK_ERRORS = {"Timeout", "ReadTimeout", "ConnectTimeout", "ConnectionError"}


class RetryExhaustedError(RuntimeError):
    """Raised only when a recognized transient transport error exhausts retries."""


def retry_nba_request(
    operation: Callable[[], T],
    *,
    label: str,
    attempts: int = 3,
    initial_delay: float = 1.5,
) -> T:
    """Retry only timeout/connection failures; leave API/data errors visible."""
    if attempts < 1:
        raise ValueError("attempts must be at least 1")
    for attempt in range(1, attempts + 1):
        try:
            return operation()
        except Exception as error:
            if not any(error_type.__name__ in TRANSIENT_NETWORK_ERRORS for error_type in type(error).__mro__):
                raise
            if attempt == attempts:
                raise RetryExhaustedError(f"{label} failed after {attempts} network attempts") from error
            delay = initial_delay * (2 ** (attempt - 1))
            print(
                f"NBA Stats {label} network attempt {attempt}/{attempts} failed; retrying in {delay:g}s",
                flush=True,
            )
            time.sleep(delay)
    raise AssertionError("unreachable retry state")
