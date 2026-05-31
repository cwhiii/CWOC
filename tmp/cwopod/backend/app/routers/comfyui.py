"""ComfyUI router: model management and status for local image generation."""

import logging
import pathlib

import httpx
from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.middleware.auth import get_current_user
from app.models.user import User
from app.routers.admin import require_admin
from app.worker import celery_app

logger = logging.getLogger(__name__)

router = APIRouter()

MODEL_DIR = pathlib.Path("/app/comfyui_models/checkpoints")


def _comfyui_base() -> str:
    """Get the ComfyUI base URL."""
    return (settings.comfyui_url or "http://comfyui:8188").rstrip("/")


class ComfyUIModelDownloadRequest(BaseModel):
    """Request to download a model checkpoint."""
    model_name: str
    url: str


# --- Well-known models for the UI ---

KNOWN_MODELS = {
    "v1-5-pruned-emaonly.safetensors": {
        "name": "Stable Diffusion 1.5 (Recommended for 6GB VRAM)",
        "url": "https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors",
        "size_gb": 4.0,
    },
    "v1-5-pruned.safetensors": {
        "name": "Stable Diffusion 1.5 (Full, with EMA weights)",
        "url": "https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5/resolve/main/v1-5-pruned.safetensors",
        "size_gb": 7.7,
    },
}


@router.get("/comfyui/status")
async def comfyui_status(
    _user: User = Depends(get_current_user),
):
    """Check if ComfyUI is reachable and list installed models."""
    logger.info("comfyui_status: checking ComfyUI at %s", _comfyui_base())
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{_comfyui_base()}/system_stats")
            resp.raise_for_status()
            system_stats = resp.json()

            # List checkpoint models via ComfyUI API
            obj_resp = await client.get(
                f"{_comfyui_base()}/object_info/CheckpointLoaderSimple"
            )
            checkpoints = []
            if obj_resp.status_code == 200:
                obj_data = obj_resp.json()
                node_info = obj_data.get("CheckpointLoaderSimple", {})
                input_info = node_info.get("input", {}).get("required", {})
                ckpt_list = input_info.get("ckpt_name", [[]])[0]
                checkpoints = list(ckpt_list) if isinstance(ckpt_list, (list, tuple)) else []

            logger.info("comfyui_status: reachable, %d checkpoints", len(checkpoints))
            return {
                "reachable": True,
                "checkpoints": checkpoints,
                "system_stats": system_stats,
                "known_models": KNOWN_MODELS,
            }
    except httpx.ConnectError as e:
        logger.warning("comfyui_status: not reachable at %s, error=%s", _comfyui_base(), str(e))
        # Check if model files exist on disk (shared volume)
        models_on_disk = []
        if MODEL_DIR.exists():
            models_on_disk = [f.name for f in MODEL_DIR.iterdir() if f.is_file() and f.suffix in (".safetensors", ".ckpt")]
        return {
            "reachable": False,
            "checkpoints": [],
            "error": (
                f"ComfyUI is not reachable at {_comfyui_base()}. "
                f"The ComfyUI Docker container is likely not running. "
                f"Run 'docker compose ps comfyui' on the server to check. "
                f"Connection error: {str(e)}"
            ),
            "comfyui_url": _comfyui_base(),
            "models_on_disk": models_on_disk,
            "known_models": KNOWN_MODELS,
        }
    except Exception as e:
        logger.error("comfyui_status: unexpected error: %s", str(e))
        return {
            "reachable": False,
            "checkpoints": [],
            "error": str(e),
            "known_models": KNOWN_MODELS,
        }


@router.post("/comfyui/models/download")
async def comfyui_download_model(
    body: ComfyUIModelDownloadRequest,
    _admin: User = Depends(require_admin),
):
    """Start a model checkpoint download as a background task.

    Admin-only. Returns a task_id for polling progress.
    """
    model_name = body.model_name.strip()
    url = body.url.strip()

    logger.info(
        "comfyui_download_model: admin=%s, model=%s, url=%s",
        _admin.id, model_name, url[:100],
    )

    if not model_name or not url:
        raise HTTPException(status_code=400, detail="model_name and url are required")

    # Validate filename (prevent path traversal)
    if "/" in model_name or "\\" in model_name or ".." in model_name:
        raise HTTPException(status_code=400, detail="Invalid model filename")

    # Check if already exists
    dest_path = MODEL_DIR / model_name
    if dest_path.exists():
        size_mb = dest_path.stat().st_size / (1024 * 1024)
        return {
            "status": "exists",
            "model": model_name,
            "message": f"Model '{model_name}' already exists ({size_mb:.0f} MB).",
        }

    # Start Celery task
    from app.services.comfyui.tasks import download_model_task
    task = download_model_task.delay(model_name, url)
    logger.info("comfyui_download_model: task started, task_id=%s", task.id)

    return {
        "status": "started",
        "task_id": task.id,
        "model": model_name,
    }


@router.get("/comfyui/models/download/status/{task_id}")
async def comfyui_download_status(
    task_id: str,
    _user: User = Depends(get_current_user),
):
    """Poll the progress of a model download task."""
    logger.debug("comfyui_download_status: task_id=%s", task_id)

    result = AsyncResult(task_id, app=celery_app)
    state = result.state

    if state == "PENDING":
        return {
            "status": "pending",
            "percent": 0,
            "label": "Waiting to start...",
        }
    elif state == "PROGRESS":
        meta = result.info or {}
        return {
            "status": "downloading",
            "percent": meta.get("percent", 0),
            "downloaded_mb": meta.get("downloaded_mb", 0),
            "total_mb": meta.get("total_mb", 0),
            "label": meta.get("label", "Downloading..."),
        }
    elif state == "SUCCESS":
        data = result.result or {}
        return {
            "status": data.get("status", "success"),
            "percent": 100,
            "model": data.get("model", ""),
            "size_mb": data.get("size_mb", 0),
            "message": data.get("message", "Download complete."),
            "label": data.get("message", "Download complete."),
        }
    elif state == "FAILURE":
        error_msg = str(result.info) if result.info else "Unknown error"
        logger.error("comfyui_download_status: task failed, error=%s", error_msg)
        return {
            "status": "failed",
            "percent": 0,
            "label": f"Failed: {error_msg}",
            "message": error_msg,
        }
    else:
        return {
            "status": "unknown",
            "percent": 0,
            "label": f"Unknown state: {state}",
        }


@router.get("/comfyui/models")
async def comfyui_list_models(
    _user: User = Depends(get_current_user),
):
    """List downloaded ComfyUI checkpoint models."""
    logger.info("comfyui_list_models: listing checkpoints")

    models = []
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    for f in MODEL_DIR.iterdir():
        if f.is_file() and f.suffix in (".safetensors", ".ckpt"):
            size_mb = f.stat().st_size / (1024 * 1024)
            models.append({
                "name": f.name,
                "size_mb": round(size_mb, 1),
            })

    logger.info("comfyui_list_models: found %d models", len(models))
    return {
        "models": models,
        "known_models": KNOWN_MODELS,
    }


@router.delete("/comfyui/models/{model_name}")
async def comfyui_delete_model(
    model_name: str,
    _admin: User = Depends(require_admin),
):
    """Delete a downloaded ComfyUI model. Admin-only."""
    logger.info("comfyui_delete_model: admin=%s, model=%s", _admin.id, model_name)

    if "/" in model_name or "\\" in model_name or ".." in model_name:
        raise HTTPException(status_code=400, detail="Invalid model filename")

    model_path = MODEL_DIR / model_name
    if not model_path.exists():
        raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")

    model_path.unlink()
    logger.info("comfyui_delete_model: deleted %s", model_name)
    return {"status": "deleted", "model": model_name}
