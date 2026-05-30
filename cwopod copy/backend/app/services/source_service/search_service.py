"""Federated search service: queries all enabled providers in parallel."""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.source_service.base import ProviderUnavailableError, SearchResult
from app.services.source_service.registry import provider_registry

logger = logging.getLogger(__name__)


@dataclass
class ProviderStatus:
    provider_id: str
    provider_name: str
    status: str  # "ok", "timeout", "error"
    result_count: int = 0
    error_message: str | None = None


@dataclass
class FederatedSearchResponse:
    results: list[SearchResult] = field(default_factory=list)
    total_count: int = 0
    providers_queried: list[str] = field(default_factory=list)
    provider_details: list[ProviderStatus] = field(default_factory=list)
    providers_failed: list[ProviderStatus] = field(default_factory=list)


class SearchService:
    """Orchestrates federated search across all enabled providers."""

    async def search(
        self,
        query: str,
        timeout: float = 10.0,
        use_local_gutenberg: bool = False,
        db_session: Optional[AsyncSession] = None,
    ) -> FederatedSearchResponse:
        """Fan out search to all enabled providers in parallel.

        - Queries all providers concurrently with per-provider timeout
        - Collects results, noting any provider failures
        - Deduplicates by title+author similarity
        - Returns combined results (max 50)

        Args:
            query: Search string.
            timeout: Per-provider timeout (used as safety net).
            use_local_gutenberg: If True and db_session provided, use local
                                 DB cache for Gutenberg instead of live API.
            db_session: Async DB session (required if use_local_gutenberg=True).
        """
        logger.info(
            f"Federated search starting: query={query!r}, timeout={timeout}s, "
            f"use_local_gutenberg={use_local_gutenberg}"
        )

        providers = provider_registry.get_enabled_providers()
        logger.info(
            f"Enabled providers: {[p.provider_id for p in providers]} "
            f"({len(providers)} total)"
        )

        if not providers:
            logger.warning("No enabled providers found — returning empty results")
            return FederatedSearchResponse()

        # Fan out searches
        tasks = []
        for provider in providers:
            logger.debug(
                f"Dispatching search to provider={provider.provider_id} "
                f"({provider.display_name}), query={query!r}"
            )
            # Use local DB for Gutenberg if cache is available
            if use_local_gutenberg and provider.provider_id == "gutenberg" and db_session:
                tasks.append(self._search_gutenberg_local(db_session, query))
            else:
                tasks.append(self._search_provider(provider, query))

        start_time = time.time()
        results_per_provider = await asyncio.gather(*tasks, return_exceptions=True)
        elapsed = time.time() - start_time
        logger.info(f"All provider searches completed in {elapsed:.2f}s")

        all_results: list[SearchResult] = []
        providers_queried: list[str] = []
        provider_details: list[ProviderStatus] = []
        providers_failed: list[ProviderStatus] = []

        for provider, result in zip(providers, results_per_provider):
            providers_queried.append(provider.provider_id)

            if isinstance(result, ProviderUnavailableError):
                status = "timeout" if "timed out" in result.message else "error"
                logger.error(
                    f"Provider FAILED: provider={provider.provider_id}, "
                    f"status={status}, error={result.message}"
                )
                failed_status = ProviderStatus(
                    provider_id=provider.provider_id,
                    provider_name=provider.display_name,
                    status=status,
                    result_count=0,
                    error_message=result.message,
                )
                providers_failed.append(failed_status)
                provider_details.append(failed_status)
            elif isinstance(result, Exception):
                logger.error(
                    f"Provider FAILED: provider={provider.provider_id}, "
                    f"status=error, error={result}",
                    exc_info=result,
                )
                failed_status = ProviderStatus(
                    provider_id=provider.provider_id,
                    provider_name=provider.display_name,
                    status="error",
                    result_count=0,
                    error_message=str(result),
                )
                providers_failed.append(failed_status)
                provider_details.append(failed_status)
            else:
                logger.info(
                    f"Provider OK: provider={provider.provider_id}, "
                    f"results_returned={len(result)}"
                )
                provider_details.append(
                    ProviderStatus(
                        provider_id=provider.provider_id,
                        provider_name=provider.display_name,
                        status="ok",
                        result_count=len(result),
                    )
                )
                all_results.extend(result)

        logger.info(
            f"Raw results before dedup: {len(all_results)} from "
            f"{len(providers_queried)} providers"
        )

        # Deduplicate by title+author (case-insensitive)
        seen = set()
        deduplicated = []
        for r in all_results:
            key = (r.title.lower().strip(), r.author.lower().strip())
            if key not in seen:
                seen.add(key)
                deduplicated.append(r)

        logger.info(
            f"After dedup: {len(deduplicated)} results "
            f"(removed {len(all_results) - len(deduplicated)} duplicates)"
        )

        # Limit to 50
        deduplicated = deduplicated[:50]

        logger.info(
            f"Federated search complete: query={query!r}, "
            f"final_results={len(deduplicated)}, "
            f"providers_ok={len(providers_queried) - len(providers_failed)}, "
            f"providers_failed={len(providers_failed)}"
        )

        return FederatedSearchResponse(
            results=deduplicated,
            total_count=len(deduplicated),
            providers_queried=providers_queried,
            provider_details=provider_details,
            providers_failed=providers_failed,
        )

    async def _search_provider(self, provider, query: str) -> list[SearchResult]:
        """Search a single provider with generous timeout.

        Each provider handles its own retry logic internally. The wrapper timeout
        here is a safety net — set high enough to let providers exhaust their
        own retries (Gutenberg: 45s × 3 attempts + backoff = ~142s max).
        """
        wrapper_timeout = 150.0  # 2.5 minutes — let providers handle their own retries
        logger.debug(
            f"Searching provider={provider.provider_id}: query={query!r}, "
            f"wrapper_timeout={wrapper_timeout}s"
        )
        start_time = time.time()
        try:
            results = await asyncio.wait_for(
                provider.search(query), timeout=wrapper_timeout
            )
            elapsed = time.time() - start_time
            logger.info(
                f"Provider search done: provider={provider.provider_id}, "
                f"query={query!r}, results={len(results)}, elapsed={elapsed:.2f}s"
            )
            return results
        except asyncio.TimeoutError:
            elapsed = time.time() - start_time
            logger.error(
                f"Provider search TIMEOUT (wrapper): provider={provider.provider_id}, "
                f"query={query!r}, elapsed={elapsed:.2f}s"
            )
            raise ProviderUnavailableError(provider.provider_id, "Search timed out")

    async def _search_gutenberg_local(self, db_session: AsyncSession, query: str) -> list[SearchResult]:
        """Search Gutenberg using the local cached catalog (instant, fuzzy).

        Falls back to live API if local search fails for any reason.
        """
        from app.services.source_service.local_search import local_search_gutenberg

        logger.info(f"Searching Gutenberg LOCAL cache: query={query!r}")
        start_time = time.time()
        try:
            results = await local_search_gutenberg(db_session, query)
            elapsed = time.time() - start_time
            logger.info(
                f"Gutenberg LOCAL search done: query={query!r}, "
                f"results={len(results)}, elapsed={elapsed:.3f}s"
            )
            return results
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(
                f"Gutenberg LOCAL search FAILED (elapsed={elapsed:.3f}s): {e}",
                exc_info=e,
            )
            # Fall back to live API
            logger.info("Falling back to live Gutenberg API after local search failure")
            gutenberg_provider = provider_registry.get_provider("gutenberg")
            if gutenberg_provider:
                return await self._search_provider(gutenberg_provider, query)
            raise ProviderUnavailableError("gutenberg", f"Local search failed: {e}")
