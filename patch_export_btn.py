"""
Run once:
  cd C:\\Users\\joesu\\Downloads\\austroindie-website\\austroindie
  python patch_export_btn.py
"""
import os, re

BASE = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(BASE, 'admin', 'index.html')

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# 1. Add Export CSV button after Décor tab
if 'exportCSV' not in content:
    pattern = re.compile(
        r"(<button onclick=\"filterTable\('decor'\)\"[^>]*>D[eé]cor</button>)"
        r"(\s*</div>)"
    )
    replacement = (
        r'\1'
        "\n        <button onclick=\"exportCSV()\" style=\"padding:8px 16px;font-size:9px;"
        "letter-spacing:.15em;text-transform:uppercase;background:none;"
        "border:1px solid rgba(201,162,78,.4);color:#c9a24e;cursor:pointer;"
        "font-family:'Jost',sans-serif\">&#8595; Export CSV</button>"
        r'\2'
    )
    content, n = pattern.subn(replacement, content, count=1)
    if n:
        changes += 1
        print('  ✔ Export CSV button added')

# 2. Add exportCSV() function
if 'function exportCSV' not in content:
    fn = """function exportCSV() {
  const base = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000' : '';
  const a = document.createElement('a');
  a.href = base + '/api/export/csv';
  a.download = 'products_CSVBasic.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showAdminToast('CSV downloaded \u2726 Replace products_CSVBasic.csv in project and push to GitHub');
}

function filterProductsBySearch("""
    content = content.replace('function filterProductsBySearch(', fn, 1)
    changes += 1
    print('  ✔ exportCSV() function added')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'\n{"SUCCESS" if changes else "Already up to date"}: {changes} change(s) applied.')
