import os
import io
import torch
from dotenv import load_dotenv

# Load .env sớm nhất có thể
load_dotenv()

# Bypass PyTorch 2.6+ weights_only restriction cleanly
_original_load = torch.load
def _custom_load(*args, **kwargs):
    kwargs['weights_only'] = False
    return _original_load(*args, **kwargs)
torch.load = _custom_load

from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from ultralytics import YOLO
from PIL import Image

app = Flask(__name__)
CORS(app) # Enable CORS so frontend can communicate

import json

# ─── MongoDB ─────────────────────────────────────────────────────────────────
try:
    from database import (
        save_planogram as mongo_save_planogram,
        get_planogram  as mongo_get_planogram,
        list_planograms as mongo_list_planograms,
        delete_planogram as mongo_delete_planogram,
        save_compliance_result,
        get_compliance_logs,
        delete_compliance_log,
        save_products as mongo_save_products,
        get_products  as mongo_get_products,
        save_contract as mongo_save_contract,
        list_contracts as mongo_list_contracts,
        delete_contract as mongo_delete_contract,
        list_stores as mongo_list_stores,
        save_store as mongo_save_store,
        delete_store as mongo_delete_store,
        get_db
    )
    MONGO_AVAILABLE = get_db() is not None
except Exception as e:
    print(f"⚠️  MongoDB không khả dụng, dùng JSON fallback: {e}")
    MONGO_AVAILABLE = False
# ─────────────────────────────────────────────────────────────────────────────

# Load the YOLO model relative to the script location
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(BASE_DIR, 'best.pt')
if os.path.exists(model_path):
    model = YOLO(model_path)
else:
    model = None
    print(f"Warning: Model file {model_path} not found.")

def load_planogram(filename=None):
    if filename:
        name_slug = filename.replace('.json', '')
        if MONGO_AVAILABLE:
            try:
                doc = mongo_get_planogram(name_slug)
                if doc:
                    return doc
            except Exception as e:
                print(f"Lỗi khi lấy kệ từ MongoDB: {e}")
                
        # Sanitize to prevent path traversal
        import re
        filename = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', filename)
        if not filename.endswith('.json'):
            filename += '.json'
        plan_path = os.path.join(BASE_DIR, filename)
    else:
        if MONGO_AVAILABLE:
            try:
                doc = mongo_get_planogram('planogram5')
                if doc:
                    return doc
            except Exception as e:
                pass
        plan_path = os.path.join(BASE_DIR, 'planogram5.json')
        
    if os.path.exists(plan_path):
        with open(plan_path, 'r') as f:
            return json.load(f)
    return {"shelves": []}

@app.route('/api/compliance', methods=['POST'])
def check_compliance():
    if model is None:
         return jsonify({'error': 'AI Model not loaded on server.'}), 500
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in request.'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file.'}), 400
        
    try:
        img = Image.open(file.stream).convert('RGB')
        results = model(img, conf=0.12, iou=0.45)
        
        # 1. Parse Detections
        items = []
        for r in results:
            boxes = r.boxes
            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                cls = int(box.cls[0])
                name = model.names[cls]
                items.append({
                    "name": name,
                    "cx": cx, "cy": cy,
                    "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                    "conf": float(box.conf[0])
                })
        
        # 1.5 Manual Deduplication (NMS) to prevent "position 10" ghost boxes
        def get_iou(boxA, boxB):
            xA = max(boxA[0], boxB[0])
            yA = max(boxA[1], boxB[1])
            xB = min(boxA[2], boxB[2])
            yB = min(boxA[3], boxB[3])
            interArea = max(0, xB - xA) * max(0, yB - yA)
            boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
            boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
            return interArea / float(boxAArea + boxBArea - interArea + 1e-6)

        items.sort(key=lambda x: x["conf"], reverse=True)
        final_items = []
        for item in items:
            keep = True
            for f_item in final_items:
                if get_iou([item["x1"], item["y1"], item["x2"], item["y2"]], 
                           [f_item["x1"], f_item["y1"], f_item["x2"], f_item["y2"]]) > 0.4:
                    keep = False
                    break
            if keep:
                final_items.append(item)
        items = final_items
        
        # 2. Group into Shelves (rows) based on Y-center
        items.sort(key=lambda x: x["cy"])
        shelves = []
        if items:
            current_shelf = [items[0]]
            
            for item in items[1:]:
                # Lấy chiều cao lớn hơn giữa vật phẩm trước và hiện tại làm cơ sở
                prev_item = current_shelf[-1]
                threshold = max((prev_item["y2"] - prev_item["y1"]), (item["y2"] - item["y1"])) * 0.7
                
                # So sánh với trung bình cy của các lon trong shelf hiện tại
                mean_cy = sum([i["cy"] for i in current_shelf]) / len(current_shelf)
                
                if abs(item["cy"] - mean_cy) < threshold:
                    current_shelf.append(item)
                else:
                    shelves.append(current_shelf)
                    current_shelf = [item]
            shelves.append(current_shelf)
            
        # 3. Sort each shelf left-to-right (by X-center)
        actual_layout = []
        for shelf in shelves:
            shelf.sort(key=lambda x: x["cx"])
            actual_layout.append([item["name"] for item in shelf])
            
        # 4. Compare with Planogram
        planogram_file = request.form.get('planogram_file')
        planogram_str  = request.form.get('planogram')

        if planogram_file:
            # File được chọn từ dropdown → luôn ưu tiên
            planogram_data = load_planogram(planogram_file)
        elif planogram_str:
            import json
            try:
                planogram_data = json.loads(planogram_str)
                if not planogram_data.get("shelves"):
                    planogram_data = load_planogram()
            except Exception as e:
                print(f"Error parsing form planogram: {str(e)}")
                planogram_data = load_planogram()
        else:
            planogram_data = load_planogram()

            
        expected_layout = planogram_data.get("shelves", [])
        
        issues = []
        status = "PASSED"
        
        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)
        
        # SequenceMatcher comparison approach
        import difflib
        for i, expected_row in enumerate(expected_layout):
            if i >= len(actual_layout):
                issues.append(f"Thiếu hoàn toàn Tầng {i+1}! Mong đợi: {expected_row}")
                status = "FAILED"
                continue
                
            actual_row = actual_layout[i]
            actual_items_in_row = shelves[i]
            
            matcher = difflib.SequenceMatcher(None, expected_row, actual_row)
            
            for tag, i1, i2, j1, j2 in matcher.get_opcodes():
                if tag == 'equal':
                    for j in range(j1, j2):
                        item_data = actual_items_in_row[j]
                        box = [item_data["x1"], item_data["y1"], item_data["x2"], item_data["y2"]]
                        draw.rectangle(box, outline="green", width=3)
                elif tag == 'replace':
                    # Phân tích kỹ hơn trong khối replace để tránh nhận diện nhầm
                    max_k = max(i2-i1, j2-j1)
                    for k in range(max_k):
                        e_idx = i1 + k
                        a_idx = j1 + k
                        
                        if e_idx < i2 and a_idx < j2:
                            expected_item = expected_row[e_idx]
                            actual_item = actual_row[a_idx]
                            item_data = actual_items_in_row[a_idx]
                            box = [item_data["x1"], item_data["y1"], item_data["x2"], item_data["y2"]]
                            
                            if actual_item == expected_item or (actual_item.startswith(expected_item) and expected_item in ["olong-tea", "pepsi-blue", "7up"]):
                                # Nếu thực tế khớp tên hoặc là biến thể (chai/lon) của nhau
                                draw.rectangle(box, outline="green", width=3)
                            else:
                                issues.append(f"Tầng {i+1}, Vị trí {a_idx+1}: Sai sản phẩm '{actual_item}', Sản phẩm đúng '{expected_item}'")
                                status = "FAILED"
                                draw.rectangle(box, outline="red", width=5)
                        elif e_idx < i2:
                            expected_item = expected_row[e_idx]
                            issues.append(f"Tầng {i+1}: Thiếu '{expected_item}' (tại vị trí chuẩn {e_idx+1})")
                            status = "FAILED"
                        elif a_idx < j2:
                            actual_item = actual_row[a_idx]
                            item_data = actual_items_in_row[a_idx]
                            box = [item_data["x1"], item_data["y1"], item_data["x2"], item_data["y2"]]
                            issues.append(f"Tầng {i+1}, Vị trí {a_idx+1}: Dư thừa '{actual_item}'")
                            status = "FAILED"
                            draw.rectangle(box, outline="red", width=5)
                elif tag == 'delete':
                    for k in range(i1, i2):
                        expected_item = expected_row[k]
                        issues.append(f"Tầng {i+1}: Thiếu '{expected_item}' (sau vị trí thực tế {j1})")
                        status = "FAILED"
                elif tag == 'insert':
                    for k in range(j1, j2):
                        actual_item = actual_row[k]
                        item_data = actual_items_in_row[k]
                        box = [item_data["x1"], item_data["y1"], item_data["x2"], item_data["y2"]]
                        issues.append(f"Tầng {i+1}, Vị trí {k+1}: Thừa '{actual_item}'")
                        status = "FAILED"
                        draw.rectangle(box, outline="red", width=5)
                    
        if len(actual_layout) > len(expected_layout):
            issues.append(f"Phát hiện thừa {len(actual_layout) - len(expected_layout)} tầng so với chuẩn (planogram)!")
            status = "FAILED"
            for i in range(len(expected_layout), len(actual_layout)):
                for item_data in shelves[i]:
                    box = [item_data["x1"], item_data["y1"], item_data["x2"], item_data["y2"]]
                    draw.rectangle(box, outline="red", width=5)
        
        import base64
        import io
        img_buffer = io.BytesIO()
        img.save(img_buffer, format='JPEG', quality=90)
        img_buffer.seek(0)
        base64_img = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
        data_uri = f"data:image/jpeg;base64,{base64_img}"
            
        if MONGO_AVAILABLE:
            store_id = request.form.get('store_id', '')
            pog_display = request.form.get('planogram_display_name', 'Unknown Shelf')
            if store_id:
                try:
                    save_compliance_result(store_id, pog_display, status, issues, actual_layout, data_uri)
                except Exception as ex:
                    print(f"Error saving compliance log: {ex}")

        return jsonify({
            "success": True,
            "status": status,
            "issues": issues,
            "annotated_image": data_uri,
            "actual_layout": actual_layout,
            "expected_layout": expected_layout
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/detect', methods=['POST'])
def detect():
    if model is None:
         return jsonify({'error': 'AI Model not loaded on server.'}), 500

    if 'file' not in request.files:
        return jsonify({'error': 'No file part in request.'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file.'}), 400
        
    try:
        # Load image via PIL
        img = Image.open(file.stream).convert('RGB')
        
        # Inference
        results = model(img)
        
        detections = []
        for r in results:
            boxes = r.boxes
            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                cls = int(box.cls[0])
                name = model.names[cls]
                
                detections.append({
                    "class_name": name,
                    "confidence": round(conf, 4),
                    "box": {
                        "x1": round(x1, 2),
                        "y1": round(y1, 2),
                        "x2": round(x2, 2),
                        "y2": round(y2, 2)
                    }
                })
        
        return jsonify({
            "success": True,
            "total_objects": len(detections),
            "detections": detections
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/model-labels', methods=['GET'])
def get_model_labels():
    """Lấy danh sách các nhãn (class names) từ model YOLO best.pt."""
    if model is None:
        return jsonify({'error': 'AI Model not loaded on server.'}), 500
    try:
        # model.names là dictionary dạng {0: 'class1', 1: 'class2'}
        labels = list(model.names.values())
        return jsonify({
            "success": True,
            "labels": labels
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/planograms', methods=['GET'])
def list_planograms():
    """List planograms — ưu tiên MongoDB, fallback về file JSON."""
    try:
        store_id = request.args.get('store_id')
        if MONGO_AVAILABLE:
            items = mongo_list_planograms(store_id)
            files = [f"{d['name']}.json" for d in items]
            return jsonify({'success': True, 'files': files, 'source': 'mongodb', 'data': items})
        else:
            files = [f for f in os.listdir(BASE_DIR)
                     if f.endswith('.json') and f.startswith('planogram')]
            files.sort()
            data = [
                {
                    'name': f.replace('.json', ''),
                    'display_name': f.replace('.json', '').replace('planogram_', '').replace('_', ' ').title()
                }
                for f in files
            ]
            return jsonify({'success': True, 'files': files, 'source': 'json_file', 'data': data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/save-planogram', methods=['POST'])
def save_planogram():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data received'}), 400

        filename     = data.pop('_filename', None)
        display_name = data.pop('_display_name', None)   # Tên hiển thị từ frontend
        products     = data.pop('_products', None)        # Danh mục sản phẩm snapshot
        store_id     = data.pop('store_id', None)

        if not filename:
            from datetime import datetime
            filename = f"planogram_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        import re
        filename = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', filename)
        if not filename.endswith('.json'):
            filename += '.json'

        shelves      = data.get('shelves', [])
        name         = filename.replace('.json', '')
        display_name = display_name or name

        # ── Kiểm tra hợp đồng active trước khi lưu ───────────────────────
        if MONGO_AVAILABLE:
            try:
                all_contracts = mongo_list_contracts()
                from datetime import datetime as dt
                today = dt.utcnow().date()
                active = [
                    c for c in all_contracts
                    if c.get('shelf_id') == name
                    and c.get('status') == 'active'
                    and c.get('end_date', '') >= today.isoformat()
                ]
                locked_rows = []
                for c in active:
                    for row_idx in (c.get('rows') or []):
                        locked_rows.append({
                            'row': row_idx,
                            'brand': c.get('brand_name', ''),
                            'end_date': c.get('end_date', '')
                        })

                if locked_rows:
                    # Lấy dữ liệu hiện tại từ DB để so sánh
                    current = mongo_get_planogram(name)
                    current_shelves = current.get('shelves', []) if current else []

                    violations = []
                    for lock in locked_rows:
                        row_idx = lock['row']
                        if row_idx >= len(shelves):
                            # Tầng bị xóa hoàn toàn
                            violations.append(
                                f"Tầng {row_idx + 1} đang có hợp đồng với '{lock['brand']}' (hết hạn {lock['end_date']}) — không thể xóa"
                            )
                        elif row_idx < len(current_shelves):
                            current_row = set(current_shelves[row_idx])
                            new_row = set(shelves[row_idx])
                            removed = current_row - new_row
                            if removed:
                                violations.append(
                                    f"Tầng {row_idx + 1} đang có hợp đồng với '{lock['brand']}' — không thể xóa sản phẩm: {', '.join(removed)}"
                                )

                    if violations:
                        return jsonify({
                            'error': 'Không thể lưu: một số tầng đang bị khóa bởi hợp đồng active',
                            'violations': violations,
                            'locked_rows': [l['row'] for l in locked_rows]
                        }), 409
            except Exception as contract_err:
                print(f"⚠️ Lỗi kiểm tra hợp đồng: {contract_err}")
        # ─────────────────────────────────────────────────────────────────

        if MONGO_AVAILABLE:
            result = mongo_save_planogram(
                name=name,
                display_name=display_name,
                shelves=shelves,
                products=products,
                store_id=store_id
            )
            return jsonify({
                'success':      True,
                'filename':     filename,
                'display_name': display_name,
                'source':       'mongodb',
                'mongo_id':     result['id']
            })
        else:
            return jsonify({'error': 'MongoDB không khả dụng'}), 503

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stores', methods=['GET'])
def list_stores_route():
    if not MONGO_AVAILABLE:
        return jsonify({'error': 'MongoDB không khả dụng'}), 503
    try:
        stores = mongo_list_stores()
        return jsonify({'success': True, 'stores': stores})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stores', methods=['POST'])
def create_store_route():
    if not MONGO_AVAILABLE:
        return jsonify({'error': 'MongoDB không khả dụng'}), 503
    try:
        data = request.get_json()
        name = data.get('name')
        if not name:
            return jsonify({'error': 'Thiếu tên cửa hàng'}), 400
        result = mongo_save_store(name)
        return jsonify({'success': True, 'store': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/stores/<store_id>', methods=['DELETE'])
def delete_store_route(store_id):
    if not MONGO_AVAILABLE:
        return jsonify({'error': 'MongoDB không khả dụng'}), 503
    try:
        success = mongo_delete_store(store_id)
        if success:
            return jsonify({'success': True, 'message': 'Đã xóa cửa hàng'})
        return jsonify({'success': False, 'error': 'Không tìm thấy cửa hàng'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/products', methods=['GET'])
def get_products_route():
    """Lấy danh mục sản phẩm từ MongoDB."""
    if not MONGO_AVAILABLE:
        return jsonify({'error': 'MongoDB không khả dụng'}), 503
    try:
        products = mongo_get_products()
        return jsonify({'success': True, 'products': products})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/products', methods=['POST'])
def save_products_route():
    """Lưu toàn bộ danh mục sản phẩm lên MongoDB."""
    if not MONGO_AVAILABLE:
        return jsonify({'error': 'MongoDB không khả dụng'}), 503
    try:
        data = request.get_json()
        if not data or 'products' not in data:
            return jsonify({'error': 'Thiếu trường products'}), 400
        mongo_save_products(data['products'])
        return jsonify({'success': True, 'count': len(data['products'])})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/planograms/<name>', methods=['GET'])
def get_planogram_route(name):
    """Lấy chi tiết một planogram (shelves + products) theo tên slug."""
    try:
        if MONGO_AVAILABLE:
            doc = mongo_get_planogram(name)
            if doc:
                return jsonify({'success': True, 'planogram': doc})
            return jsonify({'error': 'Không tìm thấy planogram'}), 404
        else:
            # Fallback: đọc từ file JSON
            plan_path = os.path.join(BASE_DIR, name + '.json')
            if os.path.exists(plan_path):
                with open(plan_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                return jsonify({'success': True, 'planogram': data})
            return jsonify({'error': 'Không tìm thấy file'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500




@app.route('/api/compliance-logs', methods=['GET'])
def compliance_logs():
    """Lấy lịch sử kiểm tra compliance từ MongoDB."""
    if not MONGO_AVAILABLE:
        return jsonify({'error': 'MongoDB không khả dụng'}), 503
    try:
        store_id = request.args.get('store_id')
        limit = int(request.args.get('limit', 50))
        logs = get_compliance_logs(store_id, limit)
        # Avoid sending massive images in list view to save bandwidth
        for log in logs:
            if 'annotated_image' in log:
                # We can keep a snippet or remove it if not needed in the initial load, 
                # but since it's a small app we'll send it for now, or just send a flag
                pass 
        return jsonify({'success': True, 'logs': logs})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/compliance-logs/<log_id>', methods=['DELETE'])
def delete_compliance_log_route(log_id):
    """Xóa một bản ghi compliance log."""
    if not MONGO_AVAILABLE:
        return jsonify({'error': 'MongoDB không khả dụng'}), 503
    try:
        deleted = delete_compliance_log(log_id)
        if deleted:
            return jsonify({'success': True, 'message': 'Đã xóa lịch sử thành công'})
        return jsonify({'error': 'Không tìm thấy lịch sử hoặc không thể xóa'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/planograms/<name>', methods=['DELETE'])
def delete_planogram_route(name):
    """Xóa một planogram khỏi MongoDB."""
    if not MONGO_AVAILABLE:
        return jsonify({'error': 'MongoDB không khả dụng'}), 503
    try:
        deleted = mongo_delete_planogram(name)
        if deleted:
            return jsonify({'success': True, 'message': f"Đã xóa '{name}'"})
        return jsonify({'error': 'Không tìm thấy planogram'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Contracts API ────────────────────────────────────────────────────────────

CONTRACTS_FILE = os.path.join(BASE_DIR, 'contracts.json')

def _load_contracts_json():
    if os.path.exists(CONTRACTS_FILE):
        with open(CONTRACTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def _save_contracts_json(contracts):
    with open(CONTRACTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(contracts, f, ensure_ascii=False, indent=2)


@app.route('/api/contracts', methods=['GET'])
def get_contracts():
    """Lấy danh sách tất cả hợp đồng."""
    try:
        if MONGO_AVAILABLE:
            contracts = mongo_list_contracts()
        else:
            contracts = _load_contracts_json()
        return jsonify({'success': True, 'contracts': contracts})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/contracts', methods=['POST'])
def create_contract():
    """Tạo hợp đồng mới."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Không có dữ liệu'}), 400

        required = ['brand_name', 'shelf_id', 'shelf_name', 'rows', 'end_date']
        for field in required:
            if field not in data:
                return jsonify({'error': f'Thiếu trường: {field}'}), 400

        if MONGO_AVAILABLE:
            result = mongo_save_contract(data)
            return jsonify({'success': True, 'id': result['id'], 'source': 'mongodb'})
        else:
            from datetime import datetime as dt
            import uuid
            contracts = _load_contracts_json()
            data['_id'] = str(uuid.uuid4())
            data['created_at'] = dt.utcnow().isoformat()
            contracts.insert(0, data)
            _save_contracts_json(contracts)
            return jsonify({'success': True, 'id': data['_id'], 'source': 'json_file'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/contracts/<contract_id>', methods=['DELETE'])
def delete_contract_route(contract_id):
    """Xóa một hợp đồng."""
    try:
        if MONGO_AVAILABLE:
            deleted = mongo_delete_contract(contract_id)
            if deleted:
                return jsonify({'success': True})
            return jsonify({'error': 'Không tìm thấy hợp đồng'}), 404
        else:
            contracts = _load_contracts_json()
            new_list = [c for c in contracts if c.get('_id') != contract_id]
            if len(new_list) == len(contracts):
                return jsonify({'error': 'Không tìm thấy hợp đồng'}), 404
            _save_contracts_json(new_list)
            return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/contracts/shelf/<shelf_id>', methods=['GET'])
def get_contracts_by_shelf(shelf_id):
    """Lấy các hợp đồng active của một kệ — dùng để lock UI trong planogram editor."""
    try:
        if MONGO_AVAILABLE:
            all_contracts = mongo_list_contracts()
        else:
            all_contracts = _load_contracts_json()

        from datetime import datetime as dt
        today = dt.utcnow().date().isoformat()
        active = [
            c for c in all_contracts
            if c.get('shelf_id') == shelf_id
            and c.get('status') == 'active'
            and c.get('end_date', '') >= today
        ]
        # Trả về danh sách tầng bị khóa + thông tin brand
        locked = []
        for c in active:
            for row_idx in (c.get('rows') or []):
                locked.append({
                    'row':       row_idx,
                    'brand':     c.get('brand_name', ''),
                    'color':     c.get('brand_color', '#6366f1'),
                    'end_date':  c.get('end_date', ''),
                    'contract_id': c.get('_id', '')
                })
        return jsonify({'success': True, 'locked_rows': locked})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)
