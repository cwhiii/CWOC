"""Celery tasks for ComfyUI model management."""

import logging
import pathlib

import httpx

from app.worker import celery_app

logger = logging.getLogger(__name__)

MODEL_DIR = pathlib.Path("/app/comfyui_models/checkpoints")


@celery_app.task(bind=True, name="comfyui.download_model", soft_time_limit=3600, time_limit=7200)
def download_model_task(self, model_name: str, url: str) -> dict:
    """Download a model checkpoint file with real progress reporting.

    Reports progress as percentage based on Content-Length header.
    """
    logger.info("download_model_task: starting, model=%s, url=%s", model_name, url[:100])

    self.update_state(
        state="PROGRESS",
        meta={
            "status": "downloading",
            "percent": 0,
            "downloaded_mb": 0,
            "total_mb": 0,
            "label": f"Starting download of {model_name}...",
        },
    )

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    dest_path = MODEL_DIR / model_name

    # Check if already exists
    if dest_path.exists():
        size_mb = dest_path.stat().st_size / (1024 * 1024)
        logger.info("download_model_task: model already exists, size=%.1fMB", size_mb)
        return {
            "status": "exists",
            "model": model_name,
            "size_mb": round(size_mb, 1),
            "message": f"Model '{model_name}' already exists ({size_mb:.0f} MB).",
        }

    # Download with progress tracking
    try:
        with httpx.Client(timeout=httpx.Timeout(timeout=3600.0), follow_redirects=True) as client:
            with client.stream("GET", url) as resp:
                if resp.status_code == 404:
                    logger.error("download_model_task: 404 at url=%s", url[:100])
                    return {
                        "status": "failed",
                        "model": model_name,
                        "message": f"Model not found at URL (404).",
                    }
                resp.raise_for_status()

                total_bytes = int(resp.headers.get("content-length", 0))
                total_mb = total_bytes / (1024 * 1024) if total_bytes else 0
                downloaded_bytes = 0
                last_reported_percent = -1

                logger.info(
                    "download_model_task: streaming, total_size=%.1fMB, model=%s",
                    total_mb, model_name,
                )

                self.update_state(
                    state="PROGRESS",
                    meta={
                        "status": "downloading",
                        "percent": 0,
                        "downloaded_mb": 0,
                        "total_mb": round(total_mb, 1),
                        "label": f"Downloading {model_name} (0 / {total_mb:.0f} MB)...",
                    },
                )

                with open(dest_path, "wb") as f:
                    for chunk in resp.iter_bytes(chunk_size=1024 * 1024):
                        f.write(chunk)
                        downloaded_bytes += len(chunk)

                        if total_bytes > 0:
                            percent = int((downloaded_bytes / total_bytes) * 100)
                        else:
                            percent = 0

                        downloaded_mb = downloaded_bytes / (1024 * 1024)

                        # Report progress every 1%
                        if percent > last_reported_percent:
                            last_reported_percent = percent
                            self.update_state(
                                state="PROGRESS",
                                meta={
                                    "status": "downloading",
                                    "percent": percent,
                                    "downloaded_mb": round(downloaded_mb, 1),
                                    "total_mb": round(total_mb, 1),
                                    "label": f"Downloading {model_name} ({downloaded_mb:.0f} / {total_mb:.0f} MB)...",
                                },
                            )

        final_size_mb = dest_path.stat().st_size / (1024 * 1024)
        logger.info(
            "download_model_task: complete, model=%s, size=%.1fMB",
            model_name, final_size_mb,
        )
        return {
            "status": "success",
            "model": model_name,
            "size_mb": round(final_size_mb, 1),
            "message": f"Model '{model_name}' downloaded successfully ({final_size_mb:.0f} MB).",
        }

    except httpx.TimeoutException:
        if dest_path.exists():
            dest_path.unlink()
        logger.error("download_model_task: timeout downloading %s", model_name)
        return {
            "status": "failed",
            "model": model_name,
            "message": "Download timed out. Check your network connection.",
        }
    except Exception as e:
        if dest_path.exists():
            dest_path.unlink()
        logger.error("download_model_task: error downloading %s: %s", model_name, str(e))
        return {
            "status": "failed",
            "model": model_name,
            "message": f"Download failed: {str(e)}",
        }
