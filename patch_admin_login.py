"""
Run once from the project folder:
  cd C:\\Users\\joesu\\Downloads\\austroindie-website\\austroindie
  python patch_admin_login.py
"""
import os

path = os.path.join(os.path.dirname(__file__), 'admin', 'index.html')
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = '''function doLogin() {
  const creds = getEnvCreds();
  if (!creds.user || !creds.pass) {
    document.getElementById('loginError').textContent =
      '\u26a0 env-config.js not found. Create it from env-config.example.js';
    document.getElementById('loginError').style.display = 'block';
    return;
  }'''

new = '''async function doLogin() {
  let creds = getEnvCreds();
  if (!creds.user || !creds.pass) {
    try {
      const r = await fetch('/api/env');
      const data = await r.json();
      creds = { user: data.ADMIN_USERNAME || '', pass: data.ADMIN_PASSWORD || '' };
    } catch {}
  }
  if (!creds.user || !creds.pass) {
    document.getElementById('loginError').textContent =
      '\u26a0 Set ADMIN_USERNAME and ADMIN_PASSWORD in Render environment variables.';
    document.getElementById('loginError').style.display = 'block';
    return;
  }'''

if old in content:
    content = content.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('SUCCESS: admin/index.html patched.')
else:
    print('Already patched or not found — no changes made.')
