"""
database.py — MongoDB connection & helper functions
Dùng để quản lý kết nối và các thao tác CRUD với MongoDB.

Collections:
  - planograms    : Dữ liệu planogram (kệ hàng)
  - products      : Danh mục sản phẩm
  - contracts     : Hợp đồng nhãn hàng
  - compliance_logs: Lịch sử kiểm tra
"""

import os
import certifi
from datetime import datetime
from dotenv import load_dotenv
from pymongo import MongoClient, DESCENDING
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

# Load biến môi trường từ .env
load_dotenv()

# ─── Kết nối MongoDB ─────────────────────────────────────────────────────────
_client = None
_db = None

def get_db():
    """Trả về database instance (singleton pattern)."""
    global _client, _db
    if _db is None:
        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/planogram_db")
        db_name   = os.getenv("MONGO_DB_NAME", "planogram_db")
        try:
            _client = MongoClient(
                mongo_uri, 
                serverSelectionTimeoutMS=5000, 
                tlsCAFile=certifi.where(),
                tlsAllowInvalidCertificates=True
            )
            _client.admin.command("ping")
            _db = _client[db_name]
            print(f"✅ Kết nối MongoDB thành công: {db_name}")
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            print(f"❌ Không thể kết nối MongoDB: {e}")
            _db = None
    return _db


# ─── Stores Collection ────────────────────────────────────────────────────────
def save_store(name: str) -> dict:
    """Tạo hoặc cập nhật một cửa hàng mới."""
    db = get_db()
    if db is None:
        raise RuntimeError("Không có kết nối MongoDB")
    
    collection = db["stores"]
    now = datetime.utcnow()
    # Dùng uuid hoặc generate slug từ name
    import uuid
    store_id = f"store_{uuid.uuid4().hex[:8]}"
    doc = {
        "store_id": store_id,
        "name": name,
        "created_at": now
    }
    
    result = collection.insert_one(doc)
    return {"id": str(result.inserted_id), "store_id": store_id, "name": name}

def list_stores() -> list:
    """Lấy danh sách tất cả cửa hàng."""
    db = get_db()
    if db is None:
        return []
    docs = db["stores"].find({}, {"_id": 0}).sort("created_at", DESCENDING)
    return list(docs)

def delete_store(store_id: str) -> bool:
    """Xóa một cửa hàng theo store_id."""
    db = get_db()
    if db is None:
        raise RuntimeError("Không có kết nối MongoDB")
    
    result = db["stores"].delete_one({"store_id": store_id})
    return result.deleted_count > 0


# ─── Planogram Collection ─────────────────────────────────────────────────────

def save_planogram(name: str, display_name: str, shelves: list, products: list = None, store_id: str = None) -> dict:
    """
    Lưu hoặc cập nhật một planogram vào MongoDB.

    Args:
        name:         Key slug (e.g. "planogram_ke_1")
        display_name: Tên hiển thị trên UI (e.g. "Kệ Nước Giải Khát")
        shelves:      list[list[str]] — tên sản phẩm từng tầng
        products:     Danh mục sản phẩm snapshot (optional)
        store_id:     ID của cửa hàng (optional)
    """
    db = get_db()
    if db is None:
        raise RuntimeError("Không có kết nối MongoDB")

    collection = db["planograms"]
    now = datetime.utcnow()
    doc = {
        "name":         name,
        "display_name": display_name,
        "shelves":      shelves,
        "updated_at":   now,
    }
    if store_id is not None:
        doc["store_id"] = store_id
    if products is not None:
        doc["products"] = products

    result = collection.update_one(
        {"name": name},
        {"$set": doc, "$setOnInsert": {"created_at": now}},
        upsert=True
    )
    inserted_id = result.upserted_id or collection.find_one({"name": name})["_id"]
    return {"id": str(inserted_id), "name": name, "display_name": display_name}


def get_planogram(name: str, store_id: str = None) -> dict | None:
    """Lấy một planogram theo tên slug (và có thể filter theo store_id)."""
    db = get_db()
    if db is None:
        raise RuntimeError("Không có kết nối MongoDB")

    query = {"name": name}
    if store_id:
        query["store_id"] = store_id

    doc = db["planograms"].find_one(query)
    if doc:
        doc["_id"] = str(doc["_id"])
    return doc


def list_planograms(store_id: str = None) -> list:
    """Lấy danh sách tất cả planogram (id, name, display_name, updated_at, shelves, tier_names, store_id)."""
    db = get_db()
    if db is None:
        raise RuntimeError("Không có kết nối MongoDB")

    query = {}
    if store_id:
        query["store_id"] = store_id

    docs = db["planograms"].find(
        query,
        {"name": 1, "display_name": 1, "updated_at": 1, "shelves": 1, "tier_names": 1, "store_id": 1, "_id": 1}
    ).sort("updated_at", DESCENDING)

    return [
        {
            "id":           str(d["_id"]),
            "name":         d["name"],
            "display_name": d.get("display_name", d["name"]),
            "updated_at":   str(d.get("updated_at", "")),
            "shelves":      d.get("shelves", []),
            "tier_names":   d.get("tier_names", []),
            "store_id":     d.get("store_id", None)
        }
        for d in docs
    ]


def delete_planogram(name: str) -> bool:
    """Xóa planogram theo tên slug."""
    db = get_db()
    if db is None:
        raise RuntimeError("Không có kết nối MongoDB")

    result = db["planograms"].delete_one({"name": name})
    return result.deleted_count > 0


# ─── Products Collection ──────────────────────────────────────────────────────

def save_products(products: list) -> bool:
    """
    Lưu toàn bộ danh mục sản phẩm (overwrite).
    products: list of { id, name, code, category, color }
    """
    db = get_db()
    if db is None:
        raise RuntimeError("Không có kết nối MongoDB")

    col = db["products"]
    col.delete_many({})
    if products:
        col.insert_many(products)
    return True


def get_products() -> list:
    """Lấy toàn bộ danh mục sản phẩm."""
    db = get_db()
    if db is None:
        raise RuntimeError("Không có kết nối MongoDB")

    return list(db["products"].find({}, {"_id": 0}))


# ─── Compliance Log Collection ────────────────────────────────────────────────

def save_compliance_result(store_id: str, planogram_display_name: str, status: str, issues: list, actual_layout: list, annotated_image: str) -> str:
    """Lưu kết quả kiểm tra compliance."""
    db = get_db()
    if db is None:
        raise RuntimeError("Không có kết nối MongoDB")

    doc = {
        "store_id":               store_id,
        "planogram_display_name": planogram_display_name,
        "status":                 status,
        "issues":                 issues,
        "actual_layout":          actual_layout,
        "annotated_image":        annotated_image,
        "checked_at":             datetime.utcnow()
    }
    result = db["compliance_logs"].insert_one(doc)
    return str(result.inserted_id)


def get_compliance_logs(store_id: str = None, limit: int = 50) -> list:
    """Lấy lịch sử kiểm tra compliance, ưu tiên lọc theo store_id."""
    db = get_db()
    if db is None:
        raise RuntimeError("Không có kết nối MongoDB")

    query = {"store_id": store_id} if store_id else {}
    docs = db["compliance_logs"].find(query).sort("checked_at", DESCENDING).limit(limit)
    return [
        {**d, "_id": str(d["_id"]), "checked_at": str(d["checked_at"])}
        for d in docs
    ]


def delete_compliance_log(log_id: str) -> bool:
    """Xóa một bản ghi compliance log theo ID."""
    db = get_db()
    if db is None:
        raise RuntimeError("Không có kết nối MongoDB")
    
    from bson.objectid import ObjectId
    try:
        result = db["compliance_logs"].delete_one({"_id": ObjectId(log_id)})
        return result.deleted_count > 0
    except Exception:
        return False


# ─── Contracts Collection ─────────────────────────────────────────────────────

def save_contract(contract: dict) -> dict:
    """
    Lưu một hợp đồng mới hoặc cập nhật hợp đồng cũ.

    contract fields:
        brand_name  : str  — tên nhãn hàng
        brand_code  : str  — mã nhãn hàng (slug)
        brand_color : str  — màu hex cho avatar
        shelf_name  : str  — tên kệ (display_name)
        shelf_id    : str  — slug kệ (e.g. planogram_ke_1)
        rows        : list[int] — các chỉ số hàng được chọn (0-indexed)
        start_date  : str  — ngày bắt đầu (ISO)
        end_date    : str  — ngày kết thúc (ISO)
        status      : str  — 'active' | 'expired' | 'pending'
    """
    db = get_db()
    if db is None:
        raise RuntimeError("Không có kết nối MongoDB")

    col = db["contracts"]
    now = datetime.utcnow()
    doc = {**contract, "updated_at": now}

    if "_id" in doc:
        from bson import ObjectId
        contract_id = doc.pop("_id")
        result = col.update_one({"_id": ObjectId(contract_id)}, {"$set": doc})
        return {"id": str(contract_id)}
    else:
        doc["created_at"] = now
        result = col.insert_one(doc)
        return {"id": str(result.inserted_id)}


def list_contracts() -> list:
    """Lấy tất cả hợp đồng, sắp xếp theo ngày tạo mới nhất."""
    db = get_db()
    if db is None:
        raise RuntimeError("Không có kết nối MongoDB")

    docs = db["contracts"].find({}).sort("created_at", DESCENDING)
    result = []
    for d in docs:
        d["_id"] = str(d["_id"])
        d["created_at"] = str(d.get("created_at", ""))
        d["updated_at"] = str(d.get("updated_at", ""))
        result.append(d)
    return result


def delete_contract(contract_id: str) -> bool:
    """Xóa hợp đồng theo _id."""
    db = get_db()
    if db is None:
        raise RuntimeError("Không có kết nối MongoDB")

    from bson import ObjectId
    result = db["contracts"].delete_one({"_id": ObjectId(contract_id)})
    return result.deleted_count > 0
