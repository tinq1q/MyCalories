import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.off_client import (
    DEFAULT_USER_AGENT,
    OffClient,
    OffUnavailable,
    get_off_client,
    normalize_off_product,
)
from app.schemas import Product

GOOD = {
    "code": "123",
    "product_name": "Buckwheat",
    "product_name_ru": "Гречка",
    "nutriments": {
        "energy-kcal_100g": 313,
        "proteins_100g": 12.6,
        "fat_100g": 3.3,
        "carbohydrates_100g": 62.1,
    },
    "serving_quantity": "50",
}


def with_(**changes):
    return {**GOOD, **changes}


def test_normalize_prefers_russian_name():
    assert normalize_off_product(GOOD) == Product(
        id="off-123", name="Гречка", kcal=313, protein=12.6,
        fat=3.3, carbs=62.1, portionG=50, source="off",
    )


def test_normalize_falls_back_to_default_name():
    p = normalize_off_product(with_(product_name_ru=""))
    assert p is not None and p.name == "Buckwheat"


@pytest.mark.parametrize(
    "raw",
    [
        with_(nutriments={"proteins_100g": 1}),  # no kcal
        with_(product_name="", product_name_ru=""),  # no name
        with_(nutriments={"energy-kcal_100g": "n/a"}),  # garbage kcal
        with_(code=""),  # no id
    ],
)
def test_normalize_rejects_incomplete(raw):
    assert normalize_off_product(raw) is None


def test_normalize_missing_macros_become_zero():
    p = normalize_off_product(with_(nutriments={"energy-kcal_100g": 100}))
    assert p is not None
    assert (p.protein, p.fat, p.carbs) == (0.0, 0.0, 0.0)


@pytest.mark.parametrize("serving", ["abc", "0", 0, None, "-5"])
def test_normalize_bad_serving_is_none(serving):
    p = normalize_off_product(with_(serving_quantity=serving))
    assert p is not None and p.portionG is None


def make_client(handler, **kwargs) -> OffClient:
    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return OffClient(http, **kwargs)


def ok_handler(calls: list):
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200, json={"products": [GOOD, {"code": "9"}]})
    return handler


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_cache_hits_once():
    calls = []
    client = make_client(ok_handler(calls))
    first = await client.search("Греч ")
    second = await client.search("греч")
    assert len(calls) == 1
    assert first == second and len(first) == 1  # incomplete product dropped


@pytest.mark.anyio
async def test_cache_key_folds_yo():
    calls = []
    client = make_client(ok_handler(calls))
    await client.search("мёд")
    await client.search("мед")
    assert len(calls) == 1


@pytest.mark.anyio
async def test_cache_expires_after_ttl():
    calls = []
    client = make_client(ok_handler(calls), ttl_seconds=0)
    await client.search("греч")
    await client.search("греч")
    assert len(calls) == 2


@pytest.mark.anyio
async def test_cache_evicts_oldest():
    calls = []
    client = make_client(ok_handler(calls), max_entries=2)
    for q in ("aa", "bb", "cc"):
        await client.search(q)
    await client.search("bb")  # still cached
    assert len(calls) == 3
    await client.search("aa")  # evicted
    assert len(calls) == 4


@pytest.mark.anyio
async def test_sends_user_agent(monkeypatch):
    monkeypatch.delenv("OFF_USER_AGENT", raising=False)
    calls = []
    http = httpx.AsyncClient(transport=httpx.MockTransport(ok_handler(calls)))
    await OffClient(http).search("греч")
    assert DEFAULT_USER_AGENT == "SiteFood/0.1 (personal food diary project)"
    assert calls[0].headers["user-agent"] == DEFAULT_USER_AGENT

    monkeypatch.setenv("OFF_USER_AGENT", "Custom/1.0")
    await OffClient(http).search("другое")
    assert calls[1].headers["user-agent"] == "Custom/1.0"


@pytest.mark.anyio
async def test_429_raises_unavailable_and_not_cached():
    statuses = [429, 200]
    calls = []

    def handler(request):
        calls.append(request)
        status = statuses[len(calls) - 1]
        return httpx.Response(status, json={"products": [GOOD]})

    client = make_client(handler)
    with pytest.raises(OffUnavailable):
        await client.search("греч")
    assert len(await client.search("греч")) == 1  # retried, not served from cache
    assert len(calls) == 2


@pytest.mark.anyio
async def test_5xx_and_timeout_raise_unavailable():
    def boom(request):
        return httpx.Response(503)

    def slow(request):
        raise httpx.ReadTimeout("slow")

    for handler in (boom, slow):
        with pytest.raises(OffUnavailable):
            await make_client(handler).search("греч")


class FakeOff:
    def __init__(self, error=False):
        self.calls = 0
        self.error = error

    async def search(self, query):
        self.calls += 1
        if self.error:
            raise OffUnavailable()
        return [normalize_off_product(GOOD)]


def endpoint_client(fake) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_off_client] = lambda: fake
    return TestClient(app)


def test_endpoint_returns_products():
    fake = FakeOff()
    res = endpoint_client(fake).get("/api/products/off-search", params={"q": "греч"})
    assert res.status_code == 200
    assert res.json()[0]["id"] == "off-123"


def test_endpoint_short_query_no_call():
    fake = FakeOff()
    c = endpoint_client(fake)
    assert c.get("/api/products/off-search", params={"q": "г"}).json() == []
    assert c.get("/api/products/off-search", params={"q": " г "}).json() == []
    assert c.get("/api/products/off-search").json() == []
    assert fake.calls == 0


def test_endpoint_503():
    res = endpoint_client(FakeOff(error=True)).get(
        "/api/products/off-search", params={"q": "греч"}
    )
    assert res.status_code == 503
    assert res.json() == {"detail": "off_unavailable"}


# ---- fix round 1: non-finite / negative numbers, malformed bodies ----


@pytest.mark.parametrize("bad", ["nan", "inf", "-inf", float("nan"), float("inf"), -5, "-1"])
def test_normalize_rejects_non_finite_or_negative_kcal(bad):
    assert normalize_off_product(with_(nutriments={"energy-kcal_100g": bad})) is None


@pytest.mark.parametrize("bad", ["nan", "inf", float("nan"), -3, "-0.5"])
def test_normalize_bad_macro_becomes_zero(bad):
    # Chosen policy: a bad macro is treated as missing (0.0); the product stays.
    nutriments = {
        "energy-kcal_100g": 100,
        "proteins_100g": bad,
        "fat_100g": bad,
        "carbohydrates_100g": bad,
    }
    p = normalize_off_product(with_(nutriments=nutriments))
    assert p is not None
    assert (p.protein, p.fat, p.carbs) == (0.0, 0.0, 0.0)


@pytest.mark.parametrize("body", [{"products": None}, {"products": "x"}, {"products": {}}, [1, 2]])
@pytest.mark.anyio
async def test_malformed_body_raises_unavailable(body):
    client = make_client(lambda request: httpx.Response(200, json=body))
    with pytest.raises(OffUnavailable):
        await client.search("греч")


@pytest.mark.anyio
async def test_invalid_json_raises_unavailable():
    client = make_client(lambda request: httpx.Response(200, content=b"<html>oops"))
    with pytest.raises(OffUnavailable):
        await client.search("греч")


def test_endpoint_503_on_malformed_body():
    http = httpx.AsyncClient(
        transport=httpx.MockTransport(lambda r: httpx.Response(200, json={"products": None}))
    )
    app = create_app()
    app.dependency_overrides[get_off_client] = lambda: OffClient(http)
    res = TestClient(app).get("/api/products/off-search", params={"q": "греч"})
    assert res.status_code == 503
    assert res.json() == {"detail": "off_unavailable"}
