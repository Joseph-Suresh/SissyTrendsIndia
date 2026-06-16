"""
Run once to fix API URLs across all pages for Render production.
  cd C:\\Users\\joesu\\Downloads\\austroindie-website\\austroindie
  python patch_api_urls.py
"""
import os, re

BASE = os.path.dirname(os.path.abspath(__file__))

files = [
    os.path.join(BASE, 'index.html'),
    os.path.join(BASE, 'pages', 'collections.html'),
    os.path.join(BASE, 'pages', 'categories.html'),
    os.path.join(BASE, 'js', 'main.js'),
]

# The broken pattern used everywhere
OLD = re.compile(
    r"window\.location\.port\s*===\s*['\"]5000['\"]\s*\?"
    r"\s*['\"](/api[^'\"]*)['\"]"
    r"\s*:\s*['\"]http://localhost:5000(/api[^'\"]*)['\"]"
)

def fix(m):
    rel = m.group(1)   # e.g. /api/products
    return (
        f"(window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1')"
        f"?'http://localhost:5000{rel}':'{rel}'"
    )

total = 0
for path in files:
    if not os.path.exists(path):
        print(f'  SKIP (not found): {path}')
        continue
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    new_content, n = OLD.subn(fix, content)
    if n:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'  ✔ {os.path.relpath(path, BASE)} — {n} fix(es)')
        total += n
    else:
        print(f'  — {os.path.relpath(path, BASE)} — already clean')

print(f'\nDone. {total} total fixes applied.')
