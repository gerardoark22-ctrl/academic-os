"""Instrumentación ligera de rendimiento (activar con ACADEMICOS_PERF=1)."""

import os
import time
from contextlib import contextmanager
from typing import Iterator

_ENABLED = os.environ.get("ACADEMICOS_PERF", "").strip().lower() in ("1", "true", "yes")
_log: list[tuple[str, float]] = []


def perf_enabled() -> bool:
    return _ENABLED


def perf_log() -> list[tuple[str, float]]:
    return list(_log)


@contextmanager
def measure(label: str) -> Iterator[None]:
    if not _ENABLED:
        yield
        return
    t0 = time.perf_counter()
    yield
    ms = (time.perf_counter() - t0) * 1000
    _log.append((label, ms))
    print(f"[AcademicOS perf] {label}: {ms:.1f} ms")
