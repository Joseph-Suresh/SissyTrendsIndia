"""
Run this once to apply all pending changes:
  python apply_changes.py

What it does:
  1. Patches api.py   — adds /api/db-download and /api/db-upload endpoints
  2. Patches main.js  — adds image swipe in quick-view modal
  3. Patches admin/index.html — adds Product ID column, search bar, subcategory checkboxes
  4. Creates Diya2.webp — duplicate of Diya.webp
"""
import os, re, shutil

BASE = os.path.dirname(os.path.abspath(__file__))

# ── 1. api.py ────────────────────────────────────────────────────
path = os.path.join(BASE, 'api.py')
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

if 'db-download' not in c:
    old = "        elif path == '/api/export/csv':"
    new = """        elif path == '/api/db-upload':
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

        elif path == '/api/export/csv':"""
    if old in c:
        c = c.replace(old, new, 1)
        with open(path, 'w', encoding='utf-8') as f: f.write(c)
        print('  + api.py: db-download + db-upload added')
    else:
        print('  ! api.py: anchor not found')
else:
    print('  - api.py: already patched')

# ── 2. js/main.js ────────────────────────────────────────────────
path = os.path.join(BASE, 'js', 'main.js')
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

changed = False

if 'modalImgSwiper' not in c:
    pat = re.compile(r'(<img id="modalImgEl"[^>]*/?>)\s*\n(\s*<div id="modalThumbRow")', re.DOTALL)
    def swiper(m):
        img = m.group(1).strip()
        return (
            '        <div id="modalImgSwiper" style="position:relative;overflow:hidden;min-height:320px"\n'
            '             ontouchstart="_swipeStart(event)" onmousedown="_swipeStart(event)">\n'
            '          ' + img + '\n'
            '          <button id="modalPrev" onclick="_modalNav(-1)" style="display:none;position:absolute;left:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.45);border:none;color:#fff;font-size:22px;width:36px;height:36px;cursor:pointer;border-radius:50%;z-index:2">&#8249;</button>\n'
            '          <button id="modalNext" onclick="_modalNav(1)" style="display:none;position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.45);border:none;color:#fff;font-size:22px;width:36px;height:36px;cursor:pointer;border-radius:50%;z-index:2">&#8250;</button>\n'
            '          <div id="modalDots" style="display:none;position:absolute;bottom:8px;left:50%;transform:translateX(-50%);gap:5px;z-index:2"></div>\n'
            '        </div>\n'
            '        ' + m.group(2).strip()
        )
    c, n = pat.subn(swiper, c, count=1)
    if n: changed = True; print('  + main.js: swipe HTML added')
    else: print('  ! main.js: modalImgEl not found')

if '_swipeStart' not in c:
    c += '''
// ── Modal image swipe / nav ──────────────────────────────────────
let _swipeX0 = null;
function _swipeStart(e) {
  _swipeX0 = e.touches ? e.touches[0].clientX : e.clientX;
  const up = ev => {
    if (_swipeX0 === null) return;
    const x1 = ev.changedTouches ? ev.changedTouches[0].clientX : ev.clientX;
    if (Math.abs(x1 - _swipeX0) > 40) _modalNav(x1 < _swipeX0 ? 1 : -1);
    _swipeX0 = null;
  };
  document.addEventListener(e.touches ? 'touchend' : 'mouseup', up, {once:true});
}
function _modalNav(dir) {
  if (!_modalProduct) return;
  const imgs = [_modalProduct.img,_modalProduct.img2,_modalProduct.img3,_modalProduct.img4].filter(Boolean);
  if (imgs.length < 2) return;
  _modalImgIndex = (_modalImgIndex + dir + imgs.length) % imgs.length;
  const el = document.getElementById('modalImgEl');
  if (el) { el.style.opacity='0'; el.style.transition='opacity .18s'; setTimeout(()=>{ el.src=imgs[_modalImgIndex]; el.style.opacity='1'; },160); }
  _updateModalDots(imgs.length);
}
function _updateModalDots(total) {
  const dots = document.getElementById('modalDots');
  if (!dots) return;
  if (total < 2) { dots.style.display='none'; return; }
  dots.style.display = 'flex';
  dots.innerHTML = Array.from({length:total},(_,i)=>
    `<div onclick="_modalNav(${i-_modalImgIndex})" style="width:7px;height:7px;border-radius:50%;cursor:pointer;background:${i===_modalImgIndex?'#fff':'rgba(255,255,255,.35)'};transition:background .2s"></div>`
  ).join('');
}
'''
    changed = True; print('  + main.js: swipe JS functions added')

if '// Show/hide nav arrows' not in c and '_modalImgIndex = 0;' in c:
    c = c.replace('  _modalImgIndex = 0;',
        '''  _modalImgIndex = 0;
  setTimeout(() => {
    const _imgs = [product.img,product.img2,product.img3,product.img4].filter(Boolean);
    const prev = document.getElementById('modalPrev');
    const next = document.getElementById('modalNext');
    // Show/hide nav arrows and update dots
    if (prev) prev.style.display = _imgs.length > 1 ? 'flex' : 'none';
    if (next) next.style.display = _imgs.length > 1 ? 'flex' : 'none';
    if (typeof _updateModalDots === 'function') _updateModalDots(_imgs.length);
  }, 60);''', 1)
    changed = True; print('  + main.js: openModal arrow/dot init added')

if changed:
    with open(path, 'w', encoding='utf-8') as f: f.write(c)
else:
    print('  - main.js: already patched')

# ── 3. admin/index.html ──────────────────────────────────────────
path = os.path.join(BASE, 'admin', 'index.html')
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

changed = False

if 'productSearchInput' not in c:
    old = re.compile(
        r'<div class="table-wrap">\s*<table class="product-table">\s*'
        r'<thead><tr><th>Image</th><th>Name</th><th>Category</th>'
        r'<th>Subcategory</th><th>Badge</th><th>Price</th><th>Actions</th></tr></thead>'
    )
    new = '''<!-- Search + Subcategory filter -->
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;align-items:flex-start">
      <input type="text" id="productSearchInput" placeholder="Search by name or product ID\u2026"
        oninput="applyFilters()"
        style="flex:1;min-width:200px;padding:9px 14px;background:rgba(250,245,236,.05);
               border:1px solid rgba(201,162,78,.25);color:#faf5ec;
               font-family:'Jost',sans-serif;font-size:12px;outline:none"/>
      <div style="position:relative">
        <button onclick="toggleSubcatDropdown()"
          style="padding:9px 16px;background:rgba(250,245,236,.05);border:1px solid rgba(201,162,78,.25);
                 color:#c9a24e;font-family:'Jost',sans-serif;font-size:11px;cursor:pointer;
                 letter-spacing:.1em;text-transform:uppercase">Subcategory \u25be</button>
        <div id="subcatDropdown"
          style="display:none;position:absolute;top:100%;left:0;z-index:100;min-width:220px;
                 background:#1a0a06;border:1px solid rgba(201,162,78,.25);padding:12px;
                 box-shadow:0 8px 32px rgba(0,0,0,.4)">
          <div style="font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:rgba(201,162,78,.5);margin-bottom:8px">Filter by Subcategory</div>
          <label style="display:flex;align-items:center;gap:8px;padding:5px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="soft-silk"            onchange="applyFilters()" style="accent-color:#c9a24e"> Soft Silk</label>
          <label style="display:flex;align-items:center;gap:8px;padding:5px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="Maheswari Silk Cotton" onchange="applyFilters()" style="accent-color:#c9a24e"> Maheswari Silk Cotton</label>
          <label style="display:flex;align-items:center;gap:8px;padding:5px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="Fancy Silk"            onchange="applyFilters()" style="accent-color:#c9a24e"> Fancy Silk</label>
          <label style="display:flex;align-items:center;gap:8px;padding:5px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="Cool Cotton"           onchange="applyFilters()" style="accent-color:#c9a24e"> Cool Cotton</label>
          <label style="display:flex;align-items:center;gap:8px;padding:5px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="cotton-linen"          onchange="applyFilters()" style="accent-color:#c9a24e"> Cotton &amp; Linen</label>
          <label style="display:flex;align-items:center;gap:8px;padding:5px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="necklace-sets"         onchange="applyFilters()" style="accent-color:#c9a24e"> Necklace Sets</label>
          <label style="display:flex;align-items:center;gap:8px;padding:5px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="earrings"              onchange="applyFilters()" style="accent-color:#c9a24e"> Earrings</label>
          <label style="display:flex;align-items:center;gap:8px;padding:5px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="full-sets"             onchange="applyFilters()" style="accent-color:#c9a24e"> Full Sets</label>
          <label style="display:flex;align-items:center;gap:8px;padding:5px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="bridal"                onchange="applyFilters()" style="accent-color:#c9a24e"> Bridal Collection</label>
          <label style="display:flex;align-items:center;gap:8px;padding:5px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="diyas"                 onchange="applyFilters()" style="accent-color:#c9a24e"> Diyas &amp; Lamps</label>
          <label style="display:flex;align-items:center;gap:8px;padding:5px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="gifting"               onchange="applyFilters()" style="accent-color:#c9a24e"> Gifting</label>
          <button onclick="clearSubcatFilter()"
            style="margin-top:10px;width:100%;padding:6px;background:none;border:1px solid rgba(201,162,78,.2);
                   color:rgba(201,162,78,.6);font-family:'Jost',sans-serif;font-size:10px;cursor:pointer">Clear Filter</button>
        </div>
      </div>
    </div>
    <div class="table-wrap">
      <table class="product-table">
        <thead><tr><th>Image</th><th>Product ID</th><th>Name</th><th>Category</th><th>Subcategory</th><th>Badge</th><th>Price</th><th>Actions</th></tr></thead>'''
    c, n = old.subn(new, c, count=1)
    if n: changed = True; print('  + admin: search/filter/Product ID header added')
    else: print('  ! admin: table-wrap not matched')

if 'colspan="7"' in c and 'colspan="8"' not in c:
    old2 = '''function renderProductsTable(filter) {
  let products = getProducts();
  if (filter !== 'all') products = products.filter(p => p.category === filter);
  document.getElementById('productsTableBody').innerHTML = products.length === 0
    ? `<tr><td colspan="7" style="text-align:center;padding:40px;color:rgba(250,245,236,.3);font-style:italic">No products found.</td></tr>`
    : products.map(p => `
      <tr>
        <td><img src="${resolveImg(p.img)}" alt="${p.name}" onerror="this.parentElement.style.background='linear-gradient(135deg,#2D2520,#8B7355)';this.style.display='none'"/></td>
        <td style="color:#faf5ec;font-weight:500;max-width:160px">${p.name}</td>
        <td><span class="badge-pill">${p.category}</span></td>
        <td style="color:rgba(201,162,78,.6);font-size:12px">${p.subcategory || '—'}</td>
        <td style="color:rgba(250,245,236,.5)">${p.badge}</td>
        <td style="color:#c9a24e;font-weight:600">₹${p.price.toLocaleString()}</td>
        <td>
          <button class="btn-edit"   onclick="editProduct(${p.id})">Edit</button>
          <button class="btn-delete" onclick="deleteProduct(${p.id})">Delete</button>
        </td>
      </tr>`).join('');
}'''
    new2 = '''function renderProductsTable(filter, products_override) {
  let products = products_override !== undefined ? products_override : getProducts();
  if (!products_override && filter !== 'all') products = products.filter(p => p.category === filter);
  document.getElementById('productsTableBody').innerHTML = products.length === 0
    ? `<tr><td colspan="8" style="text-align:center;padding:40px;color:rgba(250,245,236,.3);font-style:italic">No products found.</td></tr>`
    : products.map(p => `
      <tr>
        <td><img src="${resolveImg(p.img)}" alt="${p.name}" onerror="this.parentElement.style.background='linear-gradient(135deg,#2D2520,#8B7355)';this.style.display='none'"/></td>
        <td style="color:#c9a24e;font-size:11px;letter-spacing:.05em;font-weight:500">${p.productId||'—'}</td>
        <td style="color:#faf5ec;font-weight:500;max-width:140px">${p.name}</td>
        <td><span class="badge-pill">${p.category}</span></td>
        <td style="color:rgba(201,162,78,.6);font-size:12px">${p.subcategory || '—'}</td>
        <td style="color:rgba(250,245,236,.5)">${p.badge}</td>
        <td style="color:#c9a24e;font-weight:600">&#8377;${p.price.toLocaleString()}</td>
        <td>
          <button class="btn-edit"   onclick="editProduct(${p.id})">Edit</button>
          <button class="btn-delete" onclick="deleteProduct(${p.id})">Delete</button>
        </td>
      </tr>`).join('');
}

function applyFilters() {
  const q = (document.getElementById('productSearchInput')?.value||'').toLowerCase().trim();
  const checked = [...document.querySelectorAll('#subcatDropdown input[type=checkbox]:checked')].map(c=>c.value);
  let products = getProducts();
  if (currentFilter !== 'all') products = products.filter(p => p.category === currentFilter);
  if (q) products = products.filter(p => p.name.toLowerCase().includes(q)||(p.productId||'').toLowerCase().includes(q));
  if (checked.length) products = products.filter(p => checked.includes(p.subcategory));
  renderProductsTable(currentFilter, products);
}
function toggleSubcatDropdown() {
  const dd = document.getElementById('subcatDropdown');
  if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}
document.addEventListener('click', e => {
  if (!e.target.closest('#subcatDropdown') && !e.target.matches('[onclick="toggleSubcatDropdown()"]')) {
    const dd = document.getElementById('subcatDropdown'); if (dd) dd.style.display = 'none';
  }
});
function clearSubcatFilter() {
  document.querySelectorAll('#subcatDropdown input[type=checkbox]').forEach(c=>c.checked=false);
  applyFilters();
}'''
    if old2 in c:
        c = c.replace(old2, new2, 1)
        changed = True; print('  + admin: renderProductsTable + filter functions updated')
    else:
        print('  ! admin: renderProductsTable exact match not found')

if changed:
    with open(path, 'w', encoding='utf-8') as f: f.write(c)
else:
    print('  - admin/index.html: already patched')

# ── 4. Diya2.webp ────────────────────────────────────────────────
src = os.path.join(BASE, 'Images', 'Decorative handcrafts', 'Diya.webp')
dst = os.path.join(BASE, 'Images', 'Decorative handcrafts', 'Diya2.webp')
if os.path.exists(src) and not os.path.exists(dst):
    shutil.copy2(src, dst)
    print('  + Diya2.webp created')
elif os.path.exists(dst):
    print('  - Diya2.webp already exists')
else:
    print('  ! Diya.webp source not found')

# ── 5. db_manager.py ─────────────────────────────────────────────
dm = os.path.join(BASE, 'db_manager.py')
if not os.path.exists(dm):
    with open(dm, 'w', encoding='utf-8') as f:
        f.write('''"""DB Manager — download/upload Render DB.
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
    print(f'Downloading from Render...')
    os.makedirs(os.path.dirname(LOCAL_DB), exist_ok=True)
    if os.path.exists(LOCAL_DB): shutil.copy2(LOCAL_DB, LOCAL_DB + '.bak')
    urllib.request.urlretrieve(url, LOCAL_DB)
    print(f'  Saved to {LOCAL_DB} ({os.path.getsize(LOCAL_DB):,} bytes)')
    print('Open in DB Browser, edit, then run: python db_manager.py upload')

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
''')
    print('  + db_manager.py created')

print('\nAll done! Now run:')
print('  git add .')
print('  git commit -m "Swipe modal, admin filters + product ID column, db manager, Diya2"')
print('  git push')
