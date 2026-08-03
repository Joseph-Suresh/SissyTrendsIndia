"""
1. Removes OTP modal from buyNow and checkoutCart (bypasses to payment directly)
2. Updates Razorpay live keys in all HTML files and .env.local
Run: python _remove_otp_set_live.py
"""
import os

BASE = os.path.dirname(os.path.abspath(__file__))

# ── 1. Patch main.js ──────────────────────────────────────────────
js_path = os.path.join(BASE, 'js', 'main.js')
with open(js_path, 'r', encoding='utf-8') as f:
    c = f.read()

# Remove OTP modal from checkoutCart
old_cart = (
    "async function checkoutCart(){\n"
    "  const items=getCartItems(); if(!items.length) return;\n"
    "  openCheckoutModal(async function(customer) {\n"
    "    await _processCartCheckout(customer);\n"
    "  });\n"
    "}"
)
new_cart = (
    "async function checkoutCart(){\n"
    "  const items=getCartItems(); if(!items.length) return;\n"
    "  await _processCartCheckout({name:'', email:'', phone:''});\n"
    "}"
)
if old_cart in c:
    c = c.replace(old_cart, new_cart, 1)
    print('  + OTP removed from checkoutCart')
else:
    print('  ! checkoutCart pattern not matched')

# Remove OTP modal from buyNow
old_buy = (
    "async function buyNow() {\n"
    "  if (!_modalProduct) return;\n"
    "  openCheckoutModal(async function(customer) {\n"
    "    await _processBuyNow(customer);\n"
    "  });\n"
    "}"
)
new_buy = (
    "async function buyNow() {\n"
    "  if (!_modalProduct) return;\n"
    "  await _processBuyNow({name:'', email:'', phone:''});\n"
    "}"
)
if old_buy in c:
    c = c.replace(old_buy, new_buy, 1)
    print('  + OTP removed from buyNow')
else:
    print('  ! buyNow pattern not matched')

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(c)

# ── 2. Update Razorpay key in HTML files ─────────────────────────
html_files = [
    os.path.join(BASE, 'index.html'),
    os.path.join(BASE, 'pages', 'collections.html'),
    os.path.join(BASE, 'pages', 'categories.html'),
]
for path in html_files:
    with open(path, 'r', encoding='utf-8') as f:
        h = f.read()
    # Replace any existing key (test or live)
    import re
    h, n = re.subn(
        r"window\.__RAZORPAY_KEY = 'rzp_(test|live)_[A-Za-z0-9]+'",
        "window.__RAZORPAY_KEY = 'rzp_live_TLAyLa3O8Vd4xI'",
        h
    )
    with open(path, 'w', encoding='utf-8') as f:
        f.write(h)
    print(f'  + {os.path.basename(path)}: live key set ({n} replacement)')

# ── 3. Update .env.local ─────────────────────────────────────────
env_path = os.path.join(BASE, '.env.local')
with open(env_path, 'r', encoding='utf-8') as f:
    env = f.read()
env = re.sub(r'RAZORPAY_KEY_ID=rzp_(test|live)_\S+', 'RAZORPAY_KEY_ID=rzp_live_TLAyLa3O8Vd4xI', env)
env = re.sub(r'RAZORPAY_KEY_SECRET=\S+', 'RAZORPAY_KEY_SECRET=YOUR_LIVE_SECRET_HERE', env)
with open(env_path, 'w', encoding='utf-8') as f:
    f.write(env)
print('  + .env.local: live key ID updated')
print('  ! Please manually update RAZORPAY_KEY_SECRET in .env.local with your live secret')

print('\nDone. Restart start.bat.')
os.remove(__file__)
