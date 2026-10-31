from fastapi import APIRouter

from app.base_products import load_base_products
from app.schemas import Product

router = APIRouter(prefix="/api/products")


@router.get("/base")
def base_products() -> list[Product]:
    return load_base_products()
