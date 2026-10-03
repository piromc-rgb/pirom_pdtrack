import os
import re
import csv
import io
import json
import urllib.request

SHEET1_CSV_URL = 'https://docs.google.com/spreadsheets/d/1l5FbiznQNUhIpUNuma9iivKzYvcaCTiL7Z_9mDcCijE/export?format=csv&gid=472754949'
SHEET2_CSV_URL = 'https://docs.google.com/spreadsheets/d/1YLgaxdeJR_MCHJhFkoAPAJfGmvUJB2K9GPgirYqlhPE/export?format=csv&gid=1308741309'
SHEET_SP_CSV_URL = 'https://docs.google.com/spreadsheets/d/1YLgaxdeJR_MCHJhFkoAPAJfGmvUJB2K9GPgirYqlhPE/export?format=csv&gid=1833136006'

def norm(s):
    if not s:
        return ''
    return re.sub(r'\s+', ' ', s.strip()).lower()

def extract_pd_numbers(prod_order):
    if not prod_order:
        return []
    pds = []
    m = re.search(r'PD(\d+)\s*-\s*(?:PD)?(\d+)', prod_order, re.I)
    if m:
        s1, s2 = m.group(1), m.group(2)
        n1 = int(s1)
        n2 = int(s1[:len(s1)-len(s2)] + s2) if len(s2) < len(s1) else int(s2)
        if n2 >= n1 and (n2 - n1) <= 200:
            for n in range(n1, n2 + 1):
                pds.append(f'PD{n}')
    for dm in re.findall(r'PD\d+', prod_order, re.I):
        up = dm.upper()
        if up not in pds:
            pds.append(up)
    return pds

def parse_d(s):
    if not s: return None
    parts = re.split(r'[/\-.]', str(s).strip())
    if len(parts) == 3:
        try:
            d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
            if y >= 2400: y -= 543
            from datetime import datetime
            return datetime(y, m, d)
        except:
            return None
    return None

def get_qc_warehouse_status(action):
    if not action:
        return 'ยังไม่ส่งเข้าคลัง'
    clean = str(action).strip()
    if re.search(r'คลัง\s*SEMI', clean, re.I):
        return 'คลัง SEMI'
    if re.search(r'คลัง\s*PRD', clean, re.I):
        return 'คลัง PRD'
    return 'ยังไม่ส่งเข้าคลัง'

def pick_latest_qc_meta(pds, qc_map):
    if not qc_map or not pds:
        return None
    best_qc = None
    best_dt = None
    for p in pds:
        meta = qc_map.get(p.upper())
        if not meta: continue
        dt = parse_d(meta.get('qcDate', ''))
        if best_qc is None or (dt and (best_dt is None or dt > best_dt)):
            best_qc = meta
            best_dt = dt
        elif dt and best_dt and dt == best_dt:
            curr_wh = get_qc_warehouse_status(meta.get('action'))
            best_wh = get_qc_warehouse_status(best_qc.get('action'))
            if curr_wh != 'ยังไม่ส่งเข้าคลัง' and best_wh == 'ยังไม่ส่งเข้าคลัง':
                best_qc = meta
    return best_qc

def main():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    data_dir = os.path.join(base_dir, 'src', 'data')

    with open(os.path.join(data_dir, 'defaultData.json'), encoding='utf-8') as f:
        default_service_items = json.load(f)
    with open(os.path.join(data_dir, 'overviewStatusData.json'), encoding='utf-8') as f:
        overview_by_pd = json.load(f)
    with open(os.path.join(data_dir, 'overviewItemMap.json'), encoding='utf-8') as f:
        overview_item_map = json.load(f)
    with open(os.path.join(data_dir, 'itemPdMap.json'), encoding='utf-8') as f:
        item_pd_map = json.load(f)
    with open(os.path.join(data_dir, 'qcData.json'), encoding='utf-8') as f:
        qc_map = json.load(f)

    # Tag and enrich existing defaultData.json items as Service
    for item in default_service_items:
        item['workTag'] = 'Service'
        po = item.get('prodOrder', '')
        if not po and item.get('itemCode'):
            proj_item_key = f"{item.get('projectCode', '').strip()}|{item.get('itemCode', '').strip()}"
            po = item_pd_map.get('byProjItem', {}).get(proj_item_key) or item_pd_map.get('byItem', {}).get(item.get('itemCode', '').strip()) or ''
            item['prodOrder'] = po
        item_pds = extract_pd_numbers(po)
        matched_qc_pds = [p for p in item_pds if p in qc_map]
        best_qc = pick_latest_qc_meta(item_pds, qc_map)
        qc_action = best_qc.get('action', '') if best_qc else ''
        wh_status = get_qc_warehouse_status(qc_action)
        is_qc_passed = wh_status in ('คลัง SEMI', 'คลัง PRD')
        item['isQcPassed'] = is_qc_passed
        item['qcDate'] = best_qc.get('qcDate', '') if best_qc else ''
        item['qcInspector'] = best_qc.get('inspector', '') if best_qc else ''
        item['qcPassedQty'] = best_qc.get('qtyPass', '') if best_qc else ''
        item['qcTopic'] = best_qc.get('topic', '') if best_qc else ''
        item['qcRemarks'] = best_qc.get('remarks', '') if best_qc else ''
        item['qcAction'] = qc_action
        item['qcWarehouseStatus'] = wh_status
        item['qcPdList'] = matched_qc_pds

    with open(os.path.join(data_dir, 'defaultData.json'), 'w', encoding='utf-8') as f:
        json.dump(default_service_items, f, ensure_ascii=False, indent=2)

    existing_service_keys = set()
    for item in default_service_items:
        k = f"{norm(item.get('docRef'))}|{norm(item.get('machineName'))}|{norm(item.get('itemCode'))}"
        existing_service_keys.add(k)

    print("Fetching Sheet 2 CSV...")
    csv_text = urllib.request.urlopen(SHEET2_CSV_URL).read().decode('utf-8')
    rows = list(csv.reader(io.StringIO(csv_text)))

    header_row_idx = 0
    if len(rows) > 0 and any('document' in (c or '').lower() or 'หัวข้อ' in (c or '').lower() for c in rows[0]):
        header_row_idx = 0
    elif len(rows) > 1 and any('document' in (c or '').lower() or 'หัวข้อ' in (c or '').lower() for c in rows[1]):
        header_row_idx = 1

    headers = [re.sub(r'\s+', ' ', (h or '').strip()) for h in rows[header_row_idx]]
    def find_col(keywords):
        for idx, h in enumerate(headers):
            for k in keywords:
                if k.lower() in h.lower():
                    return idx
        return -1

    doc_ref_idx = find_col(['Document number', 'Document Reference', 'Doc Ref', 'Reference'])
    action_topic_idx = find_col(['หัวข้อแจ้งดำเนินการ', 'หัวข้อ'])
    ncr_idx = find_col(['NCR', 'IPR'])
    proj_code_idx = find_col(['เลขที่โครงการ', 'Project No'])
    proj_name_idx = find_col(['ชื่อโครงการ', 'Project Name'])
    machine_idx = find_col(['เครื่องจักร', 'Machine Name', 'Machine'])
    doc_type_idx = find_col(['ประเภท', 'Doc Type'])
    doc04_idx = find_col(['เลขที่ใบ 04', 'ใบ 04', 'เลขที่เอกสาร 04', 'เอกสาร 04'])
    item_code_idx = find_col(['เลขที่ Item', 'Item Code', 'Item No'])
    item_name_idx = find_col(['ชื่อ Item', 'Item Name', 'รายการ'])
    qty_idx = find_col(['จำนวน', 'Qty', 'Quantity'])
    prod_order_idx = find_col(['Production Order', 'Prod Order'])
    pd_act_line_idx = find_col(['จำนวนPD', 'Act Line'])
    notify_date_idx = find_col(['วันที่แจ้งดำเนินการ', 'Notify Date'])
    week_idx = find_col(['Week'])
    target_req_idx = find_col(['เป้าหมายที่ต้องการ', 'Target Requested'])
    dept_idx = find_col(['หน่วยงานที่แจ้งดำเนินการ', 'หน่วยงาน'])
    req_name_idx = find_col(['ชื่อผู้แจ้งดำเนินการ', 'ผู้แจ้ง'])
    target1_idx = find_col(['เป้าหมายส่งมอบ 1', 'เป้าหมาย 1'])
    target2_idx = find_col(['เป้าหมายส่งมอบ 2', 'เป้าหมาย 2'])
    target3_idx = find_col(['เป้าหมายส่งมอบ 3', 'เป้าหมาย 3'])
    target4_idx = find_col(['เป้าหมายส่งมอบ 4', 'เป้าหมาย 4'])
    target5_idx = find_col(['เป้าหมายส่งมอบ 5', 'เป้าหมาย 5'])
    target_latest_idx = find_col(['เป้าหมายล่าสุด', 'Target Latest'])
    po_pr_idx = find_col(['PO/PR', 'PO', 'PR'])
    remark_idx = find_col(['หมายเหตุ', 'Remark', 'Note'])
    dwg_status_idx = find_col(['สถานะแบบ', 'DWG', 'แบบ'])
    closed_idx = find_col(['Closed', 'closed', 'close', 'ปิดงาน', 'ปิด'])

    project_items = []
    idx_counter = 0

    for i in range(header_row_idx + 1, len(rows)):
        r = rows[i]
        if not r or len(r) < 10:
            continue

        def get_val(idx, fallback_idx):
            target = idx if idx != -1 else fallback_idx
            return r[target].strip() if target < len(r) and r[target] else ''

        action_topic = get_val(action_topic_idx, 1)
        if action_topic != 'สั่งผลิตเครื่องจักรตาม Machine List':
            continue

        raw_dwg = get_val(dwg_status_idx, 26)
        if 'ยกเลิกผลิต' in raw_dwg or 'ไม่สั่งผลิต' in raw_dwg:
            continue

        doc_ref = get_val(doc_ref_idx, 0)
        ncr_no = get_val(ncr_idx, 2)
        project_code = get_val(proj_code_idx, 3)
        project_name = get_val(proj_name_idx, 4)
        raw_machine_col = get_val(machine_idx, 5)
        doc_type = get_val(doc_type_idx, 6) or 'งานโครงการ'
        raw_doc_04 = get_val(doc04_idx, 7)
        item_code = get_val(item_code_idx, 8)
        item_name = get_val(item_name_idx, 9)
        qty_str = get_val(qty_idx, 10)
        prod_order = get_val(prod_order_idx, 11)
        pd_act_line = get_val(pd_act_line_idx, 12)
        notify_date = get_val(notify_date_idx, 13)
        week = get_val(week_idx, 14)
        target_req = get_val(target_req_idx, 15)
        req_dept = get_val(dept_idx, 16)
        req_name = get_val(req_name_idx, 17)
        target1 = get_val(target1_idx, 18)
        target2 = get_val(target2_idx, 19)
        target3 = get_val(target3_idx, 20)
        target4 = get_val(target4_idx, 21)
        target5 = get_val(target5_idx, 22)
        raw_target_latest = get_val(target_latest_idx, 23)
        po_pr = get_val(po_pr_idx, 24)
        remark = get_val(remark_idx, 25)
        closed = get_val(closed_idx, 27)

        # เลขที่เอกสาร 04 ดึงมาจาก Column 'เลขที่ใบ 04' (ถ้าไม่มี ให้เป็น '(ไม่ระบุเอกสาร 04)')
        machine_name = raw_doc_04 or '(ไม่ระบุเอกสาร 04)'
        dedup_key = f"{norm(doc_ref)}|{norm(machine_name)}|{norm(item_code)}"
        if dedup_key in existing_service_keys:
            continue

        # Clean fake formula default date in Sheet 2 (30/12/2025 or 31/12/2025 when target1..5 are all empty)
        has_any_target_1_5 = any([target1, target2, target3, target4, target5])
        if not has_any_target_1_5 and raw_target_latest in ('30/12/2025', '31/12/2025', '30/12/1899'):
            raw_target_latest = ''

        target_latest = raw_target_latest or target5 or target4 or target3 or target2 or target1 or target_req

        qty = 1
        if qty_str:
            try:
                qty = float(qty_str.replace(',', ''))
                if qty.is_integer():
                    qty = int(qty)
            except:
                qty = 1

        if not prod_order and item_code:
            proj_item_key = f"{project_code.strip()}|{item_code.strip()}"
            prod_order = item_pd_map.get('byProjItem', {}).get(proj_item_key) or item_pd_map.get('byItem', {}).get(item_code.strip()) or ''

        item_pds = extract_pd_numbers(prod_order)
        matched_qc_pds = [p for p in item_pds if p in qc_map]
        best_qc = pick_latest_qc_meta(item_pds, qc_map)
        qc_action = best_qc.get('action', '') if best_qc else ''
        wh_status = get_qc_warehouse_status(qc_action)
        is_qc_passed = wh_status in ('คลัง SEMI', 'คลัง PRD')

        # Lookup overview status
        ov_meta = None
        if item_pds:
            matched_metas = [overview_by_pd[p] for p in item_pds if p in overview_by_pd]
            if len(matched_metas) == 1:
                ov_meta = matched_metas[0]
            elif len(matched_metas) > 1:
                all_done = all(m.get('status', '').lower() in ('completed', 'closed', 'close', 'เสร็จแล้ว', 'เสร็จสิ้น') for m in matched_metas)
                if all_done:
                    ov_meta = dict(matched_metas[0])
                    ov_meta['status'] = 'Closed'
                    ov_meta['currentOpStatus'] = 'Completed'
                else:
                    in_prog = [m for m in matched_metas if m.get('status', '').lower() not in ('completed', 'closed', 'close', 'เสร็จแล้ว', 'เสร็จสิ้น')]
                    ov_meta = in_prog[0] if in_prog else matched_metas[0]
        else:
            proj_key = f"{project_code.strip().upper()}|{item_code.strip().upper()}"
            ov_meta = overview_item_map.get('byProjItem', {}).get(proj_key) or overview_item_map.get('byItem', {}).get(item_code.strip().upper())

        if not prod_order and ov_meta and ov_meta.get('prodOrder'):
            prod_order = ov_meta['prodOrder']

        norm_remark = remark.lower()
        norm_closed = closed.lower()
        is_delivered = (
            'ส่งแล้ว' in norm_remark or
            'จัดส่งแล้ว' in norm_remark or
            '*' in norm_remark or
            'close' in norm_remark or
            '*' in norm_closed or
            'close' in norm_closed
        )

        idx_counter += 1
        item_obj = {
            'id': f'proj-item-{idx_counter}',
            'workTag': 'Project',
            'docRef': doc_ref,
            'projectCode': project_code,
            'projectName': project_name,
            'docType': doc_type or 'งานโครงการ',
            'machineName': machine_name,
            'machine': raw_machine_col or '',
            'hasMachine': bool(raw_doc_04),
            'itemCode': item_code,
            'itemName': item_name,
            'qty': qty,
            'prodOrder': prod_order,
            'pdActLine': pd_act_line,
            'notifyDate': notify_date,
            'target1': target1,
            'target2': target2,
            'target3': target3,
            'target4': target4,
            'target5': target5,
            'targetLatest': target_latest,
            'poPr': po_pr,
            'remark': remark,
            'status': 'ส่งแล้ว' if is_delivered else 'รอดำเนินการ',
            'rawStatus': raw_dwg,
            'closed': closed,
            'actionTopic': action_topic,
            'ncrNo': ncr_no,
            'requestDept': req_dept,
            'requesterName': req_name,
            'targetRequested': target_req,
            'week': week,
            'isQcPassed': is_qc_passed,
            'qcDate': best_qc.get('qcDate', '') if best_qc else '',
            'qcInspector': best_qc.get('inspector', '') if best_qc else '',
            'qcPassedQty': best_qc.get('qtyPass', '') if best_qc else '',
            'qcTopic': best_qc.get('topic', '') if best_qc else '',
            'qcRemarks': best_qc.get('remarks', '') if best_qc else '',
            'qcAction': qc_action,
            'qcWarehouseStatus': wh_status,
            'qcPdList': matched_qc_pds,
        }
        if ov_meta:
            for k in (
                'status', 'customer', 'project', 'itemCode',
                'readyOp', 'readyOpDesc', 'readyOpWc', 'readyOpNo', 'hasReadyOp',
                'activeOp', 'activeOpDesc', 'activeOpWc', 'activeOpNo',
                'currentOp', 'currentOpDesc', 'currentOpStatus',
                'lastCompletedOp', 'lastCompletedOpDesc', 'lastCompletedOpWc', 'lastCompletedOpNo',
                'isAllCompleted'
            ):
                if k in ov_meta and ov_meta[k] is not None:
                    if k == 'status':
                        item_obj['overviewStatus'] = ov_meta['status']
                    elif k == 'customer':
                        item_obj['overviewCustomer'] = ov_meta['customer']
                    elif k == 'project':
                        item_obj['overviewProject'] = ov_meta['project']
                    elif k == 'itemCode':
                        item_obj['overviewItemCode'] = ov_meta['itemCode']
                    else:
                        item_obj[k] = ov_meta[k]

        project_items.append(item_obj)

    out_path = os.path.join(data_dir, 'defaultProjectItems.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(project_items, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(project_items)} Project items to {out_path}")
    print(f"Tagged {len(default_service_items)} Service items in defaultData.json")

    print("Fetching Service Purchase CSV...")
    sp_csv_text = urllib.request.urlopen(SHEET_SP_CSV_URL).read().decode('utf-8')
    sp_rows = list(csv.reader(io.StringIO(sp_csv_text)))

    sp_header_row_idx = 0
    if len(sp_rows) > 0 and any('document' in (c or '').lower() or 'หัวข้อ' in (c or '').lower() for c in sp_rows[0]):
        sp_header_row_idx = 0
    elif len(sp_rows) > 1 and any('document' in (c or '').lower() or 'หัวข้อ' in (c or '').lower() for c in sp_rows[1]):
        sp_header_row_idx = 1

    sp_headers = [re.sub(r'\s+', ' ', (h or '').strip()) for h in sp_rows[sp_header_row_idx]]
    def find_sp_col(keywords):
        for idx, h in enumerate(sp_headers):
            for k in keywords:
                if k.lower() in h.lower():
                    return idx
        return -1

    sp_doc_ref_idx = find_sp_col(['Document number', 'Document Reference', 'Doc Ref', 'Reference'])
    sp_action_topic_idx = find_sp_col(['หัวข้อแจ้งดำเนินการ', 'หัวข้อ'])
    sp_ncr_idx = find_sp_col(['NCR', 'IPR'])
    sp_proj_code_idx = find_sp_col(['เลขที่โครงการ', 'Project No'])
    sp_proj_name_idx = find_sp_col(['ชื่อโครงการ', 'Project Name'])
    sp_doc_type_idx = find_sp_col(['ประเภท', 'Doc Type'])
    sp_doc04_idx = find_sp_col(['เลขที่ใบ 04', 'ใบ 04', 'เลขที่เอกสาร 04', 'เอกสาร 04'])
    sp_machine_idx = find_sp_col(['ชื่อเครื่องจักร', 'เครื่องจักร', 'Machine Name', 'Machine'])
    sp_item_code_idx = find_sp_col(['เลขที่ Item', 'Item Code', 'Item No'])
    sp_item_name_idx = find_sp_col(['ชื่อ Item', 'Item Name', 'รายการ'])
    sp_qty_idx = find_sp_col(['จำนวน', 'Qty', 'Quantity'])
    sp_prod_order_idx = find_sp_col(['Production Order', 'Prod Order'])
    sp_pd_act_line_idx = find_sp_col(['จำนวนPD', 'Act Line'])
    sp_notify_date_idx = find_sp_col(['วันที่แจ้งดำเนินการ', 'Notify Date'])
    sp_week_idx = find_sp_col(['Week'])
    sp_target_req_idx = find_sp_col(['เป้าหมายที่ต้องการ', 'Target Requested'])
    sp_dept_idx = find_sp_col(['หน่วยงานที่แจ้งดำเนินการ', 'หน่วยงาน'])
    sp_req_name_idx = find_sp_col(['ชื่อผู้แจ้งดำเนินการ', 'ผู้แจ้ง'])
    sp_target1_idx = find_sp_col(['เป้าหมายส่งมอบ 1', 'เป้าหมาย 1'])
    sp_target2_idx = find_sp_col(['เป้าหมายส่งมอบ 2', 'เป้าหมาย 2'])
    sp_target3_idx = find_sp_col(['เป้าหมายส่งมอบ 3', 'เป้าหมาย 3'])
    sp_target4_idx = find_sp_col(['เป้าหมายส่งมอบ 4', 'เป้าหมาย 4'])
    sp_target5_idx = find_sp_col(['เป้าหมายส่งมอบ 5', 'เป้าหมาย 5'])
    sp_target_latest_idx = find_sp_col(['เป้าหมายล่าสุด', 'Target Latest'])
    sp_po_pr_idx = find_sp_col(['po/pr', 'po / pr'])
    sp_remark_idx = find_sp_col(['หมายเหตุ', 'Remark', 'Note'])
    sp_dwg_status_idx = find_sp_col(['สถานะแบบ', 'DWG', 'แบบ'])
    sp_closed_idx = find_sp_col(['Closed', 'closed', 'close', 'ปิดงาน', 'ปิด'])

    sp_items = []
    sp_counter = 0

    for i in range(sp_header_row_idx + 1, len(sp_rows)):
        r = sp_rows[i]
        if not r or len(r) < 5 or not any(c.strip() for c in r):
            continue

        def get_sp_val(idx, fallback_idx):
            target = idx if idx != -1 else fallback_idx
            return r[target].strip() if target < len(r) and r[target] else ''

        raw_dwg = get_sp_val(sp_dwg_status_idx, 27)
        if 'ยกเลิกผลิต' in raw_dwg or 'ไม่สั่งผลิต' in raw_dwg:
            continue

        doc_ref = get_sp_val(sp_doc_ref_idx, 0)
        action_topic = get_sp_val(sp_action_topic_idx, 1) or 'สั่งผลิต/สั่งซื้อ ตามใบเสนอราคา'
        ncr_no = get_sp_val(sp_ncr_idx, 2)
        project_code = get_sp_val(sp_proj_code_idx, 3)
        project_name = get_sp_val(sp_proj_name_idx, 4)
        doc_type = get_sp_val(sp_doc_type_idx, 5) or 'เอกสาร 04'
        raw_doc_04 = get_sp_val(sp_doc04_idx, 6)
        raw_machine_col = get_sp_val(sp_machine_idx, 7)
        item_code = get_sp_val(sp_item_code_idx, 8)
        item_name = get_sp_val(sp_item_name_idx, 9)
        qty_str = get_sp_val(sp_qty_idx, 10)
        prod_order = get_sp_val(sp_prod_order_idx, 12)
        pd_act_line = get_sp_val(sp_pd_act_line_idx, 13)
        notify_date = get_sp_val(sp_notify_date_idx, 14)
        week = get_sp_val(sp_week_idx, 15)
        target_req = get_sp_val(sp_target_req_idx, 16)
        req_dept = get_sp_val(sp_dept_idx, 17)
        req_name = get_sp_val(sp_req_name_idx, 18)
        target1 = get_sp_val(sp_target1_idx, 19)
        target2 = get_sp_val(sp_target2_idx, 20)
        target3 = get_sp_val(sp_target3_idx, 21)
        target4 = get_sp_val(sp_target4_idx, 22)
        target5 = get_sp_val(sp_target5_idx, 23)
        raw_target_latest = get_sp_val(sp_target_latest_idx, 24)
        po_pr = get_sp_val(sp_po_pr_idx, 25)
        remark = get_sp_val(sp_remark_idx, 26)
        closed = get_sp_val(sp_closed_idx, 28)

        machine_name = raw_doc_04 or '(ไม่ระบุเอกสาร 04)'
        # Service Purchase: เป้าหมายให้ดูใน Column Y (เป้าหมายล่าสุด)
        target_latest = raw_target_latest or target5 or target4 or target3 or target2 or target1 or target_req

        # พร้อมใส่ในช่องประวัติเลื่อนเป้าด้วย (ถ้า target1 ว่าง ให้ใช้ targetLatest จาก Column Y)
        if not target1 and target_latest:
            target1 = target_latest
        elif target1 and target_latest and target1 != target_latest:
            if not target2:
                target2 = target_latest
            elif not target3 and target2 != target_latest:
                target3 = target_latest
            elif not target4 and target3 != target_latest:
                target4 = target_latest
            elif not target5 and target4 != target_latest:
                target5 = target_latest

        qty = 1
        if qty_str:
            try:
                qty = float(qty_str.replace(',', ''))
                if qty.is_integer():
                    qty = int(qty)
            except:
                qty = 1

        if not prod_order and item_code:
            proj_item_key = f"{project_code.strip()}|{item_code.strip()}"
            prod_order = item_pd_map.get('byProjItem', {}).get(proj_item_key) or item_pd_map.get('byItem', {}).get(item_code.strip()) or ''

        item_pds = extract_pd_numbers(prod_order)
        matched_qc_pds = [p for p in item_pds if p in qc_map]
        best_qc = pick_latest_qc_meta(item_pds, qc_map)
        qc_action = best_qc.get('action', '') if best_qc else ''
        wh_status = get_qc_warehouse_status(qc_action)
        is_qc_passed = wh_status in ('คลัง SEMI', 'คลัง PRD')

        ov_meta = None
        if item_pds:
            matched_metas = [overview_by_pd[p] for p in item_pds if p in overview_by_pd]
            if len(matched_metas) == 1:
                ov_meta = matched_metas[0]
            elif len(matched_metas) > 1:
                all_done = all(m.get('status', '').lower() in ('completed', 'closed', 'close', 'เสร็จแล้ว', 'เสร็จสิ้น') for m in matched_metas)
                if all_done:
                    ov_meta = dict(matched_metas[0])
                    ov_meta['status'] = 'Closed'
                    ov_meta['currentOpStatus'] = 'Completed'
                else:
                    in_prog = [m for m in matched_metas if m.get('status', '').lower() not in ('completed', 'closed', 'close', 'เสร็จแล้ว', 'เสร็จสิ้น')]
                    ov_meta = in_prog[0] if in_prog else matched_metas[0]
        else:
            proj_key = f"{project_code.strip().upper()}|{item_code.strip().upper()}"
            ov_meta = overview_item_map.get('byProjItem', {}).get(proj_key) or overview_item_map.get('byItem', {}).get(item_code.strip().upper())

        if not prod_order and ov_meta and ov_meta.get('prodOrder'):
            prod_order = ov_meta['prodOrder']

        norm_remark = remark.lower()
        norm_closed = closed.lower()
        is_delivered = (
            'ส่งแล้ว' in norm_remark or
            'จัดส่งแล้ว' in norm_remark or
            '*' in norm_remark or
            'close' in norm_remark or
            '*' in norm_closed or
            'close' in norm_closed
        )

        sp_counter += 1
        item_obj = {
            'id': f'sp-item-{sp_counter}',
            'workTag': 'Service Purchase',
            'docRef': doc_ref,
            'projectCode': project_code,
            'projectName': project_name,
            'docType': doc_type or 'เอกสาร 04',
            'machineName': machine_name,
            'machine': raw_machine_col or '',
            'hasMachine': bool(raw_doc_04),
            'itemCode': item_code,
            'itemName': item_name,
            'qty': qty,
            'prodOrder': prod_order,
            'pdActLine': pd_act_line,
            'notifyDate': notify_date,
            'target1': target1,
            'target2': target2,
            'target3': target3,
            'target4': target4,
            'target5': target5,
            'targetLatest': target_latest,
            'poPr': po_pr,
            'remark': remark,
            'status': 'ส่งแล้ว' if is_delivered else 'รอดำเนินการ',
            'rawStatus': raw_dwg,
            'closed': closed,
            'actionTopic': action_topic,
            'ncrNo': ncr_no,
            'requestDept': req_dept,
            'requesterName': req_name,
            'targetRequested': target_req,
            'week': week,
            'isQcPassed': is_qc_passed,
            'qcDate': best_qc.get('qcDate', '') if best_qc else '',
            'qcInspector': best_qc.get('inspector', '') if best_qc else '',
            'qcPassedQty': best_qc.get('qtyPass', '') if best_qc else '',
            'qcTopic': best_qc.get('topic', '') if best_qc else '',
            'qcRemarks': best_qc.get('remarks', '') if best_qc else '',
            'qcAction': qc_action,
            'qcWarehouseStatus': wh_status,
            'qcPdList': matched_qc_pds,
        }
        if ov_meta:
            for k in (
                'status', 'customer', 'project', 'itemCode',
                'readyOp', 'readyOpDesc', 'readyOpWc', 'readyOpNo', 'hasReadyOp',
                'activeOp', 'activeOpDesc', 'activeOpWc', 'activeOpNo',
                'currentOp', 'currentOpDesc', 'currentOpStatus',
                'lastCompletedOp', 'lastCompletedOpDesc', 'lastCompletedOpWc', 'lastCompletedOpNo',
                'isAllCompleted'
            ):
                if k in ov_meta and ov_meta[k] is not None:
                    if k == 'status':
                        item_obj['overviewStatus'] = ov_meta['status']
                    elif k == 'customer':
                        item_obj['overviewCustomer'] = ov_meta['customer']
                    elif k == 'project':
                        item_obj['overviewProject'] = ov_meta['project']
                    elif k == 'itemCode':
                        item_obj['overviewItemCode'] = ov_meta['itemCode']
                    else:
                        item_obj[k] = ov_meta[k]

        sp_items.append(item_obj)

    sp_out_path = os.path.join(data_dir, 'defaultServicePurchaseItems.json')
    with open(sp_out_path, 'w', encoding='utf-8') as f:
        json.dump(sp_items, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(sp_items)} Service Purchase items to {sp_out_path}")

if __name__ == '__main__':
    main()
