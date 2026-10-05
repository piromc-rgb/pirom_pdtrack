import sqlite3
import shutil
import os
import json

DRIVEFS_DB = r'C:\Users\6100163\AppData\Local\Google\DriveFS\111839099184786877427\metadata_sqlite_db'
OUTPUT_JSON = r'D:\PDtrack\src\data\drivePdfIndex.json'
TEMP_DB = r'D:\PDtrack\scripts\temp_drive_meta.db'

# 1. Load existing
with open(OUTPUT_JSON, 'r', encoding='utf-8') as f:
    existing_data = json.load(f)

id_to_name = {item['id']: item['name'] for item in existing_data}
print(f"Original entries in drivePdfIndex.json: {len(id_to_name)}")

# 2. Get all PDFs from DriveFS metadata_sqlite_db
conn = None
try:
    for ext in ["", "-wal", "-shm"]:
        src = DRIVEFS_DB + ext
        dst = TEMP_DB + ext
        if os.path.exists(src):
            shutil.copy2(src, dst)

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
    for ext in ["", "-wal", "-shm"]:
        dst = TEMP_DB + ext
        if os.path.exists(dst):
            try:
                os.remove(dst)
            except:
                pass

added = 0
for row_id, title in db_items:
    if title and row_id not in id_to_name:
        id_to_name[row_id] = title
        added += 1

print(f"Added {added} new entries from DriveFS.")
print(f"Total entries: {len(id_to_name)}")

new_list = [{"id": drive_id, "name": name} for drive_id, name in id_to_name.items()]
new_list.sort(key=lambda x: x['name'])

with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(new_list, f, ensure_ascii=False, indent=2)

print(f"Saved {OUTPUT_JSON} successfully!")
