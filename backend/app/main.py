import os
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.off_client import OffClient
from app.routes import diary_file, products

DEFAULT_ORIGINS = "http://localhost:5173"


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Create one shared HTTP client (and OFF cache) at startup, close it at shutdown."""
    async with httpx.AsyncClient() as http:
        application.state.off_client = OffClient(http)
        yield


def create_app() -> FastAPI:
    """App factory. ALLOWED_ORIGINS is read here (not at import time) so tests can change it."""
    application = FastAPI(title="SiteFood API", lifespan=lifespan)

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
    application.include_router(diary_file.router)
    return application


app = create_app()
