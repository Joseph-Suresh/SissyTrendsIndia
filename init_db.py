"""
SissyTrends - Database Initialiser
Run once (or after deleting the DB) to create tables and seed products from CSV.
"""
import sqlite3, os, csv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH  = os.path.join(BASE_DIR, 'data', 'sissytrends.db')
CSV_PATH = os.path.join(BASE_DIR, 'products_CSVBasic.csv')

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS products (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        productId   TEXT    UNIQUE NOT NULL,
        available   INTEGER NOT NULL DEFAULT 1,
        name        TEXT    NOT NULL,
        category    TEXT    NOT NULL,
        subcategory TEXT    DEFAULT '',
        fabric      TEXT    DEFAULT '',
        price       INTEGER NOT NULL DEFAULT 0,
        badge       TEXT    DEFAULT '',
        occasion    TEXT    DEFAULT '',
        img         TEXT    DEFAULT '',
        img2        TEXT,
        img3        TEXT,
        img4        TEXT,
        desc        TEXT    DEFAULT '',
        created_at  TEXT    DEFAULT CURRENT_TIMESTAMP,
        updated_at  TEXT    DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wishlist (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT    NOT NULL DEFAULT 'anonymous',
        product_id INTEGER NOT NULL,
        productId  TEXT    DEFAULT '',
        name       TEXT    DEFAULT '',
        price      INTEGER DEFAULT 0,
        img        TEXT    DEFAULT '',
        badge      TEXT    DEFAULT '',
        added_at   TEXT    DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, product_id)
    );
    CREATE TABLE IF NOT EXISTS wishlist_sessions (
        session_id  TEXT PRIMARY KEY,
        created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
        last_active TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS analytics (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type   TEXT NOT NULL,
        product_id   INTEGER,
        product_name TEXT DEFAULT '',
        created_at   TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS recently_viewed (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER UNIQUE,
        name       TEXT DEFAULT '',
        img        TEXT DEFAULT '',
        price      INTEGER DEFAULT 0,
        category   TEXT DEFAULT '',
        viewed_at  TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS inquiries (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id   INTEGER,
        product_name TEXT DEFAULT '',
        category     TEXT DEFAULT '',
        price        INTEGER DEFAULT 0,
        created_at   TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    existing = {r[0] for r in conn.execute("SELECT productId FROM products").fetchall()}
    added = 0

    # Seed from CSV if available
    if os.path.exists(CSV_PATH):
        try:
            with open(CSV_PATH, encoding='cp1252') as f:
                reader = csv.DictReader(f, delimiter=';')
                for row in reader:
                    pid = row.get('productId', '').strip()
                    if not pid or pid in existing:
                        continue
                    conn.execute(
                        "INSERT INTO products "
                        "(productId,available,name,category,subcategory,fabric,"
                        "price,badge,occasion,img,img2,img3,img4,desc) "
                        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (
                            pid,
                            1 if str(row.get('available','1')).strip() in ('1','true','True') else 0,
                            row.get('name','').strip(),
                            row.get('category','').strip(),
                            row.get('subcategory','').strip() or None,
                            row.get('fabric','').strip() or None,
                            int(row.get('price', 0) or 0),
                            row.get('badge','').strip() or None,
                            row.get('occasion','').strip() or None,
                            row.get('img','').strip() or None,
                            row.get('img2','').strip() or None,
                            row.get('img3','').strip() or None,
                            row.get('img4','').strip() or None,
                            row.get('desc','').strip() or None,
                        )
                    )
                    added += 1
            print(f"  Seeded {added} products from {CSV_PATH}")
        except Exception as e:
            print(f"  Warning: could not seed from CSV — {e}")
    else:
        print(f"  Note: {CSV_PATH} not found, skipping seed.")

    conn.commit()
    total = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    conn.close()
    print(f"  DB ready: {DB_PATH}")
    print(f"  Products: {total} total")

if __name__ == '__main__':
    init_db()
    print("Done. Run  python api.py  (or start.bat) to start the server.")
