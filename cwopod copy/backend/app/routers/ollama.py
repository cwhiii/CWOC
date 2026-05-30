"""Ollama model management: load, unload, pull, and status endpoints."""

import logging
import re

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

OLLAMA_URL = settings.ollama_url or "http://ollama:11434"
DEFAULT_MODEL = "mistral:7b"


def _ollama_base() -> str:
    return OLLAMA_URL.rstrip("/")


@router.get("/ollama/status")
async def ollama_status():
    """Check if Ollama is reachable and whether the model is loaded in memory."""
    logger.debug("ollama_status: checking Ollama at %s", _ollama_base())
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Check running models (loaded in memory)
            resp = await client.get(f"{_ollama_base()}/api/ps")
            resp.raise_for_status()
            data = resp.json()

            running_models = data.get("models", [])
            loaded = any(
                m.get("name", "").startswith(DEFAULT_MODEL.split(":")[0])
                for m in running_models
            )

            model_info = None
            for m in running_models:
                if m.get("name", "").startswith(DEFAULT_MODEL.split(":")[0]):
                    model_info = {
                        "name": m.get("name"),
                        "size": m.get("size"),
                        "expires_at": m.get("expires_at"),
                    }
                    break

            logger.info(
                "ollama_status: reachable=True, loaded=%s, running_models=%d",
                loaded, len(running_models),
            )
            return {
                "reachable": True,
                "model": DEFAULT_MODEL,
                "loaded": loaded,
                "model_info": model_info,
                "running_models": [m.get("name") for m in running_models],
            }
    except httpx.ConnectError:
        logger.warning("ollama_status: Ollama not reachable at %s", _ollama_base())
        return {"reachable": False, "model": DEFAULT_MODEL, "loaded": False}
    except Exception as e:
        logger.error("ollama_status: unexpected error: %s", str(e))
        return {"reachable": False, "model": DEFAULT_MODEL, "loaded": False, "error": str(e)}


@router.post("/ollama/load")
async def ollama_load():
    """Load the default model into Ollama's memory (warm it up)."""
    logger.info("ollama_load: loading model %s into memory", DEFAULT_MODEL)
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            # Send a minimal generate request with keep_alive to load the model
            resp = await client.post(
                f"{_ollama_base()}/api/generate",
                json={
                    "model": DEFAULT_MODEL,
                    "prompt": "",
                    "keep_alive": "30m",
                    "stream": False,
                },
            )
            resp.raise_for_status()
            logger.info("ollama_load: model %s loaded successfully", DEFAULT_MODEL)
            return {"status": "loaded", "model": DEFAULT_MODEL}
    except httpx.ConnectError:
        logger.error("ollama_load: Ollama not reachable at %s", _ollama_base())
        return {"status": "error", "error": "Ollama not reachable"}
    except httpx.TimeoutException:
        logger.error("ollama_load: timeout loading model %s", DEFAULT_MODEL)
        return {"status": "error", "error": "Timeout loading model (>120s)"}
    except Exception as e:
        logger.error("ollama_load: unexpected error: %s", str(e))
        return {"status": "error", "error": str(e)}


@router.post("/ollama/unload")
async def ollama_unload():
    """Unload the model from Ollama's memory to free RAM."""
    logger.info("ollama_unload: unloading model %s from memory", DEFAULT_MODEL)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Setting keep_alive to 0 tells Ollama to unload immediately
            resp = await client.post(
                f"{_ollama_base()}/api/generate",
                json={
                    "model": DEFAULT_MODEL,
                    "prompt": "",
                    "keep_alive": 0,
                    "stream": False,
                },
            )
            resp.raise_for_status()
            logger.info("ollama_unload: model %s unloaded successfully", DEFAULT_MODEL)
            return {"status": "unloaded", "model": DEFAULT_MODEL}
    except httpx.ConnectError:
        logger.error("ollama_unload: Ollama not reachable at %s", _ollama_base())
        return {"status": "error", "error": "Ollama not reachable"}
    except Exception as e:
        logger.error("ollama_unload: unexpected error: %s", str(e))
        return {"status": "error", "error": str(e)}


class OllamaPullRequest(BaseModel):
    model: str

    @field_validator("model")
    @classmethod
    def validate_model_name(cls, v):
        """Validate model name format (e.g. 'llama3.2:1b', 'mistral', 'phi3:mini')."""
        v = v.strip()
        if not v:
            raise ValueError("Model name must not be empty")
        if len(v) > 200:
            raise ValueError("Model name too long (max 200 chars)")
        # Basic format: alphanumeric, dots, dashes, underscores, colons, slashes
        if not re.match(r'^[a-zA-Z0-9._\-/:]+$', v):
            raise ValueError(
                "Invalid model name. Use the format from Ollama's library, "
                "e.g. 'llama3.2:1b', 'mistral:7b', 'phi3:mini'"
            )
        return v


@router.get("/ollama/models")
async def ollama_list_models():
    """List all models currently downloaded in Ollama."""
    logger.info("ollama_list_models: querying Ollama for installed models")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{_ollama_base()}/api/tags")
            resp.raise_for_status()
            data = resp.json()

            models = []
            for m in data.get("models", []):
                models.append({
                    "name": m.get("name"),
                    "size": m.get("size"),
                    "modified_at": m.get("modified_at"),
                    "digest": m.get("digest", "")[:12],
                })

            logger.info("ollama_list_models: found %d models", len(models))
            return {"models": models}
    except httpx.ConnectError:
        logger.warning("ollama_list_models: Ollama not reachable at %s", _ollama_base())
        return {"models": [], "error": "Ollama not reachable"}
    except Exception as e:
        logger.error("ollama_list_models: unexpected error: %s", str(e))
        return {"models": [], "error": str(e)}


@router.post("/ollama/pull")
async def ollama_pull(body: OllamaPullRequest):
    """Start pulling a model from the Ollama registry as a background task.

    Returns a task_id for polling progress via /ollama/pull/status/{task_id}.
    """
    model_name = body.model.strip()
    logger.info("ollama_pull: starting pull task for model '%s'", model_name)

    # Quick check that Ollama is reachable before starting the task
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{_ollama_base()}/api/tags")
            resp.raise_for_status()
    except httpx.ConnectError:
        logger.error("ollama_pull: Ollama not reachable at %s", _ollama_base())
        raise HTTPException(
            status_code=503,
            detail="Ollama is not reachable. Make sure the Ollama container is running.",
        )
    except Exception:
        pass  # Non-critical — let the task handle errors

    from app.services.ollama.tasks import pull_model_task
    task = pull_model_task.delay(model_name)
    logger.info("ollama_pull: task started, task_id=%s, model=%s", task.id, model_name)

    return {
        "status": "started",
        "task_id": task.id,
        "model": model_name,
    }


@router.get("/ollama/pull/status/{task_id}")
async def ollama_pull_status(task_id: str):
    """Poll the progress of an Ollama model pull task."""
    from celery.result import AsyncResult
    from app.worker import celery_app

    logger.debug("ollama_pull_status: task_id=%s", task_id)

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
            "status": "pulling",
            "percent": meta.get("percent", 0),
            "downloaded_mb": meta.get("downloaded_mb", 0),
            "total_mb": meta.get("total_mb", 0),
            "label": meta.get("label", "Pulling..."),
        }
    elif state == "SUCCESS":
        data = result.result or {}
        return {
            "status": data.get("status", "success"),
            "percent": 100,
            "model": data.get("model", ""),
            "message": data.get("message", "Pull complete."),
            "label": data.get("message", "Pull complete."),
        }
    elif state == "FAILURE":
        error_msg = str(result.info) if result.info else "Unknown error"
        logger.error("ollama_pull_status: task failed, error=%s", error_msg)
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


@router.delete("/ollama/models/{model_name:path}")
async def ollama_delete_model(model_name: str):
    """Delete a model from Ollama to free disk space."""
    logger.info("ollama_delete_model: deleting model '%s'", model_name)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # httpx's .delete() doesn't support json= body, so use .request()
            resp = await client.request(
                "DELETE",
                f"{_ollama_base()}/api/delete",
                json={"model": model_name},
            )
            if resp.status_code == 404:
                raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")
            resp.raise_for_status()
            logger.info("ollama_delete_model: model '%s' deleted successfully", model_name)
            return {"status": "deleted", "model": model_name}
    except HTTPException:
        raise
    except httpx.ConnectError:
        logger.error("ollama_delete_model: Ollama not reachable")
        raise HTTPException(status_code=503, detail="Ollama is not reachable")
    except Exception as e:
        logger.error("ollama_delete_model: unexpected error: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))
