"""
Scans C:\\Users\\joesu\\OneDrive\\Pictures\\Saree Images -set 2\\Imitation jewellery images set 2
- Renames images to IMI-001.jpeg, IMI-002.jpeg etc.
- Moves similar/duplicate looking images to a 'duplicates' subfolder
- Adds 4 new jewellery products to products_CSVBasic.csv

Run from project folder:
  python process_jewellery.py
"""
import os, shutil, csv
from datetime import date
from PIL import Image
import hashlib

SRC_FOLDER   = r"C:\Users\joesu\OneDrive\Pictures\Saree Images -set 2\Imitation jewellery images set 2"
CSV_PATH     = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'products_CSVBasic.csv')
PROJECT_IMG  = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Images', 'Imitation jewels')
DUP_FOLDER   = os.path.join(SRC_FOLDER, 'duplicates')
IMG_EXTS     = {'.jpg', '.jpeg', '.png', '.webp'}

os.makedirs(DUP_FOLDER, exist_ok=True)
os.makedirs(PROJECT_IMG, exist_ok=True)

# ── Step 1: List all images ───────────────────────────────────────
all_files = [
    f for f in os.listdir(SRC_FOLDER)
    if os.path.splitext(f)[1].lower() in IMG_EXTS
    and os.path.isfile(os.path.join(SRC_FOLDER, f))
]
print(f"Found {len(all_files)} image(s) in source folder:\n")
for f in sorted(all_files):
    print(f"  {f}")

# ── Step 2: Detect duplicates by file hash ────────────────────────
print("\n── Duplicate detection ──")
hashes = {}
duplicates = []
unique = []
for f in sorted(all_files):
    path = os.path.join(SRC_FOLDER, f)
    with open(path, 'rb') as fh:
        h = hashlib.md5(fh.read()).hexdigest()
    if h in hashes:
        print(f"  DUPLICATE: {f}  ==  {hashes[h]}")
        duplicates.append(f)
    else:
        hashes[h] = f
        unique.append(f)

print(f"\n  {len(unique)} unique images, {len(duplicates)} exact duplicates")

# ── Step 3: Move exact duplicates ────────────────────────────────
for f in duplicates:
    src = os.path.join(SRC_FOLDER, f)
    dst = os.path.join(DUP_FOLDER, f)
    shutil.move(src, dst)
    print(f"  Moved duplicate: {f} → duplicates/")

# ── Step 4: Rename unique images to IMI-NNN.jpeg ─────────────────
print("\n── Renaming unique images ──")
renamed = []
for i, f in enumerate(unique, start=1):
    src  = os.path.join(SRC_FOLDER, f)
    ext  = os.path.splitext(f)[1].lower()
    new_name = f"IMI-{i:03d}{ext}"
    dst  = os.path.join(SRC_FOLDER, new_name)
    if src != dst and not os.path.exists(dst):
        os.rename(src, dst)
        print(f"  {f}  →  {new_name}")
    else:
        print(f"  {new_name} already exists, skipping rename")
    renamed.append(new_name)

# ── Step 5: Copy first 4 unique images to project Images folder ──
print("\n── Copying to project Images/Imitation jewels/ ──")
selected = renamed[:4]
for f in selected:
    src = os.path.join(SRC_FOLDER, f)
    dst = os.path.join(PROJECT_IMG, f)
    shutil.copy2(src, dst)
    print(f"  Copied: {f}")

# ── Step 6: Add 4 new products to CSV ────────────────────────────
print("\n── Adding to CSV ──")
with open(CSV_PATH, encoding='utf-8-sig') as f:
    reader = csv.DictReader(f, delimiter=';')
    rows   = list(reader)
    headers = list(reader.fieldnames)

today = date.today().strftime('%d/%m/%Y 00:00')
next_id = max(int(r['id']) for r in rows if r['id'].isdigit()) + 1

new_jwl = [
    ('JWL-008', 'IMI-001', 'Imitation Jewellery Set 1',  'necklace-sets', 'Necklace Set',  'New',       'bridal',  '899'),
    ('JWL-009', 'IMI-002', 'Imitation Jewellery Set 2',  'earrings',      'Earrings',       'Trending',  'festive', '699'),
    ('JWL-010', 'IMI-003', 'Imitation Jewellery Set 3',  'full-sets',     'Full Set',       'Bestseller','wedding', '1199'),
    ('JWL-011', 'IMI-004', 'Imitation Jewellery Set 4',  'bridal',        'Bridal Set',     'Heritage',  'bridal',  '1499'),
]

for i, (pid, img_name, name, subcat, fabric, badge, occasion, price) in enumerate(new_jwl):
    ext = os.path.splitext(selected[i])[1] if i < len(selected) else '.jpeg'
    img_name_actual = selected[i] if i < len(selected) else img_name + ext
    row = {k: '' for k in headers}
    row.update({
        'id':          str(next_id + i),
        'productId':   pid,
        'available':   '1',
        'name':        name,
        'category':    'jewellery',
        'subcategory': subcat,
        'fabric':      fabric,
        'price':       price,
        'badge':       badge,
        'occasion':    occasion,
        'img':         f'/Images/Imitation jewels/{img_name_actual}',
        'img2':        '',
        'img3':        '',
        'img4':        '',
        'desc':        f'Beautiful {name.lower()} crafted with fine imitation stones and metal work. Perfect for {occasion} occasions.',
        'created_at':  today,
        'updated_at':  today,
    })
    rows.append(row)
    print(f"  Added: {pid}  {name}  img={img_name_actual}")

with open(CSV_PATH, 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=headers, delimiter=';')
    writer.writeheader()
    writer.writerows(rows)

print(f"\nDone. CSV now has {len(rows)} rows.")
print("Next steps:")
print("  1. Open the renamed images in SRC_FOLDER and update names/descriptions in CSV if needed")
print("  2. git add . && git commit -m 'Add JWL-008 to JWL-011' && git push")
print("  3. python db_manager.py csv products_CSVBasic.csv")
