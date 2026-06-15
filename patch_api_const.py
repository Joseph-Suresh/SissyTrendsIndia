"""
Run once:
  cd C:\\Users\\joesu\\Downloads\\austroindie-website\\austroindie
  python patch_api_const.py
"""
import os, re

path = os.path.join(os.path.dirname(__file__), 'admin', 'index.html')
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix API constant — works on both localhost and Render
old = re.compile(r"const API = window\.location\.port === '5000'\r?\n  \? '/api'\r?\n  : 'http://localhost:5000/api';")
new = """const API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';"""

if old.search(content):
    content = old.sub(new, content, count=1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('SUCCESS: admin/index.html API constant fixed.')
else:
    print('Already fixed or pattern not found — no changes made.')
