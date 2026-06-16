"""
SissyTrends Boutique - Local API Server + Static File Server
============================================================
HOW TO USE:
  1. Double-click  start.bat  (Windows)
     OR run:  python api.py
  2. Open browser at:  http://localhost:5000
  3. Admin panel:      http://localhost:5000/admin/

The database lives at:  data/sissytrends.db
Press Ctrl+C in the terminal to stop the server.
"""

import sqlite3, json, os, re
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# ── Paths ────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# On Render (no persistent disk): store DB in app directory
# Locally: store in data/ subfolder
_is_local = os.path.exists(os.path.join(BASE_DIR, '.localdev'))
DB_PATH = os.path.join(BASE_DIR, 'data', 'sissytrends.db') if _is_local else os.path.join(BASE_DIR, 'sissytrends.db')
PORT     = int(os.environ.get('PORT', 5000))  # Render sets PORT env var
HOST     = '0.0.0.0'  # bind to all interfaces (required for Render/cloud hosting)

# ── MIME types ───────────────────────────────────────────────────
MIME = {
    '.html':'text/html;charset=utf-8',
    '.css':'text/css',
    '.js':'application/javascript',
    '.json':'application/json',
    '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
    '.webp':'image/webp', '.gif':'image/gif', '.svg':'image/svg+xml',
    '.ico':'image/x-icon', '.woff2':'font/woff2', '.woff':'font/woff',
    '.ttf':'font/ttf', '.bat':'text/plain',
}

# ── DB connection ─────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=10000")
    return conn

def row_to_dict(row):
    d = dict(row)
    if 'available' in d:
        d['available'] = bool(d['available'])
    return d

# ── Response helpers ──────────────────────────────────────────────
def send_json(handler, data, status=200):
    body = json.dumps(data, ensure_ascii=False).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type',  'application/json;charset=utf-8')
    handler.send_header('Content-Length', str(len(body)))
    handler.send_header('Access-Control-Allow-Origin',  '*')
    handler.send_header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    handler.send_header('Access-Control-Allow-Headers', 'Content-Type')
    handler.end_headers()
    handler.wfile.write(body)

def read_body(handler):
    n = int(handler.headers.get('Content-Length', 0))
    if not n: return {}
    try:    return json.loads(handler.rfile.read(n).decode('utf-8'))
    except: return {}

# ── Generate next product ID ──────────────────────────────────────
def next_product_id(db, category):
    prefix = {'sarees':'SAR', 'jewellery':'JWL', 'decor':'DCR'}.get(category, 'PRD')
    used   = {r[0] for r in db.execute(
        "SELECT productId FROM products WHERE productId LIKE ?", (prefix+'-%',)
    ).fetchall()}
    n = 1
    while f"{prefix}-{n:03d}" in used:
        n += 1
    return f"{prefix}-{n:03d}"

# ── Request handler ───────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        # Suppress static file logs; only show API calls
        msg = fmt % args if args else fmt
        if '/api/' in msg:
            print(f"  API  {msg}")

    # CORS pre-flight
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    # ── GET ───────────────────────────────────────────────────────
    def do_GET(self):
        p = urlparse(self.path)
        path = p.path.rstrip('/') or '/'

        if path == '/api/health':
            send_json(self, {'status':'ok','db':DB_PATH})

        elif path == '/api/env':
            # Serve admin credentials from environment variables (Render)
            send_json(self, {
                'ADMIN_USERNAME': os.environ.get('ADMIN_USERNAME', ''),
                'ADMIN_PASSWORD': os.environ.get('ADMIN_PASSWORD', ''),
            })

        elif path == '/api/db-upload':
            qs  = parse_qs(urlparse(self.path).query)
            key = qs.get('key', [None])[0]
            if key != os.environ.get('DB_DOWNLOAD_KEY', 'sissy-db-2025'):
                self.send_response(403); self.end_headers(); self.wfile.write(b'Forbidden'); return
            length = int(self.headers.get('Content-Length', 0))
            data   = self.rfile.read(length)
            if len(data) < 1000:
                send_json(self, {'error': 'File too small'}, 400); return
            import shutil as _sh
            if os.path.exists(DB_PATH): _sh.copy2(DB_PATH, DB_PATH + '.bak')
            with open(DB_PATH, 'wb') as f: f.write(data)
            send_json(self, {'ok': True, 'size': len(data)}); return

        elif path == '/api/db-download':
            qs  = parse_qs(urlparse(self.path).query)
            key = qs.get('key', [None])[0]
            if key != os.environ.get('DB_DOWNLOAD_KEY', 'sissy-db-2025'):
                self.send_response(403); self.end_headers(); self.wfile.write(b'Forbidden'); return
            with open(DB_PATH, 'rb') as f: data = f.read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Disposition', 'attachment; filename="sissytrends.db"')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(data); return

        elif path == '/api/export/csv':
            with get_db() as db:
                rows = db.execute('SELECT * FROM products ORDER BY category, productId').fetchall()
            import csv, io
            out = io.StringIO()
            fields = ['id','productId','available','name','category','subcategory',
                      'fabric','price','badge','occasion','img','img2','img3','img4',
                      'desc','created_at','updated_at']
            w = csv.DictWriter(out, fieldnames=fields, delimiter=';', extrasaction='ignore')
            w.writeheader()
            for row in rows:
                w.writerow(dict(row))
            data = out.getvalue().encode('utf-8-sig')
            self.send_response(200)
            self.send_header('Content-Type', 'text/csv; charset=utf-8')
            self.send_header('Content-Disposition', 'attachment; filename="products_CSVBasic.csv"')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(data)
            return

        elif path == '/api/products':
            qs  = parse_qs(p.query)
            cat = qs.get('category',   [None])[0]
            sub = qs.get('subcategory',[None])[0]
            occ = qs.get('occasion',   [None])[0]
            sql, params = "SELECT * FROM products WHERE 1=1", []
            if cat: sql += " AND category=?";    params.append(cat)
            if sub: sql += " AND subcategory=?"; params.append(sub)
            if occ: sql += " AND occasion=?";    params.append(occ)
            sql += " ORDER BY id ASC"
            with get_db() as db:
                rows = db.execute(sql, params).fetchall()
            send_json(self, [row_to_dict(r) for r in rows])

        elif re.match(r'^/api/products/\d+$', path):
            pid = int(path.split('/')[-1])
            with get_db() as db:
                row = db.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
            if row: send_json(self, row_to_dict(row))
            else:   send_json(self, {'error':'Not found'}, 404)

        elif path == '/api/wishlist':
            qs = parse_qs(urlparse(self.path).query)
            sid = qs.get('session_id', ['anonymous'])[0]
            with get_db() as db:
                rows = db.execute(
                    "SELECT * FROM wishlist WHERE session_id=? ORDER BY added_at DESC", (sid,)
                ).fetchall()
            send_json(self, [row_to_dict(r) for r in rows])

        elif path == '/api/analytics':
            with get_db() as db:
                events = db.execute(
                    "SELECT event_type,product_id,COUNT(*) as count "
                    "FROM analytics GROUP BY event_type,product_id ORDER BY count DESC"
                ).fetchall()
                recent = db.execute(
                    "SELECT * FROM recently_viewed ORDER BY viewed_at DESC LIMIT 10"
                ).fetchall()
                inqs   = db.execute(
                    "SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 500"
                ).fetchall()
            send_json(self, {
                'events':        [dict(r) for r in events],
                'recentlyViewed':[dict(r) for r in recent],
                'inquiries':     [dict(r) for r in inqs],
            })

        elif path == '/api/inquiries':
            with get_db() as db:
                rows = db.execute(
                    "SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 500"
                ).fetchall()
            send_json(self, [dict(r) for r in rows])

        else:
            self._serve_file(p.path)

    # ── POST ──────────────────────────────────────────────────────
    def do_POST(self):
        path = urlparse(self.path).path.rstrip('/')
        body = read_body(self)

        if path == '/api/products':
            with get_db() as db:
                pid_str = next_product_id(db, body.get('category',''))
                cur = db.execute("""
                    INSERT INTO products
                      (productId,available,name,category,subcategory,fabric,
                       price,badge,occasion,img,img2,img3,img4,desc)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (pid_str,
                     1 if body.get('available', True) else 0,
                     body.get('name',''), body.get('category',''),
                     body.get('subcategory',''), body.get('fabric',''),
                     int(body.get('price',0)), body.get('badge',''),
                     body.get('occasion',''), body.get('img',''),
                     body.get('img2') or None, body.get('img3') or None,
                     body.get('img4') or None, body.get('desc',''))
                )
                row = db.execute("SELECT * FROM products WHERE id=?", (cur.lastrowid,)).fetchone()
            send_json(self, row_to_dict(row), 201)

        elif path == '/api/wishlist':
            sid = body.get('session_id', 'anonymous')
            with get_db() as db:
                # Upsert session record
                db.execute("""
                    INSERT INTO wishlist_sessions (session_id) VALUES (?)
                    ON CONFLICT(session_id) DO UPDATE SET last_active=CURRENT_TIMESTAMP
                """, (sid,))
                if db.execute("SELECT 1 FROM wishlist WHERE session_id=? AND product_id=?",
                              (sid, body.get('product_id'))).fetchone():
                    send_json(self, {'already_saved':True}); return
                db.execute(
                    "INSERT INTO wishlist (session_id,product_id,productId,name,price,img,badge) "
                    "VALUES (?,?,?,?,?,?,?)",
                    (sid, body.get('product_id'), body.get('productId',''),
                     body.get('name',''), body.get('price',0),
                     body.get('img',''), body.get('badge',''))
                )
                rows = db.execute(
                    "SELECT * FROM wishlist WHERE session_id=? ORDER BY added_at DESC", (sid,)
                ).fetchall()
            send_json(self, [row_to_dict(r) for r in rows], 201)

        elif path == '/api/analytics/event':
            with get_db() as db:
                db.execute(
                    "INSERT INTO analytics (event_type,product_id,product_name) VALUES (?,?,?)",
                    (body.get('event_type',''), body.get('product_id'),
                     body.get('product_name',''))
                )
                if body.get('event_type') == 'product_view':
                    db.execute("DELETE FROM recently_viewed WHERE product_id=?",
                               (body.get('product_id'),))
                    db.execute(
                        "INSERT INTO recently_viewed (product_id,name,img,price,category) "
                        "VALUES (?,?,?,?,?)",
                        (body.get('product_id'), body.get('product_name',''),
                         body.get('img',''), body.get('price',0), body.get('category',''))
                    )
                    db.execute(
                        "DELETE FROM recently_viewed WHERE id NOT IN "
                        "(SELECT id FROM recently_viewed ORDER BY viewed_at DESC LIMIT 10)"
                    )
            send_json(self, {'ok':True})

        elif path == '/api/inquiries':
            with get_db() as db:
                db.execute(
                    "INSERT INTO inquiries (product_id,product_name,category,price) "
                    "VALUES (?,?,?,?)",
                    (body.get('product_id'), body.get('product_name',''),
                     body.get('category',''), body.get('price',0))
                )
            send_json(self, {'ok':True}, 201)

        else:
            send_json(self, {'error':'Not found'}, 404)

    # ── PUT ───────────────────────────────────────────────────────
    def do_PUT(self):
        path = urlparse(self.path).path.rstrip('/')
        body = read_body(self)
        if re.match(r'^/api/products/\d+$', path):
            pid = int(path.split('/')[-1])
            with get_db() as db:
                e = db.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
                if not e: send_json(self, {'error':'Not found'}, 404); return
                db.execute("""
                    UPDATE products SET
                      available=?,name=?,category=?,subcategory=?,fabric=?,
                      price=?,badge=?,occasion=?,img=?,img2=?,img3=?,img4=?,
                      desc=?,updated_at=CURRENT_TIMESTAMP
                    WHERE id=?""",
                    (1 if body.get('available', bool(e['available'])) else 0,
                     body.get('name',        e['name']),
                     body.get('category',    e['category']),
                     body.get('subcategory', e['subcategory']),
                     body.get('fabric',      e['fabric']),
                     int(body.get('price',   e['price'])),
                     body.get('badge',       e['badge']),
                     body.get('occasion',    e['occasion']),
                     body.get('img',         e['img']),
                     body.get('img2') or None,
                     body.get('img3') or None,
                     body.get('img4') or None,
                     body.get('desc',        e['desc']),
                     pid)
                )
                row = db.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
            send_json(self, row_to_dict(row))
        else:
            send_json(self, {'error':'Not found'}, 404)

    # ── DELETE ────────────────────────────────────────────────────
    def do_DELETE(self):
        path = urlparse(self.path).path.rstrip('/')
        if re.match(r'^/api/products/\d+$', path):
            pid = int(path.split('/')[-1])
            with get_db() as db:
                db.execute("DELETE FROM products WHERE id=?", (pid,))
            send_json(self, {'deleted':pid})
        elif re.match(r'^/api/wishlist/\d+$', path):
            pid = int(path.split('/')[-1])
            with get_db() as db:
                db.execute("DELETE FROM wishlist WHERE product_id=?", (pid,))
                rows = db.execute("SELECT * FROM wishlist ORDER BY added_at DESC").fetchall()
            send_json(self, [row_to_dict(r) for r in rows])
        elif path == '/api/inquiries':
            with get_db() as db:
                db.execute("DELETE FROM inquiries")
            send_json(self, {'cleared':True})
        else:
            send_json(self, {'error':'Not found'}, 404)

    # ── Static file server ────────────────────────────────────────
    def _serve_file(self, req_path):
        if req_path in ('/', ''):
            req_path = '/index.html'
        # Decode URL encoding (e.g. %20 -> space)
        from urllib.parse import unquote
        req_path = unquote(req_path)
        # Normalise path
        rel   = req_path.lstrip('/').replace('/', os.sep)
        fpath = os.path.normpath(os.path.join(BASE_DIR, rel))
        # Security: block traversal outside BASE_DIR
        if not fpath.startswith(BASE_DIR):
            self.send_response(403); self.end_headers(); return
        if not os.path.isfile(fpath):
            self.send_response(404); self.end_headers()
            self.wfile.write(b'404 Not Found'); return
        ext  = os.path.splitext(fpath)[1].lower()
        mime = MIME.get(ext, 'application/octet-stream')
        with open(fpath, 'rb') as f:
            data = f.read()
        self.send_response(200)
        self.send_header('Content-Type',   mime)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

# ── Main ──────────────────────────────────────────────────────────
if __name__ == '__main__':
    # Init DB if missing
    if not os.path.exists(DB_PATH):
        import init_db
        init_db.init_db()

    # Migrate existing DB — add session columns if not present
    with sqlite3.connect(DB_PATH, timeout=10) as _db:
        _db.execute("PRAGMA journal_mode=WAL")
        _cols = [r[1] for r in _db.execute("PRAGMA table_info(wishlist)").fetchall()]
        if 'session_id' not in _cols:
            _db.execute("ALTER TABLE wishlist ADD COLUMN session_id TEXT NOT NULL DEFAULT 'anonymous'")
            print("  Migrated: added session_id to wishlist table")
        _db.execute("""
            CREATE TABLE IF NOT EXISTS wishlist_sessions (
                session_id  TEXT PRIMARY KEY,
                created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
                last_active TEXT DEFAULT CURRENT_TIMESTAMP
            )""")

    print(f"""
  ╔══════════════════════════════════════════════╗
  ║      SissyTrends Boutique - Local Server     ║
  ╠══════════════════════════════════════════════╣
  ║  Site:   http://localhost:{PORT}               ║
  ║  Admin:  http://localhost:{PORT}/admin/        ║
  ║  API:    http://localhost:{PORT}/api/products  ║
  ╚══════════════════════════════════════════════╝
  Press Ctrl+C to stop.
""")
    try:
        HTTPServer((HOST, PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")
