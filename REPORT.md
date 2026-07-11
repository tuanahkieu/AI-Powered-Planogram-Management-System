# ĐẠI HỌC BÁCH KHOA HÀ NỘI
## TRƯỜNG CÔNG NGHỆ THÔNG TIN VÀ TRUYỀN THÔNG
──────── * ───────

**BÁO CÁO HỌC PHẦN: PROJECT 1**
**(Mã học phần: IT3150)**

**Đề tài: HỆ THỐNG QUẢN LÝ PLANOGRAM TÍCH HỢP AI (POG MANAGER)**

**GVHD:** Thầy Hoàng Việt Dũng  
**Sinh viên thực hiện:** Kiều Thế Hiệp  
**MSSV:** 20235325  

---

## Mục lục
1. Mở đầu
   1.1. Giới thiệu đề tài
   1.2. Mục tiêu của đề tài
   1.3. Phạm vi đề tài
2. Công nghệ
   2.1. Kiến trúc hệ thống
   2.2. Backend
   2.3. Frontend
   2.4. Database
3. Phân tích và thiết kế hệ thống
   3.1. Đặc tả yêu cầu
   3.2. Danh sách Use Case
   3.3. Thiết kế Cơ sở dữ liệu
4. Cài đặt và triển khai
   4.1. Tổ chức mã nguồn
   4.2. Các chức năng chính
   4.3. Giao diện ứng dụng
   4.4. Kết quả triển khai
5. Kiểm thử và đánh giá
   5.1. Kịch bản kiểm thử
   5.2. Đánh giá kết quả
6. Kết luận và hướng phát triển
   6.1. Kết luận
   6.2. Hướng phát triển

---

## 1. Mở đầu
### 1.1. Giới thiệu đề tài
Quản lý trưng bày sản phẩm (Planogram) là một trong những khâu quan trọng trong ngành bán lẻ để tối ưu hóa không gian kệ hàng và tăng doanh thu. Tuy nhiên, việc kiểm tra mức độ tuân thủ trưng bày thực tế so với thiết kế chuẩn tại các cửa hàng thường mất nhiều thời gian và công sức. **Hệ thống Quản lý Planogram tích hợp AI (POG Manager)** được phát triển nhằm giải quyết vấn đề này bằng cách kết hợp công cụ thiết kế sơ đồ kệ hàng trực quan và AI nhận diện hình ảnh để đánh giá tự động.

### 1.2. Mục tiêu của đề tài
- **Xây dựng ứng dụng quản lý trưng bày:** Cho phép người dùng (quản lý nhãn hàng, nhân viên cửa hàng) thiết kế và quản lý sơ đồ trưng bày sản phẩm bằng thao tác kéo thả.
- **Tích hợp Trí tuệ Nhân tạo (AI):** Tự động phân tích hình ảnh kệ hàng thực tế bằng mô hình học sâu (YOLOv8) để so sánh và đánh giá mức độ tuân thủ so với planogram chuẩn.
- **Quản lý hợp đồng và tài nguyên:** Hỗ trợ quản lý thỏa thuận hợp đồng trưng bày, khóa các tầng kệ cho từng nhãn hàng và lưu trữ dữ liệu trực tuyến an toàn.

### 1.3. Phạm vi đề tài
- **Phạm vi chức năng:**
  - Quản lý danh sách kệ hàng theo cơ sở/cửa hàng.
  - Công cụ kéo thả (Drag & Drop) để xếp sản phẩm lên kệ (Tạo Planogram).
  - Quản lý hợp đồng trưng bày sản phẩm.
  - Phân tích và kiểm tra kệ hàng bằng hình ảnh thực tế với AI.
  - Xem lịch sử các lần phân tích AI.

---

## 2. Công nghệ
### 2.1. Kiến trúc hệ thống
Hệ thống được phát triển theo mô hình Client-Server. Frontend (giao diện người dùng) giao tiếp với Backend thông qua các RESTful API. Dữ liệu hệ thống được lưu trữ trên MongoDB Atlas, trong khi hình ảnh thực tế được đẩy lên Backend để mô hình AI (YOLOv8) xử lý.

### 2.2. Backend
- **Python (Flask):** Sử dụng Flask làm framework chính để xây dựng các API xử lý yêu cầu từ Client, do tính chất gọn nhẹ và khả năng tương thích tốt với các thư viện AI/Machine Learning của Python.
- **YOLOv8:** Mô hình học sâu (Deep Learning) chuyên dụng cho bài toán phát hiện đối tượng (Object Detection), dùng để nhận diện và định vị các sản phẩm trên kệ hàng thực tế.

### 2.3. Frontend
- **Vite & ReactJS / Vanilla JS:** Sử dụng Vite làm công cụ build để mang lại hiệu năng cao. Giao diện được thiết kế theo phong cách Glassmorphism hiện đại, áp dụng CSS tùy biến (HSL color) nhằm đem lại trải nghiệm UI cao cấp, mượt mà.

### 2.4. Database
- **MongoDB Atlas:** Hệ quản trị CSDL NoSQL đám mây được dùng để lưu trữ linh hoạt thông tin về sơ đồ kệ hàng (tọa độ các sản phẩm), hợp đồng, lịch sử đánh giá phân tích dưới định dạng BSON/JSON.

---

## 3. Phân tích và thiết kế hệ thống
### 3.1. Đặc tả yêu cầu
- **Yêu cầu chức năng:**
  - Người dùng có thể thiết kế sơ đồ kệ bằng cách kéo thả sản phẩm vào các tầng kệ.
  - Người dùng có thể tải lên ảnh chụp kệ hàng thực tế.
  - Hệ thống tự động phân tích ảnh và trả về kết quả sản phẩm nào đúng vị trí, sản phẩm nào thiếu hoặc sai vị trí.
  - Người dùng có thể quản lý hợp đồng nhãn hàng (khóa vị trí tầng kệ).
- **Yêu cầu phi chức năng:**
  - Tốc độ phản hồi của API xử lý ảnh AI dưới 5 giây/ảnh.
  - Giao diện đáp ứng (Responsive) cơ bản và thiết kế thẩm mỹ cao.

### 3.2. Biểu đồ Use Case
```mermaid
usecaseDiagram
  actor User as "Người dùng (Quản lý/Nhân viên)"
  
  package "POG Manager System" {
    usecase UC1 as "Thiết kế Planogram (Kéo thả)"
    usecase UC2 as "Kiểm tra AI (Upload ảnh)"
    usecase UC3 as "Quản lý hợp đồng nhãn hàng"
    usecase UC4 as "Quản lý danh sách kệ hàng"
    usecase UC5 as "Xem lịch sử kiểm tra"
    
    User --> UC1
    User --> UC2
    User --> UC3
    User --> UC4
    User --> UC5
  }
```

Chi tiết các Use Case:
1. **Thiết kế Planogram:** Quản lý tạo hoặc chỉnh sửa sơ đồ kệ bằng công cụ kéo thả.
2. **Kiểm tra AI:** Nhân viên upload ảnh kệ hàng, hệ thống sử dụng YOLO để phân tích và trả về kết quả số lượng sản phẩm đúng/sai/thiếu.
3. **Quản lý hợp đồng:** Thiết lập các điều khoản thuê vị trí kệ (tầng độc quyền) cho các nhãn hàng cụ thể.
4. **Quản lý kệ hàng:** Thêm mới, chỉnh sửa, xóa và phân nhóm kệ theo từng cửa hàng (cơ sở).
5. **Xem lịch sử:** Xem lại các kết quả kiểm tra AI trước đây cùng tỷ lệ tuân thủ, số lỗi.

### 3.3. Thiết kế Cơ sở dữ liệu
Hệ thống sử dụng MongoDB (CSDL NoSQL) để lưu trữ tài liệu (Documents) linh hoạt.

Các Collections chính:
- **`stores`**: Lưu thông tin cơ bản về cửa hàng/cơ sở.
- **`planograms`**: Cấu trúc lõi của hệ thống. Lưu ma trận sản phẩm 2 chiều (`shelves`), biểu diễn thứ tự sản phẩm từ trái qua phải trên từng tầng kệ.
- **`contracts`**: Lưu trữ các ràng buộc vị trí (hợp đồng).
- **`histories`**: Lưu lại dấu vết kiểm tra. Kết nối trực tiếp đến ảnh đã xử lý và phân tích JSON về độ tuân thủ.

---

## 4. Cài đặt và triển khai
### 4.1. Tổ chức mã nguồn
Project được tổ chức tách biệt hai phần chính:
- **`Backend/`**: Chứa logic API (Flask), cấu hình kết nối DB (`database.py`) và file mô hình AI (`best.pt`).
- **`Frontend/`**: Chứa source code giao diện được đóng gói bởi Vite. Bao gồm các file tĩnh, file cấu hình, cùng thư mục `src/` chứa CSS (`global.css`) và các scripts/components quản lý logic trang.

### 4.2. Các chức năng chính
- **Xử lý ảnh bằng AI:** Hệ thống nhận ảnh từ Frontend, sử dụng `best.pt` (YOLOv8) để inference, bóc tách các bounding box của sản phẩm trên kệ, sau đó thuật toán so khớp với tọa độ lưu trong `Planograms` để đánh giá.
- **Giao diện kéo thả trực quan:** Sử dụng các sự kiện DOM drag-and-drop hoặc thư viện tương ứng bên React để cho phép gán sản phẩm vào các khu vực cụ thể trên kệ.

### 4.3. Giao diện ứng dụng
*(Chèn ảnh giao diện thực tế vào các mục tương ứng)*

### 4.4. Kết quả triển khai
- Hệ thống chạy ổn định ở môi trường cục bộ (Local). Backend tại port 5002 và Frontend tại port 5173.
- Kết nối thành công tới MongoDB Atlas để đọc ghi dữ liệu theo thời gian thực.
- Quá trình inference của AI diễn ra suôn sẻ, cho độ chính xác có thể chấp nhận ở điều kiện ánh sáng chuẩn.

---

## 5. Kiểm thử và đánh giá
### 5.1. Kịch bản kiểm thử
| STT | Chức năng | Đầu vào (Input) | Kết quả mong đợi | Kết quả thực tế |
|-----|-----------|-----------------|------------------|-----------------|
| 1 | Tạo Planogram | Kéo sản phẩm A vào Tầng 1 | Tầng 1 lưu thông tin sản phẩm A | Thành công |
| 2 | Phân tích ảnh AI | Upload ảnh kệ hàng hợp lệ | Hệ thống trả về box định vị sản phẩm và tỉ lệ đúng/sai | Thành công |
| 3 | Quản lý hợp đồng | Tạo hợp đồng nhãn hàng B, khóa tầng 2 | Tầng 2 bị khóa, không thể xếp sản phẩm nhãn khác | Thành công |
| 4 | Lưu lịch sử | Thực hiện xong phân tích ảnh | Kết quả tự động ghi vào lịch sử | Thành công |

### 5.2. Đánh giá kết quả
- **Ưu điểm:**
  - Giao diện đẹp, hiện đại, bắt mắt với phong cách Glassmorphism.
  - Tính năng AI được tích hợp trơn tru, đem lại giá trị thực tiễn trong việc giảm thiểu sức lao động thủ công của nhân viên.
  - Cấu trúc thư mục linh hoạt, sẵn sàng để nâng cấp quy mô trong tương lai.
- **Hạn chế:**
  - Độ chính xác của AI còn phụ thuộc vào góc chụp, ánh sáng và mức độ hiển thị của sản phẩm thực tế.
  - Hiện tại chỉ là phiên bản sơ khởi, cần thêm các chức năng phân quyền bảo mật nâng cao cho Admin và User thường.

---

## 6. Kết luận và hướng phát triển
### 6.1. Kết luận
Dự án đã hoàn thiện bản MVP (Minimum Viable Product) của một hệ thống quản lý trưng bày có ứng dụng Trí tuệ Nhân tạo. POG Manager thể hiện tiềm năng to lớn trong việc số hóa quy trình quản lý bán lẻ, giúp các nhãn hàng và siêu thị giám sát độ tuân thủ dễ dàng và minh bạch hơn.

### 6.2. Hướng phát triển
- **Cải thiện mô hình AI:** Thu thập thêm dữ liệu (dataset) để fine-tune YOLOv8 nhằm tăng độ chính xác trong các môi trường ánh sáng phức tạp, kệ hàng bị che khuất.
- **Báo cáo và thống kê (Analytics):** Phát triển Dashboard biểu đồ trực quan (Charts) theo dõi tỷ lệ tuân thủ trưng bày theo từng tháng, từng cửa hàng.
- **Phiên bản Mobile:** Xây dựng ứng dụng di động để nhân viên cửa hàng cầm điện thoại chụp ảnh và nhận kết quả phân tích AI ngay lập tức.
- **Tối ưu hiệu năng:** Chuyển xử lý ảnh thành các task chạy nền (background task) để tránh nghẽn khi có nhiều yêu cầu xử lý cùng lúc.
