from datetime import date
from urllib.parse import quote

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse, Response

from app.excel import UnsupportedFile, build_workbook, parse_workbook
from app.schemas import ExportData, ImportResult

router = APIRouter(prefix="/api/diary")

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.post("/export")
def export_diary(data: ExportData) -> Response:
    # Non-ASCII file names need RFC 5987 (filename*), plus an ASCII fallback.
    name = f"SiteFood-дневник-{date.today().isoformat()}.xlsx"
    disposition = (
        f'attachment; filename="SiteFood-diary.xlsx"; filename*=UTF-8\'\'{quote(name)}'
    )
    return Response(
        content=build_workbook(data),
        media_type=XLSX_TYPE,
        headers={"Content-Disposition": disposition},
    )


@router.post("/import")
async def import_diary(file: UploadFile = File(...)):
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        return JSONResponse(status_code=400, content={"detail": "Файл больше 5 МБ."})
    try:
        result: ImportResult = parse_workbook(content)
    except UnsupportedFile as e:
        return JSONResponse(status_code=400, content={"detail": str(e)})
    return result
