"""
SissyTrends — Render Manager
Manage your live Render server without redeploying.

Usage:
  python db_manager.py backup
      Download orders & inquiries from Render as CSV files (saved locally)
      Run this BEFORE every git push to preserve transaction data

  python db_manager.py download
      Pull live DB from Render to data/sissytrends.db

  python db_manager.py upload
      Push local data/sissytrends.db to Render (live immediately)

  python db_manager.py csv <file_path> [mode]
      Upload a CSV to Render and import into DB instantly
      mode: add (default) — insert new + update existing
            replace       — wipe table first, then import all
      Examples:
        python db_manager.py csv "products_CSVBasic.csv"
        python db_manager.py csv "products_CSVBasic.csv" replace

  python db_manager.py image <file_path> [folder]
      Upload a single image to Render instantly
      folder defaults to SareeImages
      Examples:
        python db_manager.py image "Images/SareeImages/SAR-033_pose1.jpeg"
        python db_manager.py image "Images/SareeImages/SAR-033_pose1.jpeg" SareeImages
        python db_manager.py image "Images/Imitation jewels/JWL-001.jpeg" "Imitation jewels"

  python db_manager.py images <folder_path> [render_folder]
      Upload ALL images in a local folder to Render at once
      Examples:
        python db_manager.py images "Images/SareeImages"
        python db_manager.py images "C:/Users/joesu/Pictures/NewSarees" SareeImages
"""
import sys, os, urllib.request, shutil, urllib.parse

BASE       = os.path.dirname(os.path.abspath(__file__))
LOCAL_DB   = os.path.join(BASE, 'data', 'sissytrends.db')
RENDER_URL = 'https://sissytrendsindia.onrender.com'
SECRET_KEY = 'sissy-db-2025'
IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}

# ── Backup orders & inquiries ────────────────────────────────────
def backup():
    import csv, json, datetime, sqlite3
    print('Downloading live DB for backup...')
    # Download DB first
    url = f'{RENDER_URL}/api/db-download?key={SECRET_KEY}'
    tmp = os.path.join(BASE, 'data', 'sissytrends_backup.db')
    os.makedirs(os.path.dirname(tmp), exist_ok=True)
    urllib.request.urlretrieve(url, tmp)
    conn = sqlite3.connect(tmp)
    conn.row_factory = sqlite3.Row
    stamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_dir = os.path.join(BASE, 'data', 'backups')
    os.makedirs(backup_dir, exist_ok=True)
    tables = {'orders': [], 'inquiries': []}
    for table in tables:
        try:
            rows = conn.execute(f'SELECT * FROM {table} ORDER BY created_at DESC').fetchall()
            tables[table] = [dict(r) for r in rows]
        except: pass
    conn.close()
    os.remove(tmp)
    # Save as CSV
    for table, rows in tables.items():
        if not rows: print(f'  {table}: empty'); continue
        fpath = os.path.join(backup_dir, f'{table}_{stamp}.csv')
        with open(fpath, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys(), delimiter=';')
            writer.writeheader()
            writer.writerows(rows)
        print(f'  {table}: {len(rows)} rows saved → {fpath}')
    # Save combined JSON
    jpath = os.path.join(backup_dir, f'backup_{stamp}.json')
    with open(jpath, 'w', encoding='utf-8') as f:
        json.dump(tables, f, indent=2, default=str)
    print(f'  JSON backup → {jpath}')
    print(f'\nBackup complete. {sum(len(v) for v in tables.values())} total records saved.')
    print('Safe to git push now.')

# ── DB download ───────────────────────────────────────────────────
def download():
    url = f'{RENDER_URL}/api/db-download?key={SECRET_KEY}'
    print('Downloading DB from Render...')
    os.makedirs(os.path.dirname(LOCAL_DB), exist_ok=True)
    if os.path.exists(LOCAL_DB):
        shutil.copy2(LOCAL_DB, LOCAL_DB + '.bak')
        print('  Backed up existing DB to sissytrends.db.bak')
    urllib.request.urlretrieve(url, LOCAL_DB)
    print(f'  Saved: {LOCAL_DB} ({os.path.getsize(LOCAL_DB):,} bytes)')
    print('\nEdit in DB Browser then run: python db_manager.py upload')

# ── DB upload ─────────────────────────────────────────────────────
def upload():
    if not os.path.exists(LOCAL_DB):
        print('ERROR: No local DB found. Run download first.'); return
    url = f'{RENDER_URL}/api/db-upload?key={SECRET_KEY}'
    with open(LOCAL_DB, 'rb') as f: data = f.read()
    print(f'Uploading DB ({len(data):,} bytes) to Render...')
    req = urllib.request.Request(url, data=data, method='POST')
    req.add_header('Content-Type', 'application/octet-stream')
    req.add_header('Content-Length', str(len(data)))
    try:
        with urllib.request.urlopen(req) as r:
            print('SUCCESS:', r.read().decode())
            print('DB is live on Render immediately.')
    except urllib.error.HTTPError as e:
        print('ERROR:', e.read().decode())

# ── CSV upload → DB import ───────────────────────────────────────
def upload_csv(filepath, mode='add'):
    filepath = os.path.abspath(filepath)
    if not os.path.exists(filepath):
        print(f'ERROR: File not found: {filepath}'); return
    if not filepath.lower().endswith('.csv'):
        print(f'ERROR: Not a CSV file: {filepath}'); return
    url = f'{RENDER_URL}/api/upload-csv?key={SECRET_KEY}&mode={mode}'
    with open(filepath, 'rb') as f: data = f.read()
    print(f'Uploading {os.path.basename(filepath)} ({len(data):,} bytes) to Render DB (mode={mode})...')
    req = urllib.request.Request(url, data=data, method='POST')
    req.add_header('Content-Type', 'text/csv; charset=utf-8')
    req.add_header('Content-Length', str(len(data)))
    try:
        with urllib.request.urlopen(req) as r:
            result = r.read().decode()
            print(f'  SUCCESS: {result}')
    except urllib.error.HTTPError as e:
        print(f'  ERROR {e.code}: {e.read().decode()}')
    except Exception as e:
        print(f'  ERROR: {e}')

# ── Single image upload ───────────────────────────────────────────
def upload_image(filepath, render_folder='SareeImages'):
    filepath = os.path.abspath(filepath)
    if not os.path.exists(filepath):
        print(f'ERROR: File not found: {filepath}'); return False
    ext = os.path.splitext(filepath)[1].lower()
    if ext not in IMAGE_EXTS:
        print(f'ERROR: Not a supported image file: {filepath}'); return False
    filename       = os.path.basename(filepath)
    encoded_file   = urllib.parse.quote(filename)
    encoded_folder = urllib.parse.quote(render_folder)
    url = f'{RENDER_URL}/api/upload-image?key={SECRET_KEY}&file={encoded_file}&folder={encoded_folder}'
    with open(filepath, 'rb') as f: data = f.read()
    print(f'Uploading {filename} ({len(data):,} bytes) -> /Images/{render_folder}/')
    req = urllib.request.Request(url, data=data, method='POST')
    req.add_header('Content-Type', 'application/octet-stream')
    req.add_header('Content-Length', str(len(data)))
    try:
        with urllib.request.urlopen(req) as r:
            print(f'  SUCCESS: {r.read().decode()}')
            return True
    except urllib.error.HTTPError as e:
        print(f'  ERROR {e.code}: {e.read().decode()}')
        return False
    except Exception as e:
        print(f'  ERROR: {e}')
        return False

# ── Bulk folder upload ────────────────────────────────────────────
def upload_images_folder(local_folder, render_folder='SareeImages'):
    local_folder = os.path.abspath(local_folder)
    if not os.path.isdir(local_folder):
        print(f'ERROR: Folder not found: {local_folder}'); return
    files = sorted([f for f in os.listdir(local_folder)
                    if os.path.splitext(f)[1].lower() in IMAGE_EXTS])
    if not files:
        print(f'No image files found in: {local_folder}'); return
    print(f'Found {len(files)} image(s) — uploading to /Images/{render_folder}/\n')
    ok = fail = 0
    for fname in files:
        if upload_image(os.path.join(local_folder, fname), render_folder):
            ok += 1
        else:
            fail += 1
    print(f'\nDone. {ok} uploaded successfully, {fail} failed.')

# ── Entry point ───────────────────────────────────────────────────
if __name__ == '__main__':
    args = sys.argv[1:]
    cmd  = args[0] if args else ''

    if   cmd == 'download': download()
    elif cmd == 'upload':   upload()
    elif cmd == 'backup':   backup()
    elif cmd == 'csv':
        if len(args) < 2: print('Usage: python db_manager.py csv <file_path> [add|replace]')
        else: upload_csv(args[1], args[2] if len(args) > 2 else 'add')
    elif cmd == 'image':
        if len(args) < 2:
            print('Usage: python db_manager.py image <file_path> [render_folder]')
        else:
            upload_image(args[1], args[2] if len(args) > 2 else 'SareeImages')
    elif cmd == 'images':
        if len(args) < 2:
            print('Usage: python db_manager.py images <local_folder> [render_folder]')
        else:
            upload_images_folder(args[1], args[2] if len(args) > 2 else 'SareeImages')
    else:
        print(__doc__)
