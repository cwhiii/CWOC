import logging
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import auth, projects, search, health, user, ai_config, quality_controller, typeset, cover, print_orders, bookshelf, ollama, shipping_addresses, admin, comfyui, shared_images, illustrations, tasks

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG, format="%(asctime)s %(name)s %(levelname)s %(message)s")

app = FastAPI(
    title="CWOPOD",
    description="C.W.'s O-POD (Open Print-On-Demand) — print-on-demand for public domain texts",
    version="0.1.0",
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch all unhandled exceptions and return full traceback in response."""
    tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
    tb_str = "".join(tb)
    logger.error(f"Unhandled exception on {request.method} {request.url}: {exc}\n{tb_str}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": str(exc),
            "traceback": tb_str,
            "path": str(request.url),
            "method": request.method,
        },
    )

logger.info("Starting CWOPOD backend")
logger.info(f"APP_URL={settings.app_url}")

# CORS — allow frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.app_url, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register source providers
from app.services.source_service import register_builtin_providers

register_builtin_providers()
logger.info("Source providers registered")

# Register routers
app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(user.router, prefix="/api/user", tags=["user"])
app.include_router(ai_config.router, prefix="/api/user", tags=["ai-config"])
app.include_router(shared_images.router, prefix="/api/user", tags=["shared-images"])
app.include_router(cover.router, prefix="/api/projects", tags=["cover"])
app.include_router(illustrations.router, prefix="/api/projects", tags=["illustrations"])
app.include_router(quality_controller.router, prefix="/api/projects", tags=["quality-controller"])
app.include_router(typeset.router, prefix="/api/projects", tags=["typeset"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(print_orders.router, prefix="/api/print", tags=["print"])
app.include_router(shipping_addresses.router, prefix="/api/user", tags=["shipping-addresses"])
app.include_router(bookshelf.router, prefix="/api/bookshelf", tags=["bookshelf"])
app.include_router(ollama.router, prefix="/api", tags=["ollama"])
app.include_router(comfyui.router, prefix="/api", tags=["comfyui"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(tasks.router, prefix="/api", tags=["tasks"])

logger.info("All routers registered, app ready")


@app.on_event("startup")
async def preload_ollama_model():
    """Preload the Ollama model into memory on app startup so inference is fast."""
    import httpx
    from app.config import settings as app_settings

    ollama_url = (app_settings.ollama_url or "http://ollama:11434").rstrip("/")
    model = "mistral:7b"
    logger.info("startup: preloading Ollama model %s at %s", model, ollama_url)

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{ollama_url}/api/generate",
                json={
                    "model": model,
                    "prompt": "",
                    "keep_alive": "30m",
                    "stream": False,
                },
            )
            resp.raise_for_status()
            logger.info("startup: Ollama model %s preloaded successfully", model)
    except httpx.ConnectError:
        logger.warning("startup: Ollama not reachable at %s — model not preloaded", ollama_url)
    except httpx.TimeoutException:
        logger.warning("startup: Ollama model preload timed out (>120s)")
    except Exception as e:
        logger.warning("startup: Ollama model preload failed: %s", str(e))


@app.on_event("startup")
async def trigger_gutenberg_catalog_sync():
    """Trigger Gutenberg catalog sync if the local cache is empty.

    Queues a background Celery task so it doesn't block app startup.
    The task checks if the cache is already populated and skips if so.
    """
    logger.info("startup: checking if Gutenberg catalog sync is needed")
    try:
        from app.services.source_service.tasks import sync_gutenberg_catalog_if_empty_task
        sync_gutenberg_catalog_if_empty_task.delay()
        logger.info("startup: Gutenberg catalog sync task queued (will skip if cache already populated)")
    except Exception as e:
        logger.warning("startup: failed to queue Gutenberg catalog sync: %s", str(e))
