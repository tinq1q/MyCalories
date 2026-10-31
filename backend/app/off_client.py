import math
import os
import time

import httpx
from fastapi import Request

from app.schemas import Product

OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl"
DEFAULT_USER_AGENT = "SiteFood/0.1 (personal food diary project)"
OFF_TIMEOUT_SECONDS = 8.0
PAGE_SIZE = 20


class OffUnavailable(Exception):
    """Open Food Facts timed out, returned 5xx/429, or sent unusable data."""


def _to_float(value) -> float | None:
    """Convert OFF values (numbers or numeric strings) to float, or None if impossible."""
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    # float() happily accepts "nan" and "inf"; JSON cannot represent them.
    return number if math.isfinite(number) else None


def _macro(value) -> float:
    """A nutrient amount: missing, non-finite or negative values count as 0."""
    number = _to_float(value)
    return number if number is not None and number >= 0 else 0.0


def normalize_off_product(raw: dict) -> Product | None:
    """Turn one raw OFF product into our Product, or None if it is unusable.

    A product needs a code, a name and kcal per 100 g. Missing protein/fat/carbs
    are treated as 0 so such products are still searchable.
    """
    code = str(raw.get("code") or "").strip()
    name = str(raw.get("product_name_ru") or raw.get("product_name") or "").strip()
    nutriments = raw.get("nutriments") or {}
    kcal = _to_float(nutriments.get("energy-kcal_100g"))
    if not code or not name or kcal is None or kcal < 0:
        return None

    serving = _to_float(raw.get("serving_quantity"))
    return Product(
        id=f"off-{code}",
        name=name,
        kcal=kcal,
        protein=_macro(nutriments.get("proteins_100g")),
        fat=_macro(nutriments.get("fat_100g")),
        carbs=_macro(nutriments.get("carbohydrates_100g")),
        portionG=serving if serving is not None and serving > 0 else None,
        source="off",
    )


def _cache_key(query: str) -> str:
    return query.strip().lower().replace("ё", "е")


class OffClient:
    """Searches Open Food Facts with a small in-memory TTL cache."""

    def __init__(self, http: httpx.AsyncClient, ttl_seconds: int = 86400, max_entries: int = 500):
        self._http = http
        self._ttl = ttl_seconds
        self._max_entries = max_entries
        # key -> (time inserted, results). dicts keep insertion order, so the
        # first key is always the oldest entry.
        self._cache: dict[str, tuple[float, list[Product]]] = {}

    async def search(self, query: str) -> list[Product]:
        key = _cache_key(query)
        cached = self._cache.get(key)
        if cached is not None:
            if time.monotonic() - cached[0] < self._ttl:
                return cached[1]
            del self._cache[key]

        results = await self._fetch(query.strip())

        # Only successful responses reach this point, so errors are never cached.
        if len(self._cache) >= self._max_entries:
            del self._cache[next(iter(self._cache))]
        self._cache[key] = (time.monotonic(), results)
        return results

    async def _fetch(self, query: str) -> list[Product]:
        params = {
            "search_terms": query,
            "search_simple": 1,
            "json": 1,
            "page_size": PAGE_SIZE,
            "fields": "code,product_name,product_name_ru,nutriments,serving_quantity",
        }
        # Read at call time so the value can be changed without recreating the client.
        headers = {"User-Agent": os.environ.get("OFF_USER_AGENT") or DEFAULT_USER_AGENT}
        try:
            response = await self._http.get(
                OFF_SEARCH_URL, params=params, headers=headers, timeout=OFF_TIMEOUT_SECONDS
            )
        except httpx.HTTPError as exc:  # timeouts, connection errors
            raise OffUnavailable() from exc
        if response.status_code == 429 or response.status_code >= 500:
            raise OffUnavailable()
        try:
            response.raise_for_status()
            body = response.json()
        except (httpx.HTTPError, ValueError) as exc:  # bad status or invalid JSON
            raise OffUnavailable() from exc
        items = body.get("products") if isinstance(body, dict) else None
        if not isinstance(items, list):
            raise OffUnavailable()

        products = (normalize_off_product(item) for item in items if isinstance(item, dict))
        return [p for p in products if p is not None][:PAGE_SIZE]


def get_off_client(request: Request) -> OffClient:
    """FastAPI dependency. The real client is created in the app lifespan;
    tests replace this function via app.dependency_overrides."""
    return request.app.state.off_client
