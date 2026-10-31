import json
from functools import cache
from pathlib import Path

from app.schemas import Product

_DATA_FILE = Path(__file__).parent / "base_products.json"


@cache  # the file never changes while the server runs, so read it only once
def load_base_products() -> list[Product]:
    raw = json.loads(_DATA_FILE.read_text(encoding="utf-8"))
    return [Product(**item, source="base") for item in raw]
