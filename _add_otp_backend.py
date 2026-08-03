"""Adds OTP send/verify endpoints to api.py using fast2sms free tier.
   python _add_otp_backend.py
"""
import os, re

BASE = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(BASE, 'api.py')

with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

if '/api/otp/send' in c:
    print('OTP endpoints already present.')
    os.remove(__file__); exit()

otp_endpoints = """
        elif path == '/api/otp/send':
            import random, time, urllib.request as _ur, urllib.parse as _up
            phone = body.get('phone', '')
            if not phone or len(phone) < 10:
                send_json(self, {'error': 'Invalid phone number'}, 400); return
            # Generate 6-digit OTP
            otp = str(random.randint(100000, 999999))
            # Store OTP with 10-minute expiry
            if not hasattr(Handler, '_otp_store'): Handler._otp_store = {}
            Handler._otp_store[phone] = {'otp': otp, 'expires': time.time() + 600}
            # Send via fast2sms (free tier — 38 free SMS/day)
            api_key = os.environ.get('FAST2SMS_API_KEY', '')
            if api_key:
                try:
                    url = 'https://www.fast2sms.com/dev/bulkV2'
                    params = _up.urlencode({
                        'authorization': api_key,
                        'variables_values': otp,
                        'route': 'otp',
                        'numbers': phone[-10:],
                    })
                    req = _ur.Request(f'{url}?{params}')
                    req.add_header('cache-control', 'no-cache')
                    with _ur.urlopen(req, timeout=10) as r:
                        result = r.read().decode()
                    print(f'OTP sent to {phone}: {otp} | Response: {result}')
                    send_json(self, {'ok': True})
                except Exception as e:
                    print(f'SMS failed: {e} | OTP for {phone}: {otp}')
                    send_json(self, {'ok': True})  # still ok, OTP stored
            else:
                # Dev mode — print OTP to terminal
                print(f'[DEV] OTP for {phone}: {otp}  (set FAST2SMS_API_KEY to send real SMS)')
                send_json(self, {'ok': True})
            return

        elif path == '/api/otp/verify':
            import time
            phone = body.get('phone', '')
            otp   = body.get('otp', '')
            store = getattr(Handler, '_otp_store', {})
            entry = store.get(phone)
            if not entry:
                send_json(self, {'error': 'OTP not found. Please request a new one.'}, 400); return
            if time.time() > entry['expires']:
                del store[phone]
                send_json(self, {'error': 'OTP expired. Please request a new one.'}, 400); return
            if entry['otp'] != otp:
                send_json(self, {'error': 'Invalid OTP. Please try again.'}, 400); return
            del store[phone]
            send_json(self, {'ok': True})
            return
"""

# Insert before /api/razorpay/create-order in do_POST
anchor = "\n        if path == '/api/razorpay/create-order':"
anchor2 = "\n        elif path == '/api/razorpay/create-order':"

inserted = False
for a in [anchor, anchor2]:
    if a in c:
        c = c.replace(a, otp_endpoints + a, 1)
        inserted = True
        print('  + OTP endpoints added to do_POST')
        break

if not inserted:
    # fallback: insert before wishlist in do_POST
    anchor3 = "\n        elif path == '/api/wishlist':"
    pos = c.rfind(anchor3)  # last occurrence (in do_POST)
    if pos > 0:
        c = c[:pos] + otp_endpoints + c[pos:]
        inserted = True
        print('  + OTP endpoints added (fallback anchor)')

if not inserted:
    print('  ! Could not find insertion point')
else:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)

    import subprocess
    r = subprocess.run(['python', '-m', 'py_compile', path], capture_output=True, text=True)
    print('Syntax:', 'OK' if r.returncode == 0 else r.stderr)

os.remove(__file__)
