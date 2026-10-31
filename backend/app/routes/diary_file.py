from datetime import date
from urllib.parse import quote

from fastapi import APIRouter, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse, Response
from starlette.datastructures import UploadFile

from app.excel import UnsupportedFile, build_workbook, parse_workbook
from app.schemas import ExportData, ImportResult

router = APIRouter(prefix="/api/diary")

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
# A multipart body wraps the file in boundaries and part headers; allow for them.
MULTIPART_OVERHEAD = 64 * 1024
XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
TOO_LARGE = "Файл больше 5 МБ."


def _error(message: str) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": message})


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


@router.post("/import", response_model=ImportResult)
async def import_diary(request: Request):
    # The form is parsed by hand (not with an UploadFile parameter) because FastAPI
    # reads the whole body before calling the handler; this way an oversized
    # upload is refused from its Content-Length header before anything is read.
    length = request.headers.get("content-length")
    if length is not None and length.isdigit() and int(length) > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD:
        return _error(TOO_LARGE)
    try:
        form = await request.form(max_files=1, max_fields=10)
    except Exception:  # malformed multipart body
        return _error("Не удалось прочитать запрос. Выберите файл ещё раз.")
    try:
        file = form.get("file")
        if not isinstance(file, UploadFile):
            return _error("Файл не передан.")
        content = await file.read(MAX_UPLOAD_BYTES + 1)
    finally:
        await form.close()
    if len(content) > MAX_UPLOAD_BYTES:
        return _error(TOO_LARGE)
    try:
        # Parsing is CPU-bound and synchronous; running it in a worker thread
        # keeps the event loop free to serve other requests meanwhile.
        result: ImportResult = await run_in_threadpool(parse_workbook, content)
    except UnsupportedFile as e:
        return _error(str(e))
    return result
