from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
import json
import os
from pathlib import Path
import socket
import sqlite3
from zipfile import ZIP_DEFLATED, ZipFile
from urllib.parse import urlparse
from xml.sax.saxutils import escape


ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("DB_PATH", ROOT / "data" / "app.sqlite3"))
DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8000"))
USE_POSTGRES = bool(DATABASE_URL)
DB_ERROR = ""


def postgres_dsn():
    if not DATABASE_URL:
        return ""
    if "sslmode=" in DATABASE_URL:
        return DATABASE_URL
    separator = "&" if "?" in DATABASE_URL else "?"
    return f"{DATABASE_URL}{separator}sslmode=require"


def postgres_connect():
    import psycopg

    return psycopg.connect(postgres_dsn(), autocommit=True)


def init_db():
    global USE_POSTGRES, DB_ERROR
    if USE_POSTGRES:
        try:
            with postgres_connect() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        CREATE TABLE IF NOT EXISTS app_store (
                            key TEXT PRIMARY KEY,
                            value TEXT NOT NULL,
                            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                        )
                        """
                    )
            DB_ERROR = ""
            return
        except Exception as error:
            USE_POSTGRES = False
            DB_ERROR = str(error)

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=5000")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS app_store (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()


def read_value(key):
    if USE_POSTGRES:
        with postgres_connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT value FROM app_store WHERE key = %s", (key,))
                row = cur.fetchone()
        return json.loads(row[0]) if row else {}

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA busy_timeout=5000")
        row = conn.execute("SELECT value FROM app_store WHERE key = ?", (key,)).fetchone()
    return json.loads(row[0]) if row else {}


def write_value(key, value):
    payload = json.dumps(value, ensure_ascii=False)
    if USE_POSTGRES:
        with postgres_connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO app_store (key, value, updated_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT(key) DO UPDATE SET
                        value = excluded.value,
                        updated_at = NOW()
                    """,
                    (key, payload),
                )
        return

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA busy_timeout=5000")
        conn.execute(
            """
            INSERT INTO app_store (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP
            """,
            (key, payload),
        )
        conn.commit()


def excel_cell(value):
    text = "" if value is None else str(value)
    return f'<c t="inlineStr"><is><t>{escape(text)}</t></is></c>'


def excel_row(values):
    return f"<row>{''.join(excel_cell(value) for value in values)}</row>"


def excel_sheet(rows):
    body = "".join(excel_row(row) for row in rows)
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>{body}</sheetData>
</worksheet>"""


def workbook_xml(sheet_names):
    sheets = "".join(
        f'<sheet name="{escape(name[:31])}" sheetId="{index}" r:id="rId{index}"/>'
        for index, name in enumerate(sheet_names, 1)
    )
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>{sheets}</sheets>
</workbook>"""


def workbook_rels(sheet_count):
    rels = "".join(
        f'<Relationship Id="rId{index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{index}.xml"/>'
        for index in range(1, sheet_count + 1)
    )
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{rels}</Relationships>"""


def content_types(sheet_count):
    sheets = "".join(
        f'<Override PartName="/xl/worksheets/sheet{index}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        for index in range(1, sheet_count + 1)
    )
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  {sheets}
</Types>"""


def root_rels():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""


def make_rows(state, settings):
    materials = state.get("materials", [])
    blends = state.get("blends", [])
    fresh_formulas = state.get("freshFormulas") or state.get("formulas", [])
    rtd_formulas = state.get("rtdFormulas", [])

    sheets = []
    sheets.append(("茶叶原料库", [["编号", "名称", "一级分类", "二级分类", "产地", "风格", "备注", "创建日期"]] + [
        [item.get("id"), item.get("name"), item.get("primaryCategory"), item.get("secondaryCategory"), item.get("origin"), item.get("style"), item.get("note"), item.get("createdAt")]
        for item in materials if item.get("group") == "tea" or item.get("materialGroup") == "tea"
    ]))
    sheets.append(("添加剂原料库", [["编号", "名称", "分类", "二级分类", "风格", "备注", "创建日期"]] + [
        [item.get("id"), item.get("name"), item.get("category"), item.get("secondaryCategory"), item.get("style"), item.get("note"), item.get("createdAt")]
        for item in materials if item.get("group") == "additive" or item.get("materialGroup") == "additive"
    ]))
    sheets.append(("配料库", [["名称", "供应商", "一级分类", "二级分类", "创建日期"]] + [
        [item.get("name"), item.get("supplier"), item.get("category"), item.get("secondaryCategory"), item.get("createdAt")]
        for item in materials if item.get("group") == "general" or item.get("materialGroup") == "general"
    ]))
    sheets.append(("拼配方案库", [["编号", "名称", "面向客户", "状态", "拼配方式", "创建日期"]] + [
        [item.get("id"), item.get("name"), item.get("customer"), item.get("status"), item.get("method"), item.get("createdAt")]
        for item in blends
    ]))
    sheets.append(("拼配原料明细", [["拼配编号", "拼配名称", "原料类型", "原料名称", "原料编号", "添加量"]] + [
        [blend.get("id"), blend.get("name"), row.get("type") or row.get("materialType"), row.get("name"), row.get("materialId"), row.get("amount") or row.get("ratio")]
        for blend in blends for row in blend.get("items", [])
    ]))
    sheets.append(("现制配方库", [["配方编号", "名称", "面向客户", "状态", "版本", "SOP", "创建日期"]] + [
        [item.get("id"), item.get("name"), item.get("customer"), item.get("status"), item.get("version"), item.get("sop"), item.get("createdAt")]
        for item in fresh_formulas
    ]))
    sheets.append(("现制茶叶冲泡", [["配方编号", "配方名称", "茶汤名称", "茶叶名称", "茶叶编号", "茶叶量", "水温", "时间", "热水量", "冰块量"]] + [
        [formula.get("id"), formula.get("name"), brew.get("soupName"), brew.get("teaName") or brew.get("name"), brew.get("teaId") or brew.get("materialId"), brew.get("teaAmount"), brew.get("temperature"), brew.get("time"), brew.get("hotWater"), brew.get("ice")]
        for formula in fresh_formulas for brew in formula.get("brews", [])
    ]))
    sheets.append(("现制饮品出品", [["配方编号", "配方名称", "原料类型", "原料名称", "用量"]] + [
        [formula.get("id"), formula.get("name"), row.get("type") or row.get("materialType"), row.get("name"), row.get("amount") or row.get("ratio")]
        for formula in fresh_formulas for row in (formula.get("outputs") or formula.get("drinkItems") or [])
    ]))
    sheets.append(("RTD配方库", [["配方编号", "名称", "面向客户", "状态", "版本", "萃取水温", "萃取时间", "冲泡茶水比", "定容茶水比", "创建日期"]] + [
        [item.get("id"), item.get("name"), item.get("customer"), item.get("status"), item.get("version"), item.get("extraction", {}).get("temperature"), item.get("extraction", {}).get("time"), item.get("extraction", {}).get("brewTeaWaterRatio"), item.get("extraction", {}).get("finalTeaWaterRatio"), item.get("createdAt")]
        for item in rtd_formulas
    ]))
    sheets.append(("RTD萃取茶叶", [["配方编号", "配方名称", "茶叶名", "茶叶编号"]] + [
        [formula.get("id"), formula.get("name"), tea.get("name"), tea.get("materialId")]
        for formula in rtd_formulas for tea in formula.get("teas", [])
    ]))
    sheets.append(("RTD调配方案", [["配方编号", "配方名称", "原料类型", "原料名", "原料编号", "添加量每升"]] + [
        [formula.get("id"), formula.get("name"), row.get("type"), row.get("name"), row.get("materialId"), row.get("amount")]
        for formula in rtd_formulas for row in formula.get("mixItems", [])
    ]))
    sheets.append(("设置", [["设置项", "选项"]] + [
        [key, " / ".join(value) if isinstance(value, list) else value]
        for key, value in (settings or {}).items()
    ]))
    return sheets


def make_workbook(state, settings):
    sheets = make_rows(state, settings)
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types(len(sheets)))
        archive.writestr("_rels/.rels", root_rels())
        archive.writestr("xl/workbook.xml", workbook_xml([name for name, _ in sheets]))
        archive.writestr("xl/_rels/workbook.xml.rels", workbook_rels(len(sheets)))
        for index, (_, rows) in enumerate(sheets, 1):
            archive.writestr(f"xl/worksheets/sheet{index}.xml", excel_sheet(rows))
    return buffer.getvalue()


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            payload = {"ok": True, "storage": "postgres" if USE_POSTGRES else "sqlite"}
            if DB_ERROR:
                payload["databaseError"] = DB_ERROR
            self.send_json(200, payload)
            return
        if parsed.path == "/api/export.xlsx":
            state = read_value("state")
            settings = read_value("settings")
            body = make_workbook(state, settings)
            self.send_response(200)
            self.send_header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            self.send_header("Content-Disposition", 'attachment; filename="tea-rd-archive.xlsx"')
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path in {"/api/state", "/api/settings"}:
            key = parsed.path.rsplit("/", 1)[-1]
            self.send_json(200, read_value(key))
            return
        super().do_GET()

    def do_PUT(self):
        parsed = urlparse(self.path)
        if parsed.path not in {"/api/state", "/api/settings"}:
            self.send_json(404, {"error": "Not found"})
            return

        length = int(self.headers.get("Content-Length", "0"))
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except json.JSONDecodeError:
            self.send_json(400, {"error": "Invalid JSON"})
            return

        key = parsed.path.rsplit("/", 1)[-1]
        write_value(key, payload)
        self.send_json(200, {"ok": True})

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class DualStackServer(ThreadingHTTPServer):
    address_family = socket.AF_INET6

    def server_bind(self):
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except OSError:
            pass
        super().server_bind()


if __name__ == "__main__":
    init_db()
    server_class = DualStackServer if ":" in HOST else ThreadingHTTPServer
    server = server_class((HOST, PORT), AppHandler)
    print(f"Tea R&D formula system started: http://localhost:{PORT}/")
    print(f"Storage backend: {'postgres' if USE_POSTGRES else 'sqlite'}")
    if DB_ERROR:
        print(f"Database connection error: {DB_ERROR}")
    if not USE_POSTGRES:
        print(f"SQLite path: {DB_PATH}")
    server.serve_forever()
