"""Excel backup of the diary: build an .xlsx from ExportData and parse it back.

Parsing is deliberately tolerant: people edit the file by hand, so dates and
numbers may be text, meal names may have any case, IDs may be missing. A row
that cannot be understood is reported in `errors` and skipped; it never aborts
the whole import.
"""

import io
import math
import uuid
from datetime import date, datetime

from openpyxl import Workbook, load_workbook

from app.schemas import (
    Entry, ExportData, ImportError_, ImportResult, NormRecord, Product, Profile,
    WeightRecord,
)

FORMAT_VERSION = 1

SHEET_INFO = "Инфо"
SHEET_DIARY = "Дневник"
SHEET_PROFILE = "Профиль"
SHEET_NORMS = "История нормы"
SHEET_PRODUCTS = "Свои продукты"
SHEET_WEIGHT = "Вес"

DIARY_HEADERS = [
    "ID", "Дата", "Приём пищи", "Продукт", "Граммы", "Ккал/100г", "Белки/100г",
    "Жиры/100г", "Углеводы/100г", "Порция, г", "Источник", "ID продукта",
]
PROFILE_HEADERS = ["Параметр", "Значение"]
NORM_HEADERS = ["Действует с", "Ккал", "Белки", "Жиры", "Углеводы", "Ручная"]
PRODUCT_HEADERS = [
    "ID", "Название", "Ккал/100г", "Белки/100г", "Жиры/100г", "Углеводы/100г", "Порция, г",
]
WEIGHT_HEADERS = ["Дата", "Вес, кг"]

DATE_FORMAT = "DD.MM.YYYY"

# Internal value -> Russian label. Parsing uses the reversed maps.
MEALS = {"breakfast": "Завтрак", "lunch": "Обед", "snack": "Перекус", "dinner": "Ужин"}
SEX = {"male": "мужской", "female": "женский"}
ACTIVITY = {
    "sedentary": "сидячая", "light": "лёгкая", "moderate": "средняя",
    "high": "высокая", "extreme": "очень высокая",
}
GOAL = {"lose": "похудеть", "keep": "держать вес", "gain": "набрать"}
SOURCES = ("base", "off", "custom")


class UnsupportedFile(Exception):
    """The file is not a SiteFood workbook we can read at all (message is Russian)."""


class RowError(Exception):
    """A single row/cell problem; the message is shown to the user (Russian)."""


# ---------------------------------------------------------------- export ----

def _to_date(iso: str) -> date:
    return date.fromisoformat(iso)


def build_workbook(data: ExportData) -> bytes:
    wb = Workbook()

    info = wb.active
    info.title = SHEET_INFO
    info.append(["Версия формата", FORMAT_VERSION])

    diary = wb.create_sheet(SHEET_DIARY)
    diary.append(DIARY_HEADERS)
    for e in data.entries:
        p = e.product
        diary.append([
            e.id, _to_date(e.date), MEALS[e.meal], p.name, e.grams, p.kcal, p.protein,
            p.fat, p.carbs, p.portionG, p.source, p.id,
        ])

    profile = wb.create_sheet(SHEET_PROFILE)
    if data.profile is not None:
        pr = data.profile
        profile.append(PROFILE_HEADERS)
        for row in [
            ["Пол", SEX[pr.sex]],
            ["Возраст", pr.age],
            ["Рост", pr.heightCm],
            ["Вес", pr.weightKg],
            ["Активность", ACTIVITY[pr.activity]],
            ["Цель", GOAL[pr.goal]],
            ["Отслеживать вес", "да" if pr.trackWeight else "нет"],
            ["Обновлено", pr.updatedAt],  # kept as ISO text for an exact roundtrip
        ]:
            profile.append(row)

    norms = wb.create_sheet(SHEET_NORMS)
    norms.append(NORM_HEADERS)
    for n in data.normHistory:
        norms.append([_to_date(n.effectiveFrom), n.kcal, n.protein, n.fat, n.carbs,
                      "да" if n.manual else "нет"])

    products = wb.create_sheet(SHEET_PRODUCTS)
    products.append(PRODUCT_HEADERS)
    for p in data.customProducts:
        products.append([p.id, p.name, p.kcal, p.protein, p.fat, p.carbs, p.portionG])

    weight = wb.create_sheet(SHEET_WEIGHT)
    weight.append(WEIGHT_HEADERS)
    for w in data.weights:
        weight.append([_to_date(w.date), w.weightKg])

    # Show dates as DD.MM.YYYY (they stay real Excel dates underneath).
    for ws, col in [(diary, "B"), (norms, "A"), (weight, "A")]:
        for cell in ws[col][1:]:
            cell.number_format = DATE_FORMAT

    for ws in wb.worksheets:
        for col in ws.columns:
            width = max(len(str(c.value)) if c.value is not None else 0 for c in col)
            ws.column_dimensions[col[0].column_letter].width = min(max(width + 2, 10), 40)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ----------------------------------------------------------- cell parsing ----

def _is_blank(v) -> bool:
    return v is None or (isinstance(v, str) and not v.strip())


def _parse_date(v) -> str:
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, str):
        s = v.strip()
        for fmt in ("%d.%m.%Y", "%Y-%m-%d"):
            try:
                return datetime.strptime(s[:10], fmt).date().isoformat()
            except ValueError:
                pass
    raise RowError("не удалось разобрать дату (ожидается ДД.ММ.ГГГГ)")


def _parse_number(v, what: str, *, positive: bool = False) -> float:
    if isinstance(v, bool):
        raise RowError(f"«{what}» должно быть числом")
    if isinstance(v, (int, float)):
        n = float(v)
    elif isinstance(v, str):
        try:
            n = float(v.strip().replace(",", ".").replace(" ", "").replace(" ", ""))
        except ValueError:
            raise RowError(f"«{what}» должно быть числом") from None
    else:
        raise RowError(f"«{what}» должно быть числом")
    if not math.isfinite(n) or n < 0 or (positive and n == 0):
        raise RowError(f"«{what}» должно быть положительным числом" if positive
                       else f"«{what}» не может быть отрицательным")
    return n


def _parse_optional_number(v, what: str) -> float | None:
    return None if _is_blank(v) else _parse_number(v, what)


def _parse_bool(v, what: str) -> bool:
    if isinstance(v, bool):
        return v
    s = str(v).strip().lower() if v is not None else ""
    if s in ("да", "yes", "true", "1"):
        return True
    if s in ("нет", "no", "false", "0"):
        return False
    raise RowError(f"«{what}» должно быть «да» или «нет»")


def _parse_choice(v, labels: dict[str, str], what: str) -> str:
    """Accept the Russian label (any case) or the raw internal key."""
    s = str(v).strip().lower() if v is not None else ""
    for key, label in labels.items():
        if s in (label.lower(), key):
            return key
    raise RowError(f"неизвестное значение «{v}» в поле «{what}»")


def _text(v, what: str) -> str:
    if _is_blank(v):
        raise RowError(f"не заполнено «{what}»")
    return str(v).strip()


def _cells(row, n: int) -> list:
    """First n cells of a row, padded with None for short rows."""
    values = list(row[:n])
    return values + [None] * (n - len(values))


def _data_rows(wb, sheet: str):
    """Yield (excel_row_number, cells) for non-empty rows below the header."""
    if sheet not in wb.sheetnames:
        return
    for i, row in enumerate(wb[sheet].iter_rows(min_row=2, values_only=True), start=2):
        if all(_is_blank(c) for c in row):
            continue
        yield i, row


def _collect(wb, sheet: str, n_cols: int, parse_row, errors: list[ImportError_]) -> list:
    out = []
    for i, row in _data_rows(wb, sheet):
        try:
            out.append(parse_row(_cells(row, n_cols)))
        except RowError as e:
            errors.append(ImportError_(sheet=sheet, row=i, message=str(e)))
    return out


# ------------------------------------------------------------ row parsers ----

def _product_fields(name, kcal, protein, fat, carbs, portion) -> dict:
    return dict(
        name=_text(name, "Название"),
        kcal=_parse_number(kcal, "Ккал/100г"),
        protein=_parse_number(protein, "Белки/100г"),
        fat=_parse_number(fat, "Жиры/100г"),
        carbs=_parse_number(carbs, "Углеводы/100г"),
        portionG=_parse_optional_number(portion, "Порция, г"),
    )


def _parse_entry(c: list) -> Entry:
    id_, day, meal, name, grams, kcal, protein, fat, carbs, portion, source, product_id = c
    src = "custom" if _is_blank(source) else str(source).strip().lower()
    if src not in SOURCES:
        raise RowError(f"неизвестный источник «{source}» (base, off или custom)")
    product = Product(
        id=str(product_id).strip() if not _is_blank(product_id) else uuid.uuid4().hex,
        source=src,
        **_product_fields(name, kcal, protein, fat, carbs, portion),
    )
    return Entry(
        id=str(id_).strip() if not _is_blank(id_) else uuid.uuid4().hex,
        date=_parse_date(day),
        meal=_parse_choice(meal, MEALS, "Приём пищи"),
        product=product,
        grams=_parse_number(grams, "Граммы", positive=True),
    )


def _parse_norm(c: list) -> NormRecord:
    day, kcal, protein, fat, carbs, manual = c
    return NormRecord(
        effectiveFrom=_parse_date(day),
        kcal=_parse_number(kcal, "Ккал"),
        protein=_parse_number(protein, "Белки"),
        fat=_parse_number(fat, "Жиры"),
        carbs=_parse_number(carbs, "Углеводы"),
        manual=_parse_bool(manual, "Ручная"),
    )


def _parse_custom_product(c: list) -> Product:
    id_, name, kcal, protein, fat, carbs, portion = c
    return Product(
        id=str(id_).strip() if not _is_blank(id_) else uuid.uuid4().hex,
        source="custom",
        **_product_fields(name, kcal, protein, fat, carbs, portion),
    )


def _parse_weight(c: list) -> WeightRecord:
    day, kg = c
    return WeightRecord(date=_parse_date(day), weightKg=_parse_number(kg, "Вес, кг", positive=True))


def _parse_profile(wb, errors: list[ImportError_]) -> Profile | None:
    rows = {}  # parameter name (lowercase) -> (excel row, value)
    for i, row in _data_rows(wb, SHEET_PROFILE):
        c = _cells(row, 2)
        if not _is_blank(c[0]):
            rows[str(c[0]).strip().lower()] = (i, c[1])
    if not rows:
        return None

    def get(name: str):
        if name.lower() not in rows:
            raise RowError(f"в профиле нет строки «{name}»")
        return rows[name.lower()]

    def field(name, parse):
        row_no, value = get(name)
        try:
            return parse(value)
        except RowError as e:
            raise RowError(f"{name}: {e}") from None

    try:
        updated_row, updated = get("Обновлено")
        return Profile(
            sex=field("Пол", lambda v: _parse_choice(v, SEX, "Пол")),
            age=field("Возраст", lambda v: int(_parse_number(v, "Возраст", positive=True))),
            heightCm=field("Рост", lambda v: _parse_number(v, "Рост", positive=True)),
            weightKg=field("Вес", lambda v: _parse_number(v, "Вес", positive=True)),
            activity=field("Активность", lambda v: _parse_choice(v, ACTIVITY, "Активность")),
            goal=field("Цель", lambda v: _parse_choice(v, GOAL, "Цель")),
            trackWeight=field("Отслеживать вес", lambda v: _parse_bool(v, "Отслеживать вес")),
            # A hand-edited file may hold a real date; keep ISO text either way.
            updatedAt=updated.isoformat() if isinstance(updated, (date, datetime))
            else _text(updated, "Обновлено"),
        )
    except RowError as e:
        errors.append(ImportError_(sheet=SHEET_PROFILE, row=2, message=f"Профиль не импортирован. {e}"))
        return None


# ----------------------------------------------------------------- import ----

def _check_version(wb) -> None:
    if SHEET_INFO not in wb.sheetnames:
        raise UnsupportedFile("Это не файл SiteFood: нет листа «Инфо».")
    raw = wb[SHEET_INFO]["B1"].value
    try:
        version = int(float(str(raw).replace(",", ".")))
    except (TypeError, ValueError):
        raise UnsupportedFile("Не удалось определить версию формата файла.") from None
    if version > FORMAT_VERSION:
        raise UnsupportedFile(
            f"Файл создан более новой версией SiteFood (формат {version}). Обновите приложение."
        )


def parse_workbook(content: bytes) -> ImportResult:
    try:
        wb = load_workbook(io.BytesIO(content), data_only=True)
    except Exception:  # openpyxl raises many different errors for bad input
        raise UnsupportedFile("Не удалось прочитать файл. Нужен файл .xlsx, созданный SiteFood.") from None

    _check_version(wb)

    errors: list[ImportError_] = []
    data = ExportData(
        formatVersion=1,
        profile=_parse_profile(wb, errors),
        normHistory=_collect(wb, SHEET_NORMS, 6, _parse_norm, errors),
        entries=_collect(wb, SHEET_DIARY, 12, _parse_entry, errors),
        customProducts=_collect(wb, SHEET_PRODUCTS, 7, _parse_custom_product, errors),
        weights=_collect(wb, SHEET_WEIGHT, 2, _parse_weight, errors),
    )
    return ImportResult(data=data, errors=errors)
