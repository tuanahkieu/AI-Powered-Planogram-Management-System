# POG Manager — Hệ thống Quản lý Planogram AI

Ứng dụng quản lý sơ đồ trưng bày sản phẩm (planogram) tích hợp AI, lưu dữ liệu trên MongoDB Atlas.

---

## 📋 Yêu cầu

- **Python 3.12** (Homebrew): `/opt/homebrew/bin/python3.12`
- **Node.js** (nếu dùng live server, không bắt buộc)
- **MongoDB Atlas** hoặc MongoDB local
- File model `best.pt` đặt trong thư mục `Backend/`

---

## ⚙️ Cài đặt lần đầu

### 1. Tạo virtual environment

```bash
cd Backend
python3.12 -m venv venv
```

### 2. Cài dependencies

```bash
venv/bin/python3.12 -m pip install -r requirements.txt
```

### 3. Cấu hình MongoDB

Tạo file `Backend/.env` (nếu chưa có):

```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/planogram_db?retryWrites=true&w=majority
MONGO_DB_NAME=planogram_db
```

> Lấy connection string từ [MongoDB Atlas](https://cloud.mongodb.com) → Connect → Drivers → Python

---

## 🚀 Chạy chương trình

### Backend

```bash
bash Backend/run.sh
```

Hoặc trực tiếp:

```bash
cd Backend
venv/bin/python3.12 app.py
```

> ⚠️ **Quan trọng:** Luôn dùng `venv/bin/python3.12`, không dùng `python3` hay `python` vì Mac có Python 3.9 mặc định không có các thư viện cần thiết.

Server khởi động tại: **http://127.0.0.1:5002**

### Frontend

Mở trình duyệt và truy cập:

```
http://127.0.0.1:5502/Frontend/index.html
```

Hoặc dùng Live Server trong VS Code (chuột phải vào `index.html` → *Open with Live Server*).

---

## 📁 Cấu trúc dự án

```
prj2/
├── Backend/
│   ├── app.py              # Flask server chính
│   ├── database.py         # Kết nối & CRUD MongoDB
│   ├── best.pt             # Model YOLO (không commit)
│   ├── .env                # Biến môi trường (không commit)
│   ├── requirements.txt    # Dependencies Python
│   ├── run.sh              # Script khởi động nhanh
│   └── venv/               # Virtual environment (không commit)
│
└── Frontend/
    ├── index.html          # Trang Kiểm Tra AI
    ├── planogram.html      # Trang Tạo Planogram
    ├── hopdong.html        # Trang Hợp Đồng Nhãn Hàng
    ├── ke.html             # Trang Quản Lý Kệ Hàng
    ├── style.css           # CSS toàn bộ ứng dụng
    └── js/
        ├── shared.js       # Hàm dùng chung (API, MongoDB helpers)
        ├── ktra.js         # Logic trang Kiểm Tra
        └── planogram.js    # Logic Planogram Builder
```

---

## 🧭 Các trang

| URL | Chức năng |
|-----|-----------|
| `/Frontend/index.html` | Kiểm tra kệ hàng bằng AI |
| `/Frontend/planogram.html` | Tạo & lưu planogram |
| `/Frontend/hopdong.html` | Quản lý hợp đồng nhãn hàng |
| `/Frontend/ke.html` | Xem danh sách kệ hàng |

---

## 🔌 API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `POST` | `/api/compliance` | Kiểm tra kệ hàng bằng AI |
| `GET` | `/api/planograms` | Lấy danh sách planogram |
| `GET` | `/api/planograms/<name>` | Lấy chi tiết 1 planogram |
| `POST` | `/api/save-planogram` | Lưu planogram lên MongoDB |
| `GET` | `/api/products` | Lấy danh mục sản phẩm |
| `POST` | `/api/products` | Lưu danh mục sản phẩm |

---

## 🗒️ Lưu ý

- File `.env` và `venv/` **không được commit** lên Git — thêm vào `.gitignore`
- Nếu MongoDB không kết nối được, hệ thống tự **fallback về file JSON**
- Model `best.pt` cần được đặt đúng vị trí trước khi chạy
# AI-Powered-Planogram-Management-System
