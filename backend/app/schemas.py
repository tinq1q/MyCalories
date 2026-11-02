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


Meal = Literal["breakfast", "lunch", "snack", "dinner"]


class Entry(BaseModel):
    """One diary row: a product eaten in some amount on some day."""

    id: str
    date: str  # local day, YYYY-MM-DD
    meal: Meal
    product: Product
    grams: float


class Profile(BaseModel):
    sex: Literal["male", "female"]
    age: int
    heightCm: float
    weightKg: float
    activity: Literal["sedentary", "light", "moderate", "high", "extreme"]
    goal: Literal["lose", "keep", "gain"]
    trackWeight: bool
    updatedAt: str  # ISO timestamp
    targetWeightKg: float | None = None


class NormRecord(BaseModel):
    effectiveFrom: str  # YYYY-MM-DD
    kcal: float
    protein: float
    fat: float
    carbs: float
    manual: bool


class WeightRecord(BaseModel):
    date: str
    weightKg: float


class ExportData(BaseModel):
    formatVersion: Literal[1]
    profile: Profile | None
    normHistory: list[NormRecord]
    entries: list[Entry]
    customProducts: list[Product]
    weights: list[WeightRecord]
    theme: Literal["citrus", "sunset", "ocean", "night"] | None = None


class ImportError_(BaseModel):
    """A row that could not be imported (trailing underscore avoids the builtin name)."""

    sheet: str
    row: int  # 1-based Excel row number
    message: str  # Russian, shown to the user


class ImportResult(BaseModel):
    data: ExportData
    errors: list[ImportError_]
