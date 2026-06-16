"""Write patched files to project — run once then delete.
   python _write_files.py
"""
import os, base64, shutil

BASE = os.path.dirname(os.path.abspath(__file__))

files = {
    'api.py':           r'PLACEHOLDER_API',
    'js/main.js':       r'PLACEHOLDER_MJS',
    'admin/index.html': r'PLACEHOLDER_ADM',
}
print("This script needs to be generated with content — see apply_all_changes.py instead")
