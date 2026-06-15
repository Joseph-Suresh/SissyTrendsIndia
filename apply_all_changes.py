"""
Applies all pending changes to js/main.js and admin/index.html
Run: python apply_all_changes.py
"""
import os, re, shutil

BASE = os.path.dirname(os.path.abspath(__file__))

# ─── 1. js/main.js ───────────────────────────────────────────────
mjs_path = os.path.join(BASE, 'js', 'main.js')
with open(mjs_path, 'r', encoding='utf-8') as f:
    mjs = f.read()

changes = 0

# 1a. Add STORE_KEY if missing
if 'const STORE_KEY' not in mjs and 'const WISHLIST_KEY' in mjs:
    mjs = mjs.replace("const WISHLIST_KEY    = 'st_wishlist_items';",
                      "const STORE_KEY       = 'sissytrends_products_v3';\nconst WISHLIST_KEY    = 'st_wishlist_items';", 1)
    changes += 1; print('  + STORE_KEY added')

# 1b. Add swipe HTML to modal image
old_img = '        <img id="modalImgEl" src="" alt="" style="width:100%;height:100%;object-fit:cover;display:block;min-height:320px;cursor:zoom-in"\n             onclick="this.style.transform=this.style.transform?\'\':`scale(1.6)`;this.style.transition=\'transform .3s\'" title="Tap to zoom"/>\n        <div id="modalThumbRow" style="display:none;gap:6px;padding:10px;position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.6));overflow-x:auto"></div>'
new_img = '''        <div id="modalImgSwiper" style="position:relative;overflow:hidden;min-height:320px"
             ontouchstart="_swipeStart(event)" onmousedown="_swipeStart(event)">
          <img id="modalImgEl" src="" alt="" style="width:100%;height:100%;object-fit:cover;display:block;min-height:320px;cursor:zoom-in;user-select:none"
               onclick="this.style.transform=this.style.transform?\'\':`scale(1.6)`;this.style.transition=\'transform .3s\'" title="Tap to zoom"/>
          <button id="modalPrev" onclick="_modalNav(-1)" style="display:none;position:absolute;left:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.45);border:none;color:#fff;font-size:22px;width:36px;height:36px;cursor:pointer;border-radius:50%;z-index:2;align-items:center;justify-content:center">&#8249;</button>
          <button id="modalNext" onclick="_modalNav(1)"  style="display:none;position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.45);border:none;color:#fff;font-size:22px;width:36px;height:36px;cursor:pointer;border-radius:50%;z-index:2;align-items:center;justify-content:center">&#8250;</button>
          <div id="modalDots" style="display:none;position:absolute;bottom:8px;left:50%;transform:translateX(-50%);gap:5px;z-index:2"></div>
        </div>
        <div id="modalThumbRow" style="display:none;gap:6px;padding:10px;position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.6));overflow-x:auto"></div>'''

if 'modalImgSwiper' not in mjs:
    # Try flexible match
    pat = re.compile(
        r'(<img id="modalImgEl"[^/]*/>\s*)'
        r'(<div id="modalThumbRow"[^>]*></div>)',
        re.DOTALL
    )
    def swiper_replace(m):
        return '''        <div id="modalImgSwiper" style="position:relative;overflow:hidden;min-height:320px"
             ontouchstart="_swipeStart(event)" onmousedown="_swipeStart(event)">
          ''' + m.group(1).strip() + '''
          <button id="modalPrev" onclick="_modalNav(-1)" style="display:none;position:absolute;left:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.45);border:none;color:#fff;font-size:22px;width:36px;height:36px;cursor:pointer;border-radius:50%;z-index:2">&#8249;</button>
          <button id="modalNext" onclick="_modalNav(1)"  style="display:none;position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.45);border:none;color:#fff;font-size:22px;width:36px;height:36px;cursor:pointer;border-radius:50%;z-index:2">&#8250;</button>
          <div id="modalDots" style="display:none;position:absolute;bottom:8px;left:50%;transform:translateX(-50%);gap:5px;z-index:2"></div>
        </div>
        ''' + m.group(2)
    mjs, n = pat.subn(swiper_replace, mjs, count=1)
    if n: changes += 1; print('  + Modal swipe HTML added')
    else: print('  ! Modal img pattern not found')

# 1c. Add swipe JS + _modalNav + _updateModalDots
if '_swipeStart' not in mjs:
    swipe_js = '''
// ── Modal image swipe / nav ──────────────────────────────────────
let _swipeX0 = null;
function _swipeStart(e) {
  _swipeX0 = e.touches ? e.touches[0].clientX : e.clientX;
  const up = ev => {
    if (_swipeX0 === null) return;
    const x1 = ev.changedTouches ? ev.changedTouches[0].clientX : ev.clientX;
    if (Math.abs(x1 - _swipeX0) > 40) _modalNav(x1 < _swipeX0 ? 1 : -1);
    _swipeX0 = null;
    document.removeEventListener('mouseup', up);
    document.removeEventListener('touchend', up);
  };
  document.addEventListener(e.touches ? 'touchend' : 'mouseup', up, {once:true});
}
function _modalNav(dir) {
  if (!_modalProduct) return;
  const imgs = [_modalProduct.img,_modalProduct.img2,_modalProduct.img3,_modalProduct.img4].filter(Boolean);
  if (imgs.length < 2) return;
  _modalImgIndex = (_modalImgIndex + dir + imgs.length) % imgs.length;
  const el = document.getElementById('modalImgEl');
  if (el) {
    el.style.transition = 'opacity .18s';
    el.style.opacity = '0';
    setTimeout(() => { el.src = imgs[_modalImgIndex]; el.style.opacity = '1'; }, 160);
  }
  _updateModalDots(imgs.length);
}
function _updateModalDots(total) {
  const dots = document.getElementById('modalDots');
  if (!dots) return;
  if (total < 2) { dots.style.display = 'none'; return; }
  dots.style.display = 'flex';
  dots.innerHTML = Array.from({length:total},(_,i) =>
    `<div onclick="_modalNav(${i-_modalImgIndex})" style="width:7px;height:7px;border-radius:50%;cursor:pointer;background:${i===_modalImgIndex?'#fff':'rgba(255,255,255,.35)'};transition:background .2s"></div>`
  ).join('');
}
'''
    # Insert before injectNav or at end
    if '// ── Nav inject' in mjs:
        mjs = mjs.replace('// ── Nav inject', swipe_js + '\n// ── Nav inject', 1)
    else:
        mjs += '\n' + swipe_js
    changes += 1; print('  + Swipe JS functions added')

# 1d. Show arrows/dots on openModal
old_idx = '  _modalImgIndex = 0;'
new_idx = '''  _modalImgIndex = 0;
  setTimeout(() => {
    const _imgs = [product.img,product.img2,product.img3,product.img4].filter(Boolean);
    const prev = document.getElementById('modalPrev');
    const next = document.getElementById('modalNext');
    if (prev) prev.style.display = _imgs.length > 1 ? 'flex' : 'none';
    if (next) next.style.display = _imgs.length > 1 ? 'flex' : 'none';
    _updateModalDots(_imgs.length);
  }, 60);'''
if '_updateModalDots' not in mjs.split('function openModal')[0] and old_idx in mjs:
    mjs = mjs.replace(old_idx, new_idx, 1)
    changes += 1; print('  + openModal updated for arrows/dots')

with open(mjs_path, 'w', encoding='utf-8') as f:
    f.write(mjs)
print(f'  js/main.js: {changes} change(s)')

# ─── 2. admin/index.html ─────────────────────────────────────────
adm_path = os.path.join(BASE, 'admin', 'index.html')
with open(adm_path, 'r', encoding='utf-8') as f:
    adm = f.read()

adm_changes = 0

# 2a. Add search + subcategory filter + Product ID column
if 'productSearchInput' not in adm:
    old_tw = re.compile(
        r'<div class="table-wrap">\s*<table class="product-table">\s*'
        r'<thead><tr><th>Image</th><th>Name</th><th>Category</th><th>Subcategory</th>'
        r'<th>Badge</th><th>Price</th><th>Actions</th></tr></thead>'
    )
    new_tw = '''<!-- Search + Subcategory filter -->
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
                 letter-spacing:.1em;text-transform:uppercase">
          Subcategory \u25be
        </button>
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

    adm, n = old_tw.subn(new_tw, adm, count=1)
    if n: adm_changes += 1; print('  + Search/filter/Product ID column added to admin')
    else: print('  ! table-wrap pattern not matched')

# 2b. Update renderProductsTable to show productId column + accept override
if 'applyFilters' not in adm:
    old_rt = re.compile(
        r'function renderProductsTable\(filter\) \{.*?'
        r'document\.getElementById\(\'productsTableBody\'\)\.innerHTML = products\.length === 0.*?\}\)',
        re.DOTALL
    )
    new_rt = '''function renderProductsTable(filter, products_override) {
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
      </tr>`).join('')}

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
    const dd = document.getElementById('subcatDropdown');
    if (dd) dd.style.display = 'none';
  }
});
function clearSubcatFilter() {
  document.querySelectorAll('#subcatDropdown input[type=checkbox]').forEach(c=>c.checked=false);
  applyFilters();
}'''
    adm, n = old_rt.subn(new_rt, adm, count=1)
    if n: adm_changes += 1; print('  + renderProductsTable + applyFilters added')
    else: print('  ! renderProductsTable pattern not matched')

with open(adm_path, 'w', encoding='utf-8') as f:
    f.write(adm)
print(f'  admin/index.html: {adm_changes} change(s)')

# ─── 3. Copy Diya2.webp ──────────────────────────────────────────
src = os.path.join(BASE, 'Images', 'Decorative handcrafts', 'Diya.webp')
dst = os.path.join(BASE, 'Images', 'Decorative handcrafts', 'Diya2.webp')
if os.path.exists(src) and not os.path.exists(dst):
    shutil.copy2(src, dst)
    print('  + Diya2.webp created')
elif os.path.exists(dst):
    print('  - Diya2.webp already exists')
else:
    print('  ! Diya.webp not found')

print('\nAll done. Now run: git add . && git commit -m "Swipe, admin filters, Diya2" && git push')
