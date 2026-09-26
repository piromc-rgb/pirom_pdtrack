import os
import re
import csv
import io
import json
import urllib.request

SHEET1_CSV_URL = 'https://docs.google.com/spreadsheets/d/1l5FbiznQNUhIpUNuma9iivKzYvcaCTiL7Z_9mDcCijE/export?format=csv&gid=472754949'
SHEET2_CSV_URL = 'https://docs.google.com/spreadsheets/d/1YLgaxdeJR_MCHJhFkoAPAJfGmvUJB2K9GPgirYqlhPE/export?format=csv&gid=1308741309'

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

    # Tag existing defaultData.json items as Service
    for item in default_service_items:
        item['workTag'] = 'Service'
    with open(os.path.join(data_dir, 'defaultData.json'), 'w', encoding='utf-8') as f:
        json.dump(default_service_items, f, ensure_ascii=False, indent=2)

    existing_service_keys = set()
    for item in default_service_items:
        k = f"{norm(item.get('docRef'))}|{norm(item.get('machineName'))}|{norm(item.get('itemCode'))}"
        existing_service_keys.add(k)

    print("Fetching Sheet 2 CSV...")
    csv_text = urllib.request.urlopen(SHEET2_CSV_URL).read().decode('utf-8')
    rows = list(csv.reader(io.StringIO(csv_text)))

    project_items = []
    idx_counter = 0

    for i in range(2, len(rows)):
        r = rows[i]
        if not r or len(r) < 10:
            continue

        def get_val(idx):
            return r[idx].strip() if idx < len(r) and r[idx] else ''

        action_topic = get_val(1)
        if action_topic != 'สั่งผลิตเครื่องจักรตาม Machine List':
            continue

        raw_dwg = get_val(25)
        if 'ยกเลิกผลิต' in raw_dwg or 'ไม่สั่งผลิต' in raw_dwg:
            continue

        doc_ref = get_val(0)
        ncr_no = get_val(2)
        project_code = get_val(3)
        project_name = get_val(4)
        doc_type = get_val(5)
        raw_machine = get_val(6)
        item_code = get_val(7)
        item_name = get_val(8)
        qty_str = get_val(9)
        prod_order = get_val(10)
        pd_act_line = get_val(11)
        notify_date = get_val(12)
        week = get_val(13)
        target_req = get_val(14)
        req_dept = get_val(15)
        req_name = get_val(16)
        target1 = get_val(17)
        target2 = get_val(18)
        target3 = get_val(19)
        target4 = get_val(20)
        target5 = get_val(21)
        raw_target_latest = get_val(22)
        po_pr = get_val(23)
        remark = get_val(24)
        closed = get_val(26)

        machine_name = raw_machine or '(ไม่ระบุเครื่องจักร)'
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
        is_qc_passed = len(matched_qc_pds) > 0
        first_qc = qc_map.get(matched_qc_pds[0]) if is_qc_passed else None

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
            'hasMachine': bool(raw_machine),
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
            'qcDate': first_qc.get('qcDate', '') if first_qc else '',
            'qcInspector': first_qc.get('inspector', '') if first_qc else '',
            'qcPassedQty': first_qc.get('qtyPass', '') if first_qc else '',
            'qcTopic': first_qc.get('topic', '') if first_qc else '',
            'qcRemarks': first_qc.get('remarks', '') if first_qc else '',
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

if __name__ == '__main__':
    main()
