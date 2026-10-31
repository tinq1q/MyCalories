from fastapi.testclient import TestClient

from app.main import create_app


def test_health(client):
    assert client.get("/api/health").json() == {"ok": True}


def _preflight(client: TestClient, origin: str):
    return client.options(
        "/api/health",
        headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
    )


def test_cors_allows_configured_origin(monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://x.github.io")
    client = TestClient(create_app())
    allowed = _preflight(client, "https://x.github.io")
    assert allowed.headers["access-control-allow-origin"] == "https://x.github.io"
    other = _preflight(client, "https://evil.example")
    assert "access-control-allow-origin" not in other.headers


def test_cors_default_is_localhost_dev_server(monkeypatch):
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    client = TestClient(create_app())
    res = _preflight(client, "http://localhost:5173")
    assert res.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_accepts_comma_separated_list(monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://a.io, https://b.io")
    client = TestClient(create_app())
    res = _preflight(client, "https://b.io")
    assert res.headers["access-control-allow-origin"] == "https://b.io"
