"""
Patches admin/index.html with:
- Search box + Search button on the same row as category tabs
- Category filter dropdown on Category column header
- Subcategory filter dropdown on Subcategory column header  
- Added Date column with ascending/descending sort
Run: python patch_admin_table.py
"""
import os, re, shutil

BASE = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(BASE, 'admin', 'index.html')
shutil.copy2(path, path + '.bak')

with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

changes = 0

# ── 1. Replace thead with new column headers ──────────────────────
old_thead = re.compile(
    r'<thead>\s*<tr>\s*<th>Image</th>.*?</tr>\s*</thead>',
    re.DOTALL
)
new_thead = '''<thead>
          <tr>
            <th>Image</th>
            <th>Product ID</th>
            <th>Name</th>
            <th style="position:relative;white-space:nowrap">
              Category <span onclick="toggleColDropdown('catDrop')" style="cursor:pointer;color:#c9a24e;font-size:10px">&#9660;</span>
              <div id="catDrop" style="display:none;position:absolute;top:100%;left:0;z-index:200;min-width:150px;background:#1a0a06;border:1px solid rgba(201,162,78,.25);padding:10px;box-shadow:0 8px 24px rgba(0,0,0,.5)">
                <div style="font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:rgba(201,162,78,.5);margin-bottom:6px">Filter</div>
                <label style="display:flex;gap:8px;padding:4px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="sarees"    onchange="applyFilters()" style="accent-color:#c9a24e"> Sarees</label>
                <label style="display:flex;gap:8px;padding:4px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="jewellery" onchange="applyFilters()" style="accent-color:#c9a24e"> Jewellery</label>
                <label style="display:flex;gap:8px;padding:4px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="decor"     onchange="applyFilters()" style="accent-color:#c9a24e"> D\u00e9cor</label>
                <button onclick="clearColFilter('catDrop');applyFilters()" style="margin-top:8px;width:100%;padding:5px;background:none;border:1px solid rgba(201,162,78,.2);color:rgba(201,162,78,.6);font-family:'Jost',sans-serif;font-size:10px;cursor:pointer">Clear</button>
              </div>
            </th>
            <th style="position:relative;white-space:nowrap">
              Subcategory <span onclick="toggleColDropdown('subcatDrop')" style="cursor:pointer;color:#c9a24e;font-size:10px">&#9660;</span>
              <div id="subcatDrop" style="display:none;position:absolute;top:100%;left:0;z-index:200;min-width:200px;background:#1a0a06;border:1px solid rgba(201,162,78,.25);padding:10px;box-shadow:0 8px 24px rgba(0,0,0,.5)">
                <div style="font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:rgba(201,162,78,.5);margin-bottom:6px">Filter</div>
                <label style="display:flex;gap:8px;padding:4px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="soft-silk"            onchange="applyFilters()" style="accent-color:#c9a24e"> Soft Silk</label>
                <label style="display:flex;gap:8px;padding:4px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="Maheswari Silk Cotton" onchange="applyFilters()" style="accent-color:#c9a24e"> Maheswari Silk Cotton</label>
                <label style="display:flex;gap:8px;padding:4px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="Fancy Silk"            onchange="applyFilters()" style="accent-color:#c9a24e"> Fancy Silk</label>
                <label style="display:flex;gap:8px;padding:4px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="Cool Cotton"           onchange="applyFilters()" style="accent-color:#c9a24e"> Cool Cotton</label>
                <label style="display:flex;gap:8px;padding:4px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="cotton-linen"          onchange="applyFilters()" style="accent-color:#c9a24e"> Cotton &amp; Linen</label>
                <label style="display:flex;gap:8px;padding:4px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="necklace-sets"         onchange="applyFilters()" style="accent-color:#c9a24e"> Necklace Sets</label>
                <label style="display:flex;gap:8px;padding:4px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="earrings"              onchange="applyFilters()" style="accent-color:#c9a24e"> Earrings</label>
                <label style="display:flex;gap:8px;padding:4px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="full-sets"             onchange="applyFilters()" style="accent-color:#c9a24e"> Full Sets</label>
                <label style="display:flex;gap:8px;padding:4px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="bridal"                onchange="applyFilters()" style="accent-color:#c9a24e"> Bridal Collection</label>
                <label style="display:flex;gap:8px;padding:4px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="diyas"                 onchange="applyFilters()" style="accent-color:#c9a24e"> Diyas &amp; Lamps</label>
                <label style="display:flex;gap:8px;padding:4px 0;color:#faf5ec;font-size:12px;cursor:pointer"><input type="checkbox" value="gifting"               onchange="applyFilters()" style="accent-color:#c9a24e"> Gifting</label>
                <button onclick="clearColFilter('subcatDrop');applyFilters()" style="margin-top:8px;width:100%;padding:5px;background:none;border:1px solid rgba(201,162,78,.2);color:rgba(201,162,78,.6);font-family:'Jost',sans-serif;font-size:10px;cursor:pointer">Clear</button>
              </div>
            </th>
            <th>Badge</th>
            <th>Price</th>
            <th style="white-space:nowrap;cursor:pointer" onclick="sortByDate()" title="Click to sort by date">
              Added Date <span id="dateSortIcon" style="color:#c9a24e;font-size:10px">&#8645;</span>
            </th>
            <th>Actions</th>
          </tr>
        </thead>'''
c, n = old_thead.subn(new_thead, c, count=1)
if n: changes += 1; print('  + Column headers updated')
else: print('  ! thead not matched')

# ── 2. Add search box + button next to filter tabs ────────────────
if 'productSearchInput' not in c:
    old_tabs = re.compile(
        r'(<button onclick="filterTable\(\'all\'\)".*?Export CSV</button>)\s*\n(\s*</div>\s*\n\s*</div>)',
        re.DOTALL
    )
    def add_search(m):
        return (
            '<div style="display:flex;gap:0;align-items:center">\n'
            '          <input type="text" id="productSearchInput" placeholder="Search name or ID\u2026"\n'
            '            onkeydown="if(event.key===\'Enter\')applyFilters()"\n'
            '            style="width:180px;padding:8px 12px;background:rgba(250,245,236,.05);\n'
            '                   border:1px solid rgba(201,162,78,.25);border-right:none;color:#faf5ec;\n'
            '                   font-family:\'Jost\',sans-serif;font-size:11px;outline:none"/>\n'
            '          <button onclick="applyFilters()"\n'
            '            style="padding:8px 12px;background:rgba(201,162,78,.15);border:1px solid rgba(201,162,78,.35);\n'
            '                   color:#c9a24e;font-family:\'Jost\',sans-serif;font-size:13px;cursor:pointer">\n'
            '            &#128269;\n'
            '          </button>\n'
            '        </div>\n'
            '        ' + m.group(1) + '\n' + m.group(2)
        )
    c, n = old_tabs.subn(add_search, c, count=1)
    if n: changes += 1; print('  + Search box + button added')
    else: print('  ! tabs pattern not matched')

# ── 3. Replace renderProductsTable with full version inc. date ────
old_render = re.compile(
    r'function renderProductsTable\(filter(?:, products_override)?\) \{.*?\n\}',
    re.DOTALL
)
new_render = '''let _dateSortAsc = null;
function sortByDate() {
  _dateSortAsc = _dateSortAsc === null ? false : !_dateSortAsc;
  document.getElementById('dateSortIcon').textContent = _dateSortAsc ? '\u25b2' : '\u25bc';
  applyFilters();
}
function toggleColDropdown(id) {
  document.querySelectorAll('#catDrop,#subcatDrop').forEach(d => { if (d.id !== id) d.style.display='none'; });
  const dd = document.getElementById(id);
  if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}
function clearColFilter(id) {
  document.querySelectorAll('#'+id+' input[type=checkbox]').forEach(c => c.checked = false);
}
document.addEventListener('click', e => {
  if (!e.target.closest('#catDrop') && !e.target.closest('#subcatDrop') && !e.target.closest('[onclick*="toggleColDropdown"]'))
    document.querySelectorAll('#catDrop,#subcatDrop').forEach(d => d.style.display='none');
});
function applyFilters() {
  const q        = (document.getElementById('productSearchInput')?.value||'').toLowerCase().trim();
  const catCk    = [...document.querySelectorAll('#catDrop input[type=checkbox]:checked')].map(c=>c.value);
  const subcatCk = [...document.querySelectorAll('#subcatDrop input[type=checkbox]:checked')].map(c=>c.value);
  let products   = getProducts();
  if (currentFilter !== 'all') products = products.filter(p => p.category === currentFilter);
  if (q)               products = products.filter(p => p.name.toLowerCase().includes(q)||(p.productId||'').toLowerCase().includes(q));
  if (catCk.length)    products = products.filter(p => catCk.includes(p.category));
  if (subcatCk.length) products = products.filter(p => subcatCk.includes(p.subcategory));
  if (_dateSortAsc !== null) {
    products = [...products].sort((a,b) => {
      const da = new Date(a.created_at||0), db = new Date(b.created_at||0);
      return _dateSortAsc ? da-db : db-da;
    });
  }
  renderProductsTable(currentFilter, products);
}
function renderProductsTable(filter, products_override) {
  let products = products_override !== undefined ? products_override : getProducts();
  if (!products_override && filter !== 'all') products = products.filter(p => p.category === filter);
  document.getElementById('productsTableBody').innerHTML = products.length === 0
    ? `<tr><td colspan="9" style="text-align:center;padding:40px;color:rgba(250,245,236,.3);font-style:italic">No products found.</td></tr>`
    : products.map(p => {
        const dateStr = p.created_at ? p.created_at.substring(0,10) : '\u2014';
        return `<tr>
        <td><img src="${resolveImg(p.img)}" alt="${p.name}" onerror="this.parentElement.style.background='linear-gradient(135deg,#2D2520,#8B7355)';this.style.display='none'"/></td>
        <td style="color:#c9a24e;font-size:11px;letter-spacing:.05em;font-weight:500">${p.productId||'\u2014'}</td>
        <td style="color:#faf5ec;font-weight:500;max-width:130px">${p.name}</td>
        <td><span class="badge-pill">${p.category}</span></td>
        <td style="color:rgba(201,162,78,.6);font-size:12px">${p.subcategory||'\u2014'}</td>
        <td style="color:rgba(250,245,236,.5)">${p.badge||'\u2014'}</td>
        <td style="color:#c9a24e;font-weight:600">&#8377;${p.price.toLocaleString()}</td>
        <td style="color:rgba(250,245,236,.4);font-size:11px;white-space:nowrap">${dateStr}</td>
        <td>
          <button class="btn-edit"   onclick="editProduct(${p.id})">Edit</button>
          <button class="btn-delete" onclick="deleteProduct(${p.id})">Delete</button>
        </td>
      </tr>`;
      }).join('');
}'''
c, n = old_render.subn(new_render, c, count=1)
if n: changes += 1; print('  + renderProductsTable updated with date column + sort + filters')
else: print('  ! renderProductsTable not matched')

# ── 4. Remove old standalone filter functions ─────────────────────
c = re.sub(
    r'\nfunction applyFilters\(\) \{[^}]*(?:\{[^}]*\}[^}]*)*\}'
    r'\nfunction toggleSubcatDropdown[^}]*(?:\{[^}]*\}[^}]*)*\}'
    r'\ndocument\.addEventListener[^;]*;[^}]*\}'
    r'\nfunction clearSubcatFilter[^}]*\}',
    '', c, flags=re.DOTALL
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

print(f'\nDone. {changes} change(s) applied to admin/index.html')
print('Now run:  git add .  &&  git commit -m "Admin table improvements"  &&  git push')
