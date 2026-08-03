"""Test if env vars are loaded correctly. Run from project folder.
   python _test_env.py
"""
import os

key_id = os.environ.get('RAZORPAY_KEY_ID', 'NOT SET')
secret = os.environ.get('RAZORPAY_KEY_SECRET', 'NOT SET')
print(f'RAZORPAY_KEY_ID:     {key_id}')
print(f'RAZORPAY_KEY_SECRET: {secret[:8]}...' if secret != 'NOT SET' else 'NOT SET')

import os; os.remove(__file__)
