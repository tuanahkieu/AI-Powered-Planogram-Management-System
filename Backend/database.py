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
            _client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000, tlsCAFile=certifi.where())
            _client.admin.command("ping")
            _db = _client[db_name]
            print(f"✅ Kết nối MongoDB thành công: {db_name}")
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            print(f"❌ Không thể kết nối MongoDB: {e}")
            _db = None
    return _db


# ─── Planogram Collection ─────────────────────────────────────────────────────

def save_planogram(name: str, display_name: str, shelves: list, products: list = None) -> dict:
    """
    Lưu hoặc cập nhật một planogram vào MongoDB.

    Args:
        name:         Key slug (e.g. "planogram_ke_1")
        display_name: Tên hiển thị trên UI (e.g. "Kệ Nước Giải Khát")
        shelves:      list[list[str]] — tên sản phẩm từng tầng
        products:     Danh mục sản phẩm snapshot (optional)
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
    if products is not None:
        doc["products"] = products

    result = collection.update_one(
        {"name": name},
        {"$set": doc, "$setOnInsert": {"created_at": now}},
        upsert=True
    )
    inserted_id = result.upserted_id or collection.find_one({"name": name})["_id"]
    return {"id": str(inserted_id), "name": name, "display_name": display_name}


def get_planogram(name: str) -> dict | None:
    """Lấy một planogram theo tên slug."""
    db = get_db()
    if db is None:
        raise RuntimeError("Không có kết nối MongoDB")

    doc = db["planograms"].find_one({"name": name})
    if doc:
        doc["_id"] = str(doc["_id"])
    return doc


def list_planograms() -> list:
    """Lấy danh sách tất cả planogram (id, name, display_name, updated_at)."""
    db = get_db()
    if db is None:
        raise RuntimeError("Không có kết nối MongoDB")

    docs = db["planograms"].find(
        {},
        {"name": 1, "display_name": 1, "updated_at": 1, "_id": 1}
    ).sort("updated_at", DESCENDING)

    return [
        {
            "id":           str(d["_id"]),
            "name":         d["name"],
            "display_name": d.get("display_name", d["name"]),
            "updated_at":   str(d.get("updated_at", ""))
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

def save_compliance_result(planogram_name: str, status: str, issues: list, actual_layout: list) -> str:
    """Lưu kết quả kiểm tra compliance."""
    db = get_db()
    if db is None:
        raise RuntimeError("Không có kết nối MongoDB")

    doc = {
        "planogram_name": planogram_name,
        "status":         status,
        "issues":         issues,
        "actual_layout":  actual_layout,
        "checked_at":     datetime.utcnow()
    }
    result = db["compliance_logs"].insert_one(doc)
    return str(result.inserted_id)


def get_compliance_logs(planogram_name: str = None, limit: int = 20) -> list:
    """Lấy lịch sử kiểm tra compliance."""
    db = get_db()
    if db is None:
        raise RuntimeError("Không có kết nối MongoDB")

    query = {"planogram_name": planogram_name} if planogram_name else {}
    docs = db["compliance_logs"].find(query).sort("checked_at", DESCENDING).limit(limit)
    return [
        {**d, "_id": str(d["_id"]), "checked_at": str(d["checked_at"])}
        for d in docs
    ]


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
