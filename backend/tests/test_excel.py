import io

import pytest
from openpyxl import Workbook, load_workbook

from app.excel import UnsupportedFile, build_workbook, parse_workbook
from app.schemas import (
    Entry, ExportData, ImportResult, NormRecord, Product, Profile, WeightRecord,
)

DIARY_HEADERS = [
    "ID", "Дата", "Приём пищи", "Продукт", "Граммы", "Ккал/100г", "Белки/100г",
    "Жиры/100г", "Углеводы/100г", "Порция, г", "Источник", "ID продукта",
]


def make_product(pid="p1", source="base", portion=None):
    return Product(id=pid, name="Гречка", kcal=343, protein=13.2, fat=3.4,
                   carbs=71.5, portionG=portion, source=source)


def empty_export():
    return ExportData(formatVersion=1, profile=None, normHistory=[], entries=[],
                      customProducts=[], weights=[])


@pytest.fixture
def sample_export():
    custom = make_product("c1", "custom", 150)
    return ExportData(
        formatVersion=1,
        profile=Profile(sex="female", age=30, heightCm=165.5, weightKg=60.2,
                        activity="extreme", goal="keep", trackWeight=True,
                        updatedAt="2026-10-31T12:34:56.789Z"),
        normHistory=[
            NormRecord(effectiveFrom="2026-10-01", kcal=2000, protein=100.5,
                       fat=70, carbs=250, manual=False),
            NormRecord(effectiveFrom="2026-10-20", kcal=1800, protein=90,
                       fat=60, carbs=200.4, manual=True),
        ],
        entries=[
            Entry(id="e1", date="2026-10-31", meal="breakfast", product=make_product(), grams=4.2),
            Entry(id="e2", date="2026-10-31", meal="dinner", product=custom, grams=250),
        ],
        customProducts=[custom],
        weights=[WeightRecord(date="2026-10-30", weightKg=60.4)],
    )


def book_bytes(wb):
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def edited_book(rows):
    """Valid empty export with extra hand-written rows appended to the diary."""
    wb = load_workbook(io.BytesIO(build_workbook(empty_export())))
    for r in rows:
        wb["Дневник"].append(r)
    return book_bytes(wb)


def test_roundtrip(sample_export):
    assert parse_workbook(build_workbook(sample_export)) == ImportResult(data=sample_export, errors=[])


def test_roundtrip_empty():
    empty = empty_export()
    assert parse_workbook(build_workbook(empty)) == ImportResult(data=empty, errors=[])


def test_headers_exact(sample_export):
    wb = load_workbook(io.BytesIO(build_workbook(sample_export)))
    assert [c.value for c in wb["Дневник"][1]] == DIARY_HEADERS
    assert wb["Инфо"]["A1"].value == "Версия формата"
    assert wb["Инфо"]["B1"].value == 1
    assert [c.value for c in wb["Вес"][1]] == ["Дата", "Вес, кг"]
    assert [c.value for c in wb["Свои продукты"][1]] == [
        "ID", "Название", "Ккал/100г", "Белки/100г", "Жиры/100г", "Углеводы/100г", "Порция, г"]
    assert [c.value for c in wb["История нормы"][1]] == [
        "Действует с", "Ккал", "Белки", "Жиры", "Углеводы", "Ручная"]
    assert [c.value for c in wb["Профиль"][1]] == ["Параметр", "Значение"]


def test_diary_date_is_real_excel_date(sample_export):
    ws = load_workbook(io.BytesIO(build_workbook(sample_export)))["Дневник"]
    assert hasattr(ws["B2"].value, "year")
    assert ws["C2"].value == "Завтрак"


def test_tolerates_hand_edits():
    row = ["", "31.10.2026", "обед", "Хлеб", "12,5", 250, 8, 3, 50, None, "custom", "p9"]
    r = parse_workbook(edited_book([row]))
    e = r.data.entries[0]
    assert (e.date, e.grams, e.meal) == ("2026-10-31", 12.5, "lunch")
    assert len(e.id) > 0 and r.errors == []


def test_bad_rows_reported_not_fatal():
    good = ["a", "2026-10-31", "Завтрак", "X", 10, 1, 1, 1, 1, None, "base", "p"]
    bad_meal = ["b", "2026-10-31", "полдник", "X", 10, 1, 1, 1, 1, None, "base", "p"]
    bad_grams = ["c", "2026-10-31", "Обед", "X", "много", 1, 1, 1, 1, None, "base", "p"]
    blank = [None] * 12
    r = parse_workbook(edited_book([good, bad_meal, bad_grams, blank, good]))
    assert [(e.sheet, e.row) for e in r.errors] == [("Дневник", 3), ("Дневник", 4)]
    assert all(e.message for e in r.errors)
    assert len(r.data.entries) == 2


def test_missing_info_sheet():
    wb = Workbook()
    wb.active.title = "Дневник"
    with pytest.raises(UnsupportedFile):
        parse_workbook(book_bytes(wb))


def test_future_version():
    wb = load_workbook(io.BytesIO(build_workbook(empty_export())))
    wb["Инфо"]["B1"] = 2
    with pytest.raises(UnsupportedFile):
        parse_workbook(book_bytes(wb))


def test_not_xlsx_raises():
    with pytest.raises(UnsupportedFile):
        parse_workbook(b"garbage bytes")


def test_not_xlsx_returns_400(client):
    r = client.post("/api/diary/import", files={"file": ("x.xlsx", b"garbage")})
    assert r.status_code == 400 and r.json()["detail"]


def test_import_endpoint_roundtrip(client, sample_export):
    r = client.post("/api/diary/import", files={"file": ("x.xlsx", build_workbook(sample_export))})
    assert r.status_code == 200
    assert ImportResult.model_validate(r.json()) == ImportResult(data=sample_export, errors=[])


def test_import_too_large(client):
    r = client.post("/api/diary/import", files={"file": ("x.xlsx", b"0" * (5 * 1024 * 1024 + 1))})
    assert r.status_code == 400


def test_export_endpoint_filename(client, sample_export):
    r = client.post("/api/diary/export", json=sample_export.model_dump())
    assert r.status_code == 200
    assert "spreadsheetml.sheet" in r.headers["content-type"]
    assert "filename*=UTF-8''" in r.headers["content-disposition"]
    assert load_workbook(io.BytesIO(r.content))["Инфо"]["B1"].value == 1
