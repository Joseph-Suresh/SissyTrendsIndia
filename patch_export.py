"""
Run once:
  cd C:\\Users\\joesu\\Downloads\\austroindie-website\\austroindie
  python patch_export.py
"""
import os, re

BASE = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(BASE, 'admin', 'index.html')

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# 1. Add Export CSV button next to filter tabs
old = re.compile(
    r'(<button onclick="filterTable\(\'decor\'\)"[^>]*>D\u00e9cor</button>)\s*\n(\s*</div>\s*\n\s*</div>)'
)
new_btn = (
    r'\1\n'
    r'        <button onclick="exportCSV()" style="padding:8px 16px;font-size:9px;letter-spacing:.15em;'
    r'text-transform:uppercase;background:none;border:1px solid rgba(201,162,78,.4);color:#c9a24e;'
    r'cursor:pointer;font-family:\'Jost\',sans-serif;transition:all .25s" '
    r'onmouseover="this.style.background=\'rgba(201,162,78,.1)\'" '
    r'onmouseout="this.style.background=\'none\'">&#8595; Export CSV</button>\n'
    r'\2'
)
if 'exportCSV' not in content:
    content, n = old.subn(new_btn, content, count=1)
    if n:
        changes += 1
        print('  ✔ Export CSV button added')
    else:
        print('  - Button already present or pattern not matched')
else:
    print('  - exportCSV already in file')

# 2. Add exportCSV() function
if 'function exportCSV' not in content:
    fn = '''function exportCSV() {
  const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000/api/export/csv'
    : '/api/export/csv';
  const a = document.createElement('a');
  a.href = apiBase;
  a.download = 'products_CSVBasic.csv';
  a.click();
  showAdminToast('CSV downloaded \u2726 Replace products_CSVBasic.csv in your project and push to GitHub');
}

function filterProductsBySearch('''
    content = content.replace('function filterProductsBySearch(', fn, 1)
    changes += 1
    print('  ✔ exportCSV() function added')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'\n{"SUCCESS" if changes else "No changes needed"}: {changes} change(s) applied to admin/index.html')
