import logging
import time

import httpx
from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint for Docker and load balancers."""
    logger.debug("Health check called")
    return {"status": "ok", "service": "cwopod"}


@router.get("/health/connectivity")
async def connectivity_check():
    """Check if the backend can reach external APIs (DNS + HTTP)."""
    logger.info("Connectivity check starting")
    checks = {}

    targets = [
        ("gutendex", "https://gutendex.com/books/?search=test&page=1", None),
    ]

    # Standard Ebooks requires Patrons Circle auth — check from provider instance
    from app.services.source_service.registry import provider_registry
    se_provider = provider_registry.get_all_providers().get("standard_ebooks")
    se_email = getattr(se_provider, '_auth_email', None) if se_provider else None
    se_auth = httpx.BasicAuth(username=se_email, password="") if se_email else None
    targets.append(("standard_ebooks", "https://standardebooks.org/feeds/opds", se_auth))

    import asyncio

    async def check_target(name, url, auth):
        start = time.time()
        # Gutendex is notoriously slow — give it a full 45s
        timeout = 45.0 if name == "gutendex" else 30.0
        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, auth=auth) as client:
                resp = await client.get(url)
                elapsed = time.time() - start
                result = {
                    "status": "ok" if resp.status_code < 400 else "http_error",
                    "http_status": resp.status_code,
                    "elapsed_s": round(elapsed, 2),
                    "url": url,
                    "auth_configured": auth is not None,
                }
                logger.info(
                    f"Connectivity: {name} status={resp.status_code} "
                    f"elapsed={elapsed:.2f}s auth={auth is not None}"
                )
                return name, result
        except httpx.ConnectError as e:
            elapsed = time.time() - start
            result = {
                "status": "connect_error",
                "error": str(e),
                "elapsed_s": round(elapsed, 2),
                "url": url,
            }
            logger.error(f"Connectivity FAILED: {name} connect_error={e} elapsed={elapsed:.2f}s")
            return name, result
        except httpx.TimeoutException:
            elapsed = time.time() - start
            result = {
                "status": "timeout",
                "elapsed_s": round(elapsed, 2),
                "url": url,
            }
            logger.error(f"Connectivity FAILED: {name} timeout elapsed={elapsed:.2f}s")
            return name, result
        except Exception as e:
            elapsed = time.time() - start
            result = {
                "status": "error",
                "error": str(e),
                "elapsed_s": round(elapsed, 2),
                "url": url,
            }
            logger.error(f"Connectivity FAILED: {name} error={e} elapsed={elapsed:.2f}s")
            return name, result

    # Run all checks in parallel
    results = await asyncio.gather(*[check_target(name, url, auth) for name, url, auth in targets])
    for name, result in results:
        checks[name] = result

    all_ok = all(c.get("status") == "ok" for c in checks.values())
    logger.info(f"Connectivity check complete: all_ok={all_ok}")

    return {
        "status": "ok" if all_ok else "degraded",
        "checks": checks,
    }
