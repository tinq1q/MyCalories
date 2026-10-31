from typing import Literal

from pydantic import BaseModel


class Product(BaseModel):
    """A food product. All nutrition values are per 100 g.

    Field names are camelCase on purpose: the JSON must match the frontend
    types one to one, so no alias mapping is needed.
    """

    id: str
    name: str
    kcal: float
    protein: float
    fat: float
    carbs: float
    portionG: float | None = None  # typical serving size in grams
    source: Literal["base", "off", "custom"]
