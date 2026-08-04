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

# ── Load .env.local automatically (works when double-clicking start.bat) ──
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env.local')
if os.path.exists(_env_path):
    with open(_env_path, encoding='utf-8') as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith('#') and '=' in _line:
                _k, _v = _line.split('=', 1)
                os.environ[_k.strip()] = _v.strip()

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

        elif path == '/api/admin/login':
            pass  # handled in do_POST

        elif path.startswith('/api/upload-image'):
            qs  = parse_qs(urlparse(self.path).query)
            key = qs.get('key', [None])[0]
            if key != os.environ.get('DB_DOWNLOAD_KEY', 'sissy-db-2025'):
                self.send_response(403); self.end_headers(); self.wfile.write(b'Forbidden'); return
            filename = qs.get('file', [None])[0]
            folder   = qs.get('folder', ['SareeImages'])[0]
            if not filename or '..' in filename or '/' in filename or '\\' in filename:
                send_json(self, {'error': 'Invalid filename'}, 400); return
            dest_dir = os.path.join(BASE_DIR, 'Images', folder)
            os.makedirs(dest_dir, exist_ok=True)
            dest   = os.path.join(dest_dir, filename)
            length = int(self.headers.get('Content-Length', 0))
            data   = self.rfile.read(length)
            with open(dest, 'wb') as f: f.write(data)
            send_json(self, {'ok': True, 'path': f'/Images/{folder}/{filename}', 'size': len(data)})
            return

        elif path.startswith('/api/list-images'):
            qs     = parse_qs(urlparse(self.path).query)
            key    = qs.get('key', [None])[0]
            if key != os.environ.get('DB_DOWNLOAD_KEY', 'sissy-db-2025'):
                self.send_response(403); self.end_headers(); self.wfile.write(b'Forbidden'); return
            folder = qs.get('folder', ['SareeImages'])[0]
            target = os.path.join(BASE_DIR, 'Images', folder)
            if not os.path.isdir(target):
                send_json(self, {'error': 'Folder not found', 'folder': folder}, 404); return
            files  = sorted(os.listdir(target))
            send_json(self, {'folder': folder, 'count': len(files), 'files': files})
            return

        elif path.startswith('/api/upload-image'):
            qs       = parse_qs(urlparse(self.path).query)
            key      = qs.get('key', [None])[0]
            if key != os.environ.get('DB_DOWNLOAD_KEY', 'sissy-db-2025'):
                self.send_response(403); self.end_headers(); self.wfile.write(b'Forbidden'); return
            filename = qs.get('file', [None])[0]
            folder   = qs.get('folder', ['SareeImages'])[0]
            if not filename or '..' in filename or '/' in filename or '\\' in filename:
                send_json(self, {'error': 'Invalid filename'}, 400); return
            dest_dir = os.path.join(BASE_DIR, 'Images', folder)
            os.makedirs(dest_dir, exist_ok=True)
            dest   = os.path.join(dest_dir, filename)
            length = int(self.headers.get('Content-Length', 0))
            data   = self.rfile.read(length)
            with open(dest, 'wb') as f: f.write(data)
            send_json(self, {'ok': True, 'path': f'/Images/{folder}/{filename}', 'size': len(data)})
            return

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

        elif path == '/api/subcategories':
            qs  = parse_qs(urlparse(self.path).query)
            cat = qs.get('category', [None])[0]
            with get_db() as db:
                if cat:
                    rows = db.execute(
                        "SELECT DISTINCT subcategory FROM products "
                        "WHERE category=? AND subcategory IS NOT NULL AND subcategory != '' "
                        "ORDER BY subcategory", (cat,)
                    ).fetchall()
                else:
                    rows = db.execute(
                        "SELECT DISTINCT category, subcategory FROM products "
                        "WHERE subcategory IS NOT NULL AND subcategory != '' "
                        "ORDER BY category, subcategory"
                    ).fetchall()
            send_json(self, [r[0] for r in rows])

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

        elif path == '/api/cart':
            qs  = parse_qs(urlparse(self.path).query)
            sid = qs.get('session_id', ['anonymous'])[0]
            with get_db() as db:
                db.execute("""
                    CREATE TABLE IF NOT EXISTS cart (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id TEXT NOT NULL,
                        product_id INTEGER NOT NULL,
                        productId TEXT DEFAULT '',
                        name TEXT DEFAULT '',
                        price INTEGER DEFAULT 0,
                        img TEXT DEFAULT '',
                        qty INTEGER DEFAULT 1,
                        added_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(session_id, product_id)
                    )""")
                rows = db.execute(
                    'SELECT * FROM cart WHERE session_id=? ORDER BY added_at DESC', (sid,)
                ).fetchall()
            send_json(self, [row_to_dict(r) for r in rows])
            return

        elif path == '/api/cart':
            sid = body.get('session_id', 'anonymous')
            with get_db() as db:
                db.execute("""
                    CREATE TABLE IF NOT EXISTS cart (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id TEXT NOT NULL,
                        product_id INTEGER NOT NULL,
                        productId TEXT DEFAULT '',
                        name TEXT DEFAULT '',
                        price INTEGER DEFAULT 0,
                        img TEXT DEFAULT '',
                        qty INTEGER DEFAULT 1,
                        added_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(session_id, product_id)
                    )""")
                existing = db.execute(
                    'SELECT qty FROM cart WHERE session_id=? AND product_id=?',
                    (sid, body.get('product_id'))
                ).fetchone()
                if existing:
                    db.execute(
                        'UPDATE cart SET qty=qty+1 WHERE session_id=? AND product_id=?',
                        (sid, body.get('product_id'))
                    )
                else:
                    db.execute(
                        'INSERT INTO cart (session_id,product_id,productId,name,price,img,qty) VALUES (?,?,?,?,?,?,?)',
                        (sid, body.get('product_id'), body.get('productId',''),
                         body.get('name',''), body.get('price',0),
                         body.get('img',''), body.get('qty',1))
                    )
                rows = db.execute(
                    'SELECT * FROM cart WHERE session_id=? ORDER BY added_at DESC', (sid,)
                ).fetchall()
            send_json(self, [row_to_dict(r) for r in rows], 201)
            return

        elif path == '/api/orders':
            with get_db() as db:
                try:
                    rows = db.execute('SELECT * FROM orders ORDER BY created_at DESC').fetchall()
                    send_json(self, [row_to_dict(r) for r in rows])
                except:
                    send_json(self, [])

        elif path == '/api/geocode':
            qs  = parse_qs(urlparse(self.path).query)
            lat = qs.get('lat', [None])[0]
            lon = qs.get('lon', [None])[0]
            if not lat or not lon:
                send_json(self, {'error': 'Missing lat/lon'}, 400); return
            import urllib.request as _ur
            try:
                req = _ur.Request(
                    f'https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json',
                    headers={'User-Agent': 'SissyTrends/1.0'}
                )
                with _ur.urlopen(req, timeout=5) as r:
                    import json as _j
                    data = _j.loads(r.read().decode())
                a = data.get('address', {})
                location = ', '.join(filter(None, [
                    a.get('city') or a.get('town') or a.get('village') or a.get('suburb',''),
                    a.get('state','')
                ]))
                send_json(self, {'location': location})
            except Exception as e:
                send_json(self, {'location': ''})

        elif path == '/api/inquiries':
            with get_db() as db:
                try:
                    rows = db.execute('SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 500').fetchall()
                    send_json(self, [dict(r) for r in rows])
                except:
                    send_json(self, [])

        else:
            self._serve_file(p.path)

    # ── POST ──────────────────────────────────────────────────────
    def do_POST(self):
        path = urlparse(self.path).path.rstrip('/')

        if path == '/api/admin/login':
            # Server-side admin login — credentials never sent to browser
            length = int(self.headers.get('Content-Length', 0))
            body   = json.loads(self.rfile.read(length) or b'{}')
            u      = body.get('username', '')
            p      = body.get('password', '')
            valid_u = os.environ.get('ADMIN_USERNAME', 'austroindie_admin')
            valid_p = os.environ.get('ADMIN_PASSWORD', '')
            if not valid_p:
                send_json(self, {'ok': False, 'error': 'Server misconfigured — ADMIN_PASSWORD not set in .env.local'}, 500)
            elif u == valid_u and p == valid_p:
                send_json(self, {'ok': True})
            else:
                send_json(self, {'ok': False, 'error': 'Invalid credentials.'}, 401)
            return

        elif path.startswith('/api/upload-image'):
            qs       = parse_qs(urlparse(self.path).query)
            key      = qs.get('key', [None])[0]
            if key != os.environ.get('DB_DOWNLOAD_KEY', 'sissy-db-2025'):
                self.send_response(403); self.end_headers(); self.wfile.write(b'Forbidden'); return
            filename = qs.get('file', [None])[0]
            folder   = qs.get('folder', ['SareeImages'])[0]
            if not filename or '..' in filename:
                send_json(self, {'error': 'Invalid filename'}, 400); return
            dest_dir = os.path.join(BASE_DIR, 'Images', folder)
            os.makedirs(dest_dir, exist_ok=True)
            dest   = os.path.join(dest_dir, filename)
            length = int(self.headers.get('Content-Length', 0))
            data   = self.rfile.read(length)
            with open(dest, 'wb') as f: f.write(data)
            send_json(self, {'ok': True, 'path': f'/Images/{folder}/{filename}', 'size': len(data)})
            return

        elif path == '/api/upload-csv':
            qs  = parse_qs(urlparse(self.path).query)
            key = qs.get('key', [None])[0]
            if key != os.environ.get('DB_DOWNLOAD_KEY', 'sissy-db-2025'):
                self.send_response(403); self.end_headers(); self.wfile.write(b'Forbidden'); return
            mode   = qs.get('mode', ['add'])[0]   # add | replace
            length = int(self.headers.get('Content-Length', 0))
            raw    = self.rfile.read(length)
            import csv, io
            try:
                text   = raw.decode('utf-8-sig')
            except:
                text   = raw.decode('cp1252', errors='replace')
            reader  = csv.DictReader(io.StringIO(text), delimiter=';')
            rows    = list(reader)
            if not rows:
                send_json(self, {'error': 'Empty or invalid CSV'}, 400); return
            inserted = updated = skipped = 0
            with get_db() as db:
                if mode == 'replace':
                    db.execute('DELETE FROM products')
                existing = {r[0] for r in db.execute('SELECT productId FROM products').fetchall()}
                for row in rows:
                    pid = row.get('productId','').strip()
                    if not pid: continue
                    if pid in existing:
                        # Update existing product
                        db.execute("""
                            UPDATE products SET
                              available=?, name=?, category=?, subcategory=?, fabric=?,
                              price=?, badge=?, occasion=?, img=?, img2=?, img3=?, img4=?,
                              desc=?, updated_at=CURRENT_TIMESTAMP
                            WHERE productId=?""",
                            (
                                1 if str(row.get('available','1')).strip() in ('1','true','True') else 0,
                                row.get('name','').strip(),
                                row.get('category','').strip(),
                                row.get('subcategory','').strip() or None,
                                row.get('fabric','').strip() or None,
                                int(row.get('price',0) or 0),
                                row.get('badge','').strip() or None,
                                row.get('occasion','').strip() or None,
                                row.get('img','').strip() or None,
                                row.get('img2','').strip() or None,
                                row.get('img3','').strip() or None,
                                row.get('img4','').strip() or None,
                                row.get('desc','').strip() or None,
                                pid
                            )
                        )
                        updated += 1
                    else:
                        db.execute("""
                            INSERT INTO products
                              (productId,available,name,category,subcategory,fabric,
                               price,badge,occasion,img,img2,img3,img4,desc)
                            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                            (
                                pid,
                                1 if str(row.get('available','1')).strip() in ('1','true','True') else 0,
                                row.get('name','').strip(),
                                row.get('category','').strip(),
                                row.get('subcategory','').strip() or None,
                                row.get('fabric','').strip() or None,
                                int(row.get('price',0) or 0),
                                row.get('badge','').strip() or None,
                                row.get('occasion','').strip() or None,
                                row.get('img','').strip() or None,
                                row.get('img2','').strip() or None,
                                row.get('img3','').strip() or None,
                                row.get('img4','').strip() or None,
                                row.get('desc','').strip() or None,
                            )
                        )
                        inserted += 1
                        existing.add(pid)
                total = db.execute('SELECT COUNT(*) FROM products').fetchone()[0]
            send_json(self, {
                'ok': True, 'mode': mode,
                'inserted': inserted, 'updated': updated,
                'skipped': skipped, 'total_in_db': total
            })
            return

        elif path == '/api/razorpay/webhook':
            import hmac as _hmac, hashlib as _hl, json as _jwh
            webhook_secret = os.environ.get('RAZORPAY_WEBHOOK_SECRET', '')
            sig    = self.headers.get('X-Razorpay-Signature', '')
            length = int(self.headers.get('Content-Length', 0))
            raw    = self.rfile.read(length)
            if webhook_secret:
                expected = _hmac.new(webhook_secret.encode(), raw, _hl.sha256).hexdigest()
                if expected != sig:
                    self.send_response(400); self.end_headers()
                    self.wfile.write(b'Invalid signature'); return
            event      = _jwh.loads(raw.decode())
            event_type = event.get('event', '')
            if event_type == 'payment.captured':
                pmt      = event['payload']['payment']['entity']
                order_id = pmt.get('order_id', '')
                pay_id   = pmt.get('id', '')
                amount   = pmt.get('amount', 0)
                notes    = pmt.get('notes', {})
                prod     = notes.get('product_name', '') or pmt.get('description', '')
                pid      = notes.get('product_id', 0)
                with get_db() as db:
                    db.execute(
                        "CREATE TABLE IF NOT EXISTS orders ("
                        "id INTEGER PRIMARY KEY AUTOINCREMENT,"
                        "order_id TEXT, payment_id TEXT UNIQUE, signature TEXT,"
                        "amount INTEGER, product_id INTEGER,"
                        "product_name TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)"
                    )
                    try:
                        db.execute(
                            "INSERT OR IGNORE INTO orders (order_id,payment_id,amount,product_id,product_name) VALUES (?,?,?,?,?)",
                            (order_id, pay_id, amount, pid, prod)
                        )
                    except Exception: pass
                wa  = os.environ.get('WHATSAPP_BUSINESS_NUMBER', '')
                msg = f'*New Order!*%0AProduct: {prod}%0AAmount: Rs.{amount//100}%0APayment: {pay_id}'
                if wa: print(f'ORDER: https://wa.me/{wa}?text={msg}')
            self.send_response(200); self.end_headers(); self.wfile.write(b'ok'); return

        body = read_body(self)


        if path == '/api/inquiries':
            with get_db() as db:
                cols = [r[1] for r in db.execute('PRAGMA table_info(inquiries)').fetchall()]
                if 'customer_name' not in cols:
                    db.execute("ALTER TABLE inquiries ADD COLUMN customer_name  TEXT DEFAULT ''")
                    db.execute("ALTER TABLE inquiries ADD COLUMN customer_phone TEXT DEFAULT ''")
                    db.execute("ALTER TABLE inquiries ADD COLUMN occasion       TEXT DEFAULT ''")
                    db.execute("ALTER TABLE inquiries ADD COLUMN message        TEXT DEFAULT ''")
                    db.execute("ALTER TABLE inquiries ADD COLUMN type           TEXT DEFAULT 'product'")
                if 'location' not in cols:
                    db.execute("ALTER TABLE inquiries ADD COLUMN location TEXT DEFAULT ''")
                db.execute(
                    "INSERT INTO inquiries (product_id,product_name,category,price,customer_name,customer_phone,occasion,message,type,location) "
                    "VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (body.get('product_id'), body.get('product_name',''),
                     body.get('category',''), body.get('price',0),
                     body.get('customer_name',''), body.get('customer_phone',''),
                     body.get('occasion',''), body.get('message',''),
                     body.get('type','product'), body.get('location',''))
                )
            send_json(self, {'ok':True}, 201)
            return

        elif path == '/api/otp/send':
            import random, time, urllib.request as _ur, urllib.parse as _up, datetime as _dt
            phone = body.get('phone', '')
            if not phone or len(phone) < 10:
                send_json(self, {'error': 'Invalid phone number'}, 400); return
            otp = str(random.randint(100000, 999999))
            if not hasattr(Handler, '_otp_store'): Handler._otp_store = {}
            Handler._otp_store[phone] = {'otp': otp, 'expires': time.time() + 600}

            # Track daily SMS count
            today = _dt.date.today().isoformat()
            with get_db() as db:
                db.execute("""CREATE TABLE IF NOT EXISTS sms_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL, phone TEXT,
                    status TEXT DEFAULT 'sent',
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP)""")
                db.execute('INSERT INTO sms_log (date, phone) VALUES (?,?)', (today, phone[-10:]))
                daily_count = db.execute(
                    'SELECT COUNT(*) FROM sms_log WHERE date=?', (today,)
                ).fetchone()[0]

            # Warn at 35+ via WhatsApp
            wa_num = os.environ.get('WHATSAPP_BUSINESS_NUMBER', '')
            if daily_count >= 35 and wa_num:
                remaining = max(0, 38 - daily_count)
                msg = f'*SMS Limit Warning!*%0AOnly {remaining} free SMS remaining today.%0ADate: {today}%0AUpgrade fast2sms plan if needed.'
                print(f'SMS LIMIT WARNING ({daily_count}/38): https://wa.me/{wa_num}?text={msg}')

            api_key = os.environ.get('FAST2SMS_API_KEY', '')
            if api_key and daily_count <= 38:
                try:
                    url = 'https://www.fast2sms.com/dev/bulkV2'
                    params = _up.urlencode({
                        'authorization': api_key,
                        'variables_values': otp,
                        'route': 'otp',
                        'numbers': phone[-10:],
                    })
                    req = _ur.Request(f'{url}?{params}')
                    req.add_header('cache-control', 'no-cache')
                    with _ur.urlopen(req, timeout=10) as r:
                        r.read()
                    print(f'OTP sent to {phone}: {otp} | SMS count today: {daily_count}/38')
                    send_json(self, {'ok': True, 'sms_count': daily_count})
                except Exception as e:
                    print(f'SMS API error: {e} | OTP for {phone}: {otp}')
                    send_json(self, {'ok': True, 'sms_count': daily_count})
            elif daily_count > 38:
                print(f'[LIMIT REACHED] OTP for {phone}: {otp}')
                send_json(self, {'ok': True, 'sms_count': daily_count,
                                 'warning': 'Daily SMS limit reached. OTP shown in server terminal only.'})
            else:
                print(f'[DEV] OTP for {phone[-10:]}: {otp}  (add FAST2SMS_API_KEY to .env.local for real SMS)')
                send_json(self, {'ok': True, 'sms_count': 0})
            return

        elif path == '/api/otp/verify':
            import time
            phone = body.get('phone', '')
            otp   = body.get('otp', '')
            store = getattr(Handler, '_otp_store', {})
            entry = store.get(phone)
            if not entry:
                send_json(self, {'error': 'OTP not found. Please request a new one.'}, 400); return
            if time.time() > entry['expires']:
                del store[phone]
                send_json(self, {'error': 'OTP expired. Please request a new one.'}, 400); return
            if entry['otp'] != otp:
                send_json(self, {'error': 'Invalid OTP. Please try again.'}, 400); return
            del store[phone]
            send_json(self, {'ok': True})
            return

        elif path == '/api/otp/sms-stats':
            import datetime as _dt
            today = _dt.date.today().isoformat()
            with get_db() as db:
                try:
                    daily = db.execute(
                        'SELECT COUNT(*) FROM sms_log WHERE date=?', (today,)
                    ).fetchone()[0]
                    total = db.execute('SELECT COUNT(*) FROM sms_log').fetchone()[0]
                    send_json(self, {
                        'daily_count': daily,
                        'daily_limit': 38,
                        'remaining': max(0, 38 - daily),
                        'total_sent': total,
                        'date': today,
                        'warning': daily >= 35
                    })
                except:
                    send_json(self, {'daily_count': 0, 'daily_limit': 38, 'remaining': 38})
            return

        if path == '/api/razorpay/create-order':
            import urllib.request, urllib.error, base64, json as _json
            key_id     = os.environ.get('RAZORPAY_KEY_ID', '')
            key_secret = os.environ.get('RAZORPAY_KEY_SECRET', '')
            if not key_id or not key_secret:
                send_json(self, {'error': 'Razorpay keys not configured'}, 500); return
            amount   = int(body.get('amount', 0))   # in paise (INR * 100)
            currency = body.get('currency', 'INR')
            receipt  = body.get('receipt', 'order_1')
            payload  = _json.dumps({'amount': amount, 'currency': currency, 'receipt': receipt}).encode()
            creds    = base64.b64encode(f'{key_id}:{key_secret}'.encode()).decode()
            req = urllib.request.Request(
                'https://api.razorpay.com/v1/orders',
                data=payload, method='POST'
            )
            req.add_header('Authorization', f'Basic {creds}')
            req.add_header('Content-Type', 'application/json')
            try:
                with urllib.request.urlopen(req) as r:
                    order = _json.loads(r.read().decode())
                send_json(self, order, 201)
            except urllib.error.HTTPError as e:
                send_json(self, {'error': e.read().decode()}, 400)
            return

        elif path == '/api/razorpay/verify':
            import hmac, hashlib
            key_secret = os.environ.get('RAZORPAY_KEY_SECRET', '').encode()
            order_id   = body.get('razorpay_order_id', '')
            payment_id = body.get('razorpay_payment_id', '')
            signature  = body.get('razorpay_signature', '')
            msg        = f'{order_id}|{payment_id}'.encode()
            expected   = hmac.new(key_secret, msg, hashlib.sha256).hexdigest()
            if expected == signature:
                # Payment verified — save order to DB
                with get_db() as db:
                    db.execute("""
                        CREATE TABLE IF NOT EXISTS orders (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            order_id TEXT, payment_id TEXT, signature TEXT,
                            amount INTEGER, product_id INTEGER,
                            product_name TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
                        )""")
                    db.execute(
                        "INSERT OR IGNORE INTO orders (order_id,payment_id,signature,amount,product_id,product_name,customer_name,customer_email,customer_phone) VALUES (?,?,?,?,?,?,?,?,?)",
                        (order_id, payment_id, signature,
                         body.get('amount', 0), body.get('product_id', 0), body.get('product_name', ''),
                         body.get('customer_name', ''), body.get('customer_email', ''), body.get('customer_phone', ''))
                    )
                send_json(self, {'ok': True, 'payment_id': payment_id})
                # WhatsApp notification via wa.me link (logged server-side)
                wa_num = os.environ.get('WHATSAPP_BUSINESS_NUMBER', '')
                if wa_num:
                    msg = (f'New Order Received!%0A'
                           f'Product: {body.get("product_name","")}%0A'
                           f'Amount: Rs.{int(body.get("amount",0))//100}%0A'
                           f'Payment ID: {payment_id}')
                    print(f'  WhatsApp notify: https://wa.me/{wa_num}?text={msg}')
            else:
                send_json(self, {'error': 'Invalid signature'}, 400)
            return

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


        elif path == '/api/products':
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
                cols = [r[1] for r in db.execute('PRAGMA table_info(inquiries)').fetchall()]
                if 'customer_name' not in cols:
                    db.execute("ALTER TABLE inquiries ADD COLUMN customer_name  TEXT DEFAULT ''")
                    db.execute("ALTER TABLE inquiries ADD COLUMN customer_phone TEXT DEFAULT ''")
                    db.execute("ALTER TABLE inquiries ADD COLUMN occasion       TEXT DEFAULT ''")
                    db.execute("ALTER TABLE inquiries ADD COLUMN message        TEXT DEFAULT ''")
                    db.execute("ALTER TABLE inquiries ADD COLUMN type           TEXT DEFAULT 'product'")
                db.execute(
                    "INSERT INTO inquiries (product_id,product_name,category,price,customer_name,customer_phone,occasion,message,type) "
                    "VALUES (?,?,?,?,?,?,?,?,?)",
                    (body.get('product_id'), body.get('product_name',''),
                     body.get('category',''), body.get('price',0),
                     body.get('customer_name',''), body.get('customer_phone',''),
                     body.get('occasion',''), body.get('message',''),
                     body.get('type','product'))
                )
            send_json(self, {'ok':True}, 201)

        elif path == '/api/orders/attempt':
            with get_db() as db:
                # Migrate if needed
                cols = [r[1] for r in db.execute('PRAGMA table_info(orders)').fetchall()]
                if 'status' not in cols:
                    db.execute("ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'paid'")
                    db.execute("ALTER TABLE orders ADD COLUMN error_reason TEXT DEFAULT ''")
                    db.execute("ALTER TABLE orders ADD COLUMN error_desc   TEXT DEFAULT ''")
                db.execute(
                    "INSERT INTO orders (order_id,payment_id,amount,product_id,product_name,"
                    "customer_name,customer_email,customer_phone,status,error_reason,error_desc) "
                    "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    (body.get('order_id',''), body.get('payment_id',''),
                     body.get('amount',0), body.get('product_id',0),
                     body.get('product_name',''), body.get('customer_name',''),
                     body.get('customer_email',''), body.get('customer_phone',''),
                     body.get('status','failed'), body.get('error_reason',''),
                     body.get('error_desc',''))
                )
            send_json(self, {'ok': True}, 201)
            return
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
        # Inject Razorpay public key into HTML pages at serve-time
        # so it never needs to be hardcoded in source files
        if ext == '.html':
            rzp_key = os.environ.get('RAZORPAY_KEY_ID', '')
            injection = f'<script>window.__RAZORPAY_KEY="{rzp_key}";</script>'.encode()
            data = data.replace(b'</head>', injection + b'</head>', 1)
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
        # Migrate orders table if missing customer columns
        _ocols = [r[1] for r in _db.execute("PRAGMA table_info(orders)").fetchall()]
        if _ocols and 'customer_name' not in _ocols:
            _db.execute("ALTER TABLE orders ADD COLUMN customer_name  TEXT DEFAULT ''")
            _db.execute("ALTER TABLE orders ADD COLUMN customer_email TEXT DEFAULT ''")
            _db.execute("ALTER TABLE orders ADD COLUMN customer_phone TEXT DEFAULT ''")
            print("  Migrated: added customer columns to orders table")
        _db.execute("""
            CREATE TABLE IF NOT EXISTS wishlist_sessions (
                session_id  TEXT PRIMARY KEY,
                created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
                last_active TEXT DEFAULT CURRENT_TIMESTAMP
            )""")
        _db.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id       TEXT,
                payment_id     TEXT,
                signature      TEXT,
                amount         INTEGER,
                product_id     INTEGER,
                product_name   TEXT,
                customer_name  TEXT DEFAULT '',
                customer_email TEXT DEFAULT '',
                customer_phone TEXT DEFAULT '',
                status         TEXT DEFAULT 'paid',
                error_reason   TEXT DEFAULT '',
                error_desc     TEXT DEFAULT '',
                created_at     TEXT DEFAULT CURRENT_TIMESTAMP
            )""")
        _db.execute("""
            CREATE TABLE IF NOT EXISTS cart (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                product_id INTEGER NOT NULL,
                productId  TEXT DEFAULT '',
                name       TEXT DEFAULT '',
                price      INTEGER DEFAULT 0,
                img        TEXT DEFAULT '',
                qty        INTEGER DEFAULT 1,
                added_at   TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(session_id, product_id)
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
