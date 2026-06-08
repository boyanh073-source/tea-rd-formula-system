from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import socket
import json
import os
import sqlite3
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("DB_PATH", ROOT / "data" / "app.sqlite3"))
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8000"))


def init_db():
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
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA busy_timeout=5000")
        row = conn.execute("SELECT value FROM app_store WHERE key = ?", (key,)).fetchone()
    return json.loads(row[0]) if row else {}


def write_value(key, value):
    payload = json.dumps(value, ensure_ascii=False)
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


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.send_json(200, {"ok": True})
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
    print(f"茶饮研发配方系统已启动：http://localhost:{PORT}/")
    print(f"数据库路径：{DB_PATH}")
    server.serve_forever()
