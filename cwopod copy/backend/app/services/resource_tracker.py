"""Resource usage tracker — instruments operations to record CPU, RAM, GPU usage.

Usage:
    tracker = ResourceTracker(db, user_id)
    async with tracker.track("typeset", project_id=pid, provider="local"):
        # ... do expensive work ...

The context manager records wall time, CPU time, and peak RAM automatically.
GPU metrics are captured if nvidia-smi is available.
"""

import logging
import os
import subprocess
import time
from contextlib import asynccontextmanager
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.resource_usage import OperationType, ResourceUsage

logger = logging.getLogger(__name__)


def _get_process_cpu_time() -> float:
    """Get current process CPU time (user + system) in seconds."""
    try:
        times = os.times()
        return times.user + times.system + times.children_user + times.children_system
    except Exception:
        return 0.0


def _get_process_ram_mb() -> float:
    """Get current process RSS in MB."""
    try:
        import resource as res_mod
        # getrusage returns maxrss in KB on Linux, bytes on macOS
        usage = res_mod.getrusage(res_mod.RUSAGE_SELF)
        maxrss = usage.ru_maxrss
        # Linux: KB, macOS: bytes
        import platform
        if platform.system() == "Darwin":
            return maxrss / (1024 * 1024)
        return maxrss / 1024
    except Exception:
        return 0.0


def _get_gpu_stats() -> dict | None:
    """Query nvidia-smi for GPU memory usage. Returns None if unavailable."""
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.used,memory.total,utilization.gpu",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode != 0:
            return None
        line = result.stdout.strip().split("\n")[0]
        parts = [p.strip() for p in line.split(",")]
        if len(parts) >= 3:
            return {
                "memory_used_mb": float(parts[0]),
                "memory_total_mb": float(parts[1]),
                "utilization_pct": float(parts[2]),
            }
    except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
        return None
    return None


class ResourceTracker:
    """Tracks resource usage for operations and persists to database."""

    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id
        logger.debug("ResourceTracker initialized: user_id=%s", user_id)

    @asynccontextmanager
    async def track(
        self,
        operation: str,
        project_id: UUID | None = None,
        provider: str | None = None,
        model_name: str | None = None,
        notes: str | None = None,
    ):
        """Context manager that records resource usage for an operation.

        Args:
            operation: One of OperationType values (typeset, cover_generate, etc.)
            project_id: The project this operation belongs to (optional).
            provider: AI provider used (local, openai, anthropic, replicate).
            model_name: Model name used (e.g., llama3.2:1b, dall-e-3).
            notes: Free-text notes (e.g., page count, image count).
        """
        logger.info(
            "ResourceTracker.track: starting operation=%s, project_id=%s, provider=%s",
            operation, project_id, provider,
        )

        # Capture baseline
        start_wall = time.time()
        start_cpu = _get_process_cpu_time()
        start_ram = _get_process_ram_mb()
        start_gpu = _get_gpu_stats()

        peak_ram = start_ram
        peak_gpu_ram = start_gpu["memory_used_mb"] if start_gpu else None

        try:
            yield
        finally:
            # Capture end state
            end_wall = time.time()
            end_cpu = _get_process_cpu_time()
            end_ram = _get_process_ram_mb()
            end_gpu = _get_gpu_stats()

            wall_time = end_wall - start_wall
            cpu_time = end_cpu - start_cpu
            peak_ram = max(peak_ram, end_ram)

            gpu_time = None
            if start_gpu and end_gpu:
                # Estimate GPU time as wall_time * utilization fraction
                avg_util = end_gpu["utilization_pct"] / 100.0
                gpu_time = wall_time * avg_util
                peak_gpu_ram = max(
                    peak_gpu_ram or 0,
                    end_gpu["memory_used_mb"],
                )

            logger.info(
                "ResourceTracker.track: completed operation=%s, "
                "wall=%.2fs, cpu=%.2fs, gpu=%.2fs, peak_ram=%.0fMB, peak_gpu=%.0fMB",
                operation, wall_time, cpu_time,
                gpu_time or 0, peak_ram, peak_gpu_ram or 0,
            )

            # Persist to database
            try:
                op_enum = OperationType(operation)
            except ValueError:
                op_enum = OperationType.OTHER

            record = ResourceUsage(
                project_id=project_id,
                user_id=self.user_id,
                operation=op_enum,
                wall_time_seconds=round(wall_time, 3),
                cpu_time_seconds=round(cpu_time, 3),
                gpu_time_seconds=round(gpu_time, 3) if gpu_time else None,
                peak_ram_mb=round(peak_ram, 1),
                peak_gpu_ram_mb=round(peak_gpu_ram, 1) if peak_gpu_ram else None,
                provider=provider,
                model_name=model_name,
                notes=notes,
            )
            self.db.add(record)
            # Don't commit here — let the caller's transaction handle it
            await self.db.flush()
            logger.debug("ResourceTracker.track: record saved, id=%s", record.id)


def record_usage_sync(
    project_id: str | None,
    user_id: str,
    operation: str,
    wall_time_seconds: float,
    cpu_time_seconds: float = 0.0,
    gpu_time_seconds: float | None = None,
    peak_ram_mb: float | None = None,
    peak_gpu_ram_mb: float | None = None,
    provider: str | None = None,
    model_name: str | None = None,
    notes: str | None = None,
):
    """Synchronous helper to record resource usage from Celery tasks.

    Creates its own DB session, commits, and closes. Safe to call from
    any synchronous context (Celery workers, scripts, etc.).
    """
    import asyncio

    async def _persist():
        from app.database import create_worker_session
        from uuid import UUID as _UUID

        worker_session_factory, worker_engine = create_worker_session()
        async with worker_session_factory() as db:
            try:
                op_enum = OperationType(operation)
            except ValueError:
                op_enum = OperationType.OTHER

            record = ResourceUsage(
                project_id=_UUID(project_id) if project_id else None,
                user_id=_UUID(user_id),
                operation=op_enum,
                wall_time_seconds=round(wall_time_seconds, 3),
                cpu_time_seconds=round(cpu_time_seconds, 3),
                gpu_time_seconds=round(gpu_time_seconds, 3) if gpu_time_seconds else None,
                peak_ram_mb=round(peak_ram_mb, 1) if peak_ram_mb else None,
                peak_gpu_ram_mb=round(peak_gpu_ram_mb, 1) if peak_gpu_ram_mb else None,
                provider=provider,
                model_name=model_name,
                notes=notes,
            )
            db.add(record)
            await db.commit()
            logger.debug("record_usage_sync: saved record for op=%s, project=%s", operation, project_id)

        await worker_engine.dispose()

    try:
        loop = asyncio.new_event_loop()
        try:
            asyncio.set_event_loop(loop)
            loop.run_until_complete(_persist())
        finally:
            asyncio.set_event_loop(None)
            loop.close()
    except Exception as e:
        logger.warning("record_usage_sync: failed to persist usage record: %s", e)


class TaskResourceTimer:
    """Simple timer for Celery tasks. Captures wall time, CPU time, and GPU stats.

    Usage:
        timer = TaskResourceTimer()
        timer.start()
        # ... do work ...
        timer.stop()
        timer.save(project_id, user_id, "typeset", provider="local")
    """

    def __init__(self):
        self._start_wall = 0.0
        self._start_cpu = 0.0
        self._start_gpu = None
        self._end_wall = 0.0
        self._end_cpu = 0.0
        self._end_gpu = None

    def start(self):
        """Call at the beginning of the operation."""
        self._start_wall = time.time()
        self._start_cpu = _get_process_cpu_time()
        self._start_gpu = _get_gpu_stats()
        logger.debug("TaskResourceTimer.start: wall=%.3f, cpu=%.3f", self._start_wall, self._start_cpu)

    def stop(self):
        """Call at the end of the operation."""
        self._end_wall = time.time()
        self._end_cpu = _get_process_cpu_time()
        self._end_gpu = _get_gpu_stats()
        logger.debug(
            "TaskResourceTimer.stop: wall=%.2fs, cpu=%.2fs",
            self._end_wall - self._start_wall,
            self._end_cpu - self._start_cpu,
        )

    @property
    def wall_time(self) -> float:
        return self._end_wall - self._start_wall

    @property
    def cpu_time(self) -> float:
        return self._end_cpu - self._start_cpu

    @property
    def gpu_time(self) -> float | None:
        if self._start_gpu and self._end_gpu:
            avg_util = self._end_gpu["utilization_pct"] / 100.0
            return self.wall_time * avg_util
        return None

    @property
    def peak_ram_mb(self) -> float:
        return _get_process_ram_mb()

    @property
    def peak_gpu_ram_mb(self) -> float | None:
        if self._end_gpu:
            return self._end_gpu["memory_used_mb"]
        return None

    def save(
        self,
        project_id: str | None,
        user_id: str,
        operation: str,
        provider: str | None = None,
        model_name: str | None = None,
        notes: str | None = None,
    ):
        """Persist the recorded metrics to the database."""
        record_usage_sync(
            project_id=project_id,
            user_id=user_id,
            operation=operation,
            wall_time_seconds=self.wall_time,
            cpu_time_seconds=self.cpu_time,
            gpu_time_seconds=self.gpu_time,
            peak_ram_mb=self.peak_ram_mb,
            peak_gpu_ram_mb=self.peak_gpu_ram_mb,
            provider=provider,
            model_name=model_name,
            notes=notes,
        )
