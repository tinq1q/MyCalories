from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.base_products import load_base_products
from app.off_client import OffClient, OffUnavailable, get_off_client
from app.schemas import Product

router = APIRouter(prefix="/api/products")

MIN_QUERY_LENGTH = 2


@router.get("/base")
def base_products() -> list[Product]:
    return load_base_products()


@router.get("/off-search")
async def off_search(q: str = "", off: OffClient = Depends(get_off_client)):
    query = q.strip()
    if len(query) < MIN_QUERY_LENGTH:
        return []  # too short: don't bother Open Food Facts
    try:
        return await off.search(query)
    except OffUnavailable:
        return JSONResponse(status_code=503, content={"detail": "off_unavailable"})
