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


# ------------------------------------------------------- fix round 1 tests ----

import datetime as dt


def patched(data, fn):
    """Build a workbook from `data`, let fn(wb) modify it, return bytes."""
    wb = load_workbook(io.BytesIO(build_workbook(data)))
    fn(wb)
    return book_bytes(wb)


def errs(result):
    return [(e.sheet, e.row) for e in result.errors]


def test_profile_error_has_real_row(sample_export):
    def edit(wb):
        assert wb["Профиль"]["A7"].value == "Цель"
        wb["Профиль"]["B7"] = "куда-нибудь"
    r = parse_workbook(patched(sample_export, edit))
    assert r.data.profile is None
    assert errs(r) == [("Профиль", 7)]
    assert "Цель" in r.errors[0].message


def test_profile_bad_number_row(sample_export):
    def edit(wb):
        wb["Профиль"]["B4"] = "рост"
    assert errs(parse_workbook(patched(sample_export, edit))) == [("Профиль", 4)]


def test_formula_like_text_roundtrips():
    p = Product(id="=p", name="=1+1", kcal=1, protein=1, fat=1, carbs=1, source="custom")
    data = empty_export().model_copy(update={
        "entries": [Entry(id="=e", date="2026-10-31", meal="lunch", product=p, grams=5)],
        "customProducts": [p],
    })
    assert parse_workbook(build_workbook(data)) == ImportResult(data=data, errors=[])
    ws = load_workbook(io.BytesIO(build_workbook(data)))["Дневник"]
    assert ws["D2"].data_type != "f"


def test_info_only_file_reports_missing_sheets():
    def edit(wb):
        for name in wb.sheetnames:
            if name != "Инфо":
                del wb[name]
    r = parse_workbook(patched(empty_export(), edit))
    assert sorted(e.sheet for e in r.errors) == sorted(
        ["Дневник", "Профиль", "История нормы", "Свои продукты", "Вес"])


def test_missing_non_info_sheet(sample_export):
    def edit(wb):
        del wb["Вес"]
    r = parse_workbook(patched(sample_export, edit))
    assert errs(r) == [("Вес", 1)]
    assert r.data.weights == [] and len(r.data.entries) == 2


def test_header_mismatch_skips_sheet(sample_export):
    def edit(wb):
        wb["Вес"]["A1"] = "Something"
    r = parse_workbook(patched(sample_export, edit))
    assert errs(r) == [("Вес", 1)]
    assert r.data.weights == []


def test_header_mismatch_in_diary(sample_export):
    def edit(wb):
        wb["Дневник"]["C1"] = "Meal"
    r = parse_workbook(patched(sample_export, edit))
    assert errs(r) == [("Дневник", 1)] and r.data.entries == []


@pytest.mark.parametrize("raw", ["abc", "inf", float("inf"), 0, -1, 1.9, "1.9", "", None, True])
def test_bad_version_unsupported(raw):
    def edit(wb):
        wb["Инфо"]["B1"] = raw
    with pytest.raises(UnsupportedFile):
        parse_workbook(patched(empty_export(), edit))


@pytest.mark.parametrize("raw", [1, 1.0, "1", " 1 "])
def test_good_version(raw):
    def edit(wb):
        wb["Инфо"]["B1"] = raw
    assert parse_workbook(patched(empty_export(), edit)).errors == []


def test_norm_errors_and_good_row():
    def edit(wb):
        wb["История нормы"].append(["31.10.2026", "1800,5", 90, 60, 200, "Да"])
        wb["История нормы"].append(["вчера", 1, 1, 1, 1, "нет"])
        wb["История нормы"].append(["01.11.2026", 1, 1, 1, 1, "может"])
    r = parse_workbook(patched(empty_export(), edit))
    assert errs(r) == [("История нормы", 3), ("История нормы", 4)]
    assert len(r.data.normHistory) == 1
    n = r.data.normHistory[0]
    assert (n.effectiveFrom, n.kcal, n.manual) == ("2026-10-31", 1800.5, True)


def test_norm_bool_variants():
    def edit(wb):
        for v in ["да", "НЕТ", " Да "]:
            wb["История нормы"].append([dt.date(2026, 10, 1), 1, 1, 1, 1, v])
    r = parse_workbook(patched(empty_export(), edit))
    assert [n.manual for n in r.data.normHistory] == [True, False, True]


def test_weight_errors():
    def edit(wb):
        wb["Вес"].append(["2026-10-31", "abc"])
        wb["Вес"].append(["2026-10-30", "60,5"])
    r = parse_workbook(patched(empty_export(), edit))
    assert errs(r) == [("Вес", 2)]
    assert r.data.weights == [WeightRecord(date="2026-10-30", weightKg=60.5)]


def test_custom_product_errors():
    def edit(wb):
        wb["Свои продукты"].append(["x", "", 1, 1, 1, 1, None])
        wb["Свои продукты"].append(["", "Сыр", "300,5", 20, 25, 0, "30,5"])
    r = parse_workbook(patched(empty_export(), edit))
    assert errs(r) == [("Свои продукты", 2)]
    p = r.data.customProducts[0]
    assert (p.name, p.kcal, p.portionG, p.source) == ("Сыр", 300.5, 30.5, "custom") and p.id


def test_real_excel_date_cell_in_hand_edit():
    row = ["", dt.datetime(2026, 10, 31, 0, 0), "Ужин", "Хлеб", 10, 250, 8, 3, 50, None, "custom", ""]
    r = parse_workbook(edited_book([row]))
    assert r.errors == [] and r.data.entries[0].date == "2026-10-31"
    assert r.data.entries[0].product.id


def test_comma_decimals_in_other_fields():
    row = ["", "2026-10-31", "Ужин", "Хлеб", 10, "250,5", "8,1", "3,2", "50,3", "40,5", "custom", ""]
    p = parse_workbook(edited_book([row])).data.entries[0].product
    assert (p.kcal, p.protein, p.fat, p.carbs, p.portionG) == (250.5, 8.1, 3.2, 50.3, 40.5)


@pytest.mark.parametrize("bad", ["nan", "inf", "-5"])
def test_non_finite_and_negative_numbers(bad):
    row = ["", "2026-10-31", "Ужин", "Хлеб", bad, 1, 1, 1, 1, None, "custom", ""]
    r = parse_workbook(edited_book([row]))
    assert errs(r) == [("Дневник", 2)] and r.data.entries == []
    if bad != "-5":
        assert "не является числом" in r.errors[0].message


# ------------------------------------------------------- resource limits ----

import zipfile

import app.excel as excel_mod
import app.routes.diary_file as diary_file_mod


def test_zip_bomb_rejected_before_openpyxl(monkeypatch):
    # ~51 MB of zeros compresses to a few dozen KB: small upload, huge when unpacked.
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("xl/worksheets/sheet1.xml", b"\0" * (51 * 1024 * 1024))
    assert len(buf.getvalue()) < 5 * 1024 * 1024

    def boom(*a, **kw):
        raise AssertionError("openpyxl must not be called")
    monkeypatch.setattr(excel_mod, "load_workbook", boom)
    with pytest.raises(UnsupportedFile, match="50 МБ"):
        parse_workbook(buf.getvalue())


def test_uncompressed_limit_counts_all_entries(monkeypatch, sample_export):
    # A normal SiteFood file is well over 1 KB unpacked.
    monkeypatch.setattr(excel_mod, "MAX_UNCOMPRESSED_BYTES", 1024)
    with pytest.raises(UnsupportedFile):
        parse_workbook(build_workbook(sample_export))


def test_row_cap_per_sheet(monkeypatch):
    monkeypatch.setattr(excel_mod, "MAX_ROWS_PER_SHEET", 3)

    def edit(wb):
        for d in range(1, 6):
            wb["Вес"].append([f"2026-10-0{d}", 60 + d])
    r = parse_workbook(patched(empty_export(), edit))
    assert [w.weightKg for w in r.data.weights] == [61, 62, 63]
    assert errs(r) == [("Вес", 5)]
    assert "3" in r.errors[0].message


def test_import_rejects_big_content_length_before_reading(client, monkeypatch):
    monkeypatch.setattr(diary_file_mod, "MAX_UPLOAD_BYTES", 100)
    monkeypatch.setattr(diary_file_mod, "MULTIPART_OVERHEAD", 0)

    async def no_form(*a, **kw):
        raise AssertionError("body must not be parsed")
    monkeypatch.setattr("starlette.requests.Request.form", no_form)
    r = client.post("/api/diary/import", files={"file": ("x.xlsx", b"0" * 1000)})
    assert r.status_code == 400 and "МБ" in r.json()["detail"]


def test_import_missing_file_field(client):
    r = client.post("/api/diary/import", files={"other": ("x.xlsx", b"123")})
    assert r.status_code == 400 and r.json()["detail"]
