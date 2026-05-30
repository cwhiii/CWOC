"""Celery tasks for Ollama model management."""

import json
import logging

import httpx

from app.config import settings
from app.worker import celery_app

logger = logging.getLogger(__name__)


def _ollama_base() -> str:
    return (settings.ollama_url or "http://ollama:11434").rstrip("/")


@celery_app.task(
    bind=True, name="ollama.pull_model",
    soft_time_limit=3600, time_limit=7200,
)
def pull_model_task(self, model_name: str) -> dict:
    """Pull an Ollama model with real progress reporting.

    Uses Ollama's streaming pull API which returns JSON lines
    with download progress (total bytes, completed bytes).
    """
    logger.info("pull_model_task: starting pull for '%s'", model_name)

    self.update_state(
        state="PROGRESS",
        meta={
            "status": "pulling",
            "percent": 0,
            "downloaded_mb": 0,
            "total_mb": 0,
            "label": f"Starting pull of {model_name}...",
        },
    )

    try:
        with httpx.Client(timeout=httpx.Timeout(timeout=3600.0)) as client:
            with client.stream(
                "POST",
                f"{_ollama_base()}/api/pull",
                json={"model": model_name, "stream": True},
            ) as resp:
                if resp.status_code == 404:
                    logger.warning(
                        "pull_model_task: model '%s' not found in registry",
                        model_name,
                    )
                    return {
                        "status": "failed",
                        "model": model_name,
                        "message": (
                            f"Model '{model_name}' not found in the Ollama registry. "
                            f"Check the name at https://ollama.com/library"
                        ),
                    }

                resp.raise_for_status()
                last_reported_percent = -1

                for line in resp.iter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    status_str = data.get("status", "")
                    total = data.get("total", 0)
                    completed = data.get("completed", 0)

                    if total > 0:
                        percent = int((completed / total) * 100)
                        total_mb = round(total / (1024 * 1024), 1)
                        downloaded_mb = round(
                            completed / (1024 * 1024), 1
                        )
                    else:
                        percent = 0
                        total_mb = 0
                        downloaded_mb = 0

                    # Report every 1%
                    if percent > last_reported_percent:
                        last_reported_percent = percent
                        label = status_str
                        if total_mb > 0:
                            label = (
                                f"{status_str} "
                                f"({downloaded_mb:.0f} / {total_mb:.0f} MB)"
                            )
                        self.update_state(
                            state="PROGRESS",
                            meta={
                                "status": "pulling",
                                "percent": percent,
                                "downloaded_mb": downloaded_mb,
                                "total_mb": total_mb,
                                "label": label,
                            },
                        )

                    # Check for error in stream
                    if "error" in data:
                        error_msg = data["error"]
                        logger.error(
                            "pull_model_task: stream error for '%s': %s",
                            model_name, error_msg,
                        )
                        return {
                            "status": "failed",
                            "model": model_name,
                            "message": error_msg,
                        }

        logger.info("pull_model_task: pull complete for '%s'", model_name)
        return {
            "status": "success",
            "model": model_name,
            "message": f"Model '{model_name}' pulled successfully.",
        }

    except httpx.ConnectError:
        logger.error(
            "pull_model_task: Ollama not reachable at %s", _ollama_base()
        )
        return {
            "status": "failed",
            "model": model_name,
            "message": "Ollama is not reachable. Ensure the service is running.",
        }
    except httpx.TimeoutException:
        logger.error(
            "pull_model_task: timeout pulling '%s' (>1hr)", model_name
        )
        return {
            "status": "failed",
            "model": model_name,
            "message": f"Timed out pulling model '{model_name}'.",
        }
    except Exception as e:
        logger.error(
            "pull_model_task: unexpected error pulling '%s': %s",
            model_name, str(e),
        )
        return {
            "status": "failed",
            "model": model_name,
            "message": f"Pull failed: {str(e)}",
        }
