"""DB Manager
Usage:
  python db_manager.py download
  python db_manager.py upload
"""
import sys, os, urllib.request, shutil
BASE       = os.path.dirname(os.path.abspath(__file__))
LOCAL_DB   = os.path.join(BASE, 'data', 'sissytrends.db')
RENDER_URL = 'https://sissytrendsindia.onrender.com'
SECRET_KEY = 'sissy-db-2025'

def download():
    url = f'{RENDER_URL}/api/db-download?key={SECRET_KEY}'
    print('Downloading from Render...')
    os.makedirs(os.path.dirname(LOCAL_DB), exist_ok=True)
    if os.path.exists(LOCAL_DB): shutil.copy2(LOCAL_DB, LOCAL_DB + '.bak')
    urllib.request.urlretrieve(url, LOCAL_DB)
    print(f'  Saved: {LOCAL_DB} ({os.path.getsize(LOCAL_DB):,} bytes)')
    print('Edit in DB Browser then run: python db_manager.py upload')

def upload():
    if not os.path.exists(LOCAL_DB): print('ERROR: run download first'); return
    url = f'{RENDER_URL}/api/db-upload?key={SECRET_KEY}'
    with open(LOCAL_DB, 'rb') as f: data = f.read()
    print(f'Uploading {len(data):,} bytes...')
    req = urllib.request.Request(url, data=data, method='POST')
    req.add_header('Content-Type', 'application/octet-stream')
    req.add_header('Content-Length', str(len(data)))
    try:
        with urllib.request.urlopen(req) as r: print('SUCCESS:', r.read().decode())
    except urllib.error.HTTPError as e: print('ERROR:', e.read().decode())

if __name__ == '__main__':
    {'download': download, 'upload': upload}.get(sys.argv[1] if len(sys.argv)>1 else '', lambda: print(__doc__))()
