import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import products

DEFAULT_ORIGINS = "http://localhost:5173"


def create_app() -> FastAPI:
    """App factory. ALLOWED_ORIGINS is read here (not at import time) so tests can change it."""
    application = FastAPI(title="SiteFood API")

    raw = os.environ.get("ALLOWED_ORIGINS", DEFAULT_ORIGINS)
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.get("/api/health")
    def health() -> dict[str, bool]:
        return {"ok": True}

    application.include_router(products.router)
    return application


app = create_app()
