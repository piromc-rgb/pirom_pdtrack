import sqlite3
import shutil
import os
import json

DWG_ROOT = r'G:\.shortcut-targets-by-id\1M-QDPilC7Nn-YW_5YxLQITUS6ZOYEyFm'
DRIVEFS_DB = r'C:\Users\6100163\AppData\Local\Google\DriveFS\111839099184786877427\metadata_sqlite_db'
OUTPUT_JSON = r'D:\PDtrack\src\data\drivePdfIndex.json'
TEMP_DB = r'D:\PDtrack\scripts\temp_drive_meta.db'

# 1. Load original drivePdfIndex.json
with open(OUTPUT_JSON, 'r', encoding='utf-8') as f:
    existing_data = json.load(f)

print(f"Original entries in drivePdfIndex.json: {len(existing_data)}")

# Map of existing entries: id -> name
id_to_name = {item['id']: item['name'] for item in existing_data}

# 2. Get all PDFs from DriveFS metadata_sqlite_db
conn = None
try:
    shutil.copy2(DRIVEFS_DB, TEMP_DB)
    conn = sqlite3.connect(TEMP_DB)
    c = conn.cursor()
    c.execute("""
        SELECT id, local_title 
        FROM items 
        WHERE local_title LIKE '%.pdf' AND (trashed = 0 OR trashed IS NULL)
    """)
    db_items = c.fetchall()
    print(f"Total PDFs in DriveFS DB: {len(db_items)}")
finally:
    if conn:
        conn.close()
    if os.path.exists(TEMP_DB):
        try:
            os.remove(TEMP_DB)
        except:
            pass

# Check which DB items match files in DWG_ROOT
local_dwg_filenames = set()
for root, dirs, files in os.walk(DWG_ROOT, followlinks=True):
    for f in files:
        if f.lower().endswith('.pdf'):
            local_dwg_filenames.add(f)

print(f"Unique local DWG filenames: {len(local_dwg_filenames)}")

added_count = 0
for row_id, title in db_items:
    if title in local_dwg_filenames:
        if row_id not in id_to_name:
            id_to_name[row_id] = title
            added_count += 1

print(f"Newly added items to index: {added_count}")
print(f"Total entries in new index: {len(id_to_name)}")

new_list = [{"id": drive_id, "name": name} for drive_id, name in id_to_name.items()]
new_list.sort(key=lambda x: x['name'])

with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(new_list, f, ensure_ascii=False, indent=2)

print(f"Saved {OUTPUT_JSON} successfully!")
