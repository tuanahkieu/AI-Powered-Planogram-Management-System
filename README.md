# POG Manager — Hệ thống Quản lý Planogram AI

Ứng dụng quản lý sơ đồ trưng bày sản phẩm (planogram) tích hợp AI để kiểm tra mức độ tuân thủ trưng bày tại cửa hàng. Dữ liệu được lưu trữ trực tuyến trên MongoDB Atlas và giao diện người dùng được xây dựng bằng React (Vite) kết hợp với **Shadcn UI** và **Tailwind CSS**, mang lại thiết kế hiện đại, mượt mà và cực kỳ trực quan.

---

## 📋 Yêu cầu hệ thống

- **Python 3.12**: Dùng cho Backend (Flask & YOLO).
- **Node.js**: Phiên bản mới nhất, dùng cho Frontend (Vite).
- **MongoDB Atlas** hoặc MongoDB local.
- File model `best.pt` (YOLO) đặt trong thư mục `Backend/`.

---

## ⚙️ Cài đặt & Khởi động lần đầu

### 1. Backend (Python + Flask)

**Bước 1: Tạo virtual environment và cài đặt thư viện**
```bash
cd Backend
python3.12 -m venv venv
venv/bin/python3.12 -m pip install -r requirements.txt
```

**Bước 2: Cấu hình MongoDB**
Tạo file `Backend/.env`:
```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/planogram_db?retryWrites=true&w=majority
MONGO_DB_NAME=planogram_db
```

**Bước 3: Chạy Backend**
```bash
bash run.sh
# Hoặc chạy trực tiếp: venv/bin/python3.12 app.py
```
> Server sẽ khởi động tại: **http://127.0.0.1:5002**

### 2. Frontend (React + Vite + Shadcn UI + Tailwind CSS)

**Bước 1: Cài đặt thư viện Node.js**
```bash
cd Frontend
npm install
```

**Bước 2: Khởi động máy chủ giao diện (Dev Server)**
```bash
npm run dev
```
> Trình duyệt sẽ hiển thị Frontend tại: **http://localhost:5173**

---

## 📁 Cấu trúc dự án mới

```
prj2/
├── Backend/
│   ├── app.py              # Logic API & Xử lý ảnh AI (Flask)
│   ├── database.py         # Kết nối MongoDB
│   ├── best.pt             # Model YOLO v8 (không commit)
│   ├── .env                # Biến môi trường (không commit)
│   └── venv/               # Môi trường ảo Python
│
└── Frontend/               # Dự án Vite + React
    ├── package.json        # Cấu hình npm & vite
    ├── vite.config.js      # Cấu hình Vite & Tailwind
    ├── tailwind.config.js  # Cấu hình Tailwind CSS
    ├── index.html          # Điểm neo giao diện (Entry point)
    └── src/
        ├── main.jsx        # Khởi tạo React App
        ├── App.jsx         # Component gốc & Cấu hình Router
        ├── style.css       # File CSS chính định nghĩa Shadcn variables & Tailwind
        ├── components/     # Chứa các component UI (Shadcn Card, Button, Input...)
        └── pages/          # React Components (Giao diện)
            ├── CheckPage.jsx     # Chức năng phân tích ảnh AI
            ├── PlanogramPage.jsx # Chức năng Kéo-thả xếp kệ
            ├── ContractsPage.jsx # Chức năng quản lý hợp đồng
            ├── ShelvesPage.jsx   # Chức năng quản lý kệ hàng
            └── HistoryPage.jsx   # Lịch sử các lần kiểm tra AI
```

---

## 🧭 Các trang chức năng chính

| Route / Đường dẫn | Chức năng |
|-----|-----------|
| `/` | Kiểm tra kệ hàng thực tế so với chuẩn (sử dụng AI YOLO). |
| `/planogram` | Xếp sản phẩm lên kệ bằng công cụ Kéo thả (Drag & Drop) thông minh. |
| `/contracts` | Quản lý thỏa thuận hợp đồng, khóa các tầng kệ cho nhãn hàng độc quyền. |
| `/shelves` | Quản lý danh sách các kệ hiện có, được chia nhóm theo từng Cơ Sở/Cửa hàng. |
| `/history` | Lịch sử các lần đã phân tích AI trước đó cùng tỷ lệ tuân thủ chi tiết. |

---

## 🗒️ Lưu ý quan trọng

- Các thư mục/file như `.env`, `venv/`, và `node_modules/` **không được commit** lên Git.
- Frontend luôn cần gọi API qua `http://127.0.0.1:5002` (được cấu hình chung tại `src/pages/shared.js`). Nếu bạn đổi port Backend, hãy nhớ sửa link này.

