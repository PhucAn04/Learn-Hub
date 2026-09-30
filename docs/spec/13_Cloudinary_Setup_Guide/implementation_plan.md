# Kế Hoạch Triển Khai Quản Lý Bộ Dữ Liệu và Mô Hình AI

Mục tiêu của kế hoạch là bổ sung các tính năng giúp quản lý, đánh giá và theo dõi quá trình học sinh (bé) thu thập dữ liệu và huấn luyện mô hình AI, đồng thời cung cấp công cụ cho giáo viên theo dõi, chấm điểm, và quan sát sự tiến bộ của học sinh qua từng lần nộp.

## Cập Nhật Lưu Trữ Đám Mây (Cloudinary)
Để đảm bảo ảnh bé chụp không bị vỡ, sắc nét và dễ dàng truy xuất/tải xuống ở chất lượng cao, hệ thống sẽ sử dụng **Hybrid Storage (Lưu trữ kết hợp) với Cloudinary**:
1. **Lưu Ảnh lên Cloudinary**: Thay vì nén thành Base64, các bức ảnh bé chụp sẽ được upload trực tiếp lên Cloudinary dưới định dạng `.jpg`. Cloudinary sẽ trả về các đường dẫn ảnh (URL) chất lượng cao.
2. **Lưu File Dataset Local**: Tọa độ mốc khuôn mặt (Features) và URL ảnh Cloudinary tương ứng của từng mẫu sẽ được đóng gói thành 1 file `.json` (Ví dụ: `dataset-123.json`) và lưu trên ổ cứng của server (`server/uploads/datasets/`).
3. **Database Đóng Vai Trò Mục Lục**: Database chỉ lưu mã học sinh, điểm số, nhận xét và đường dẫn tới file `.json` nói trên.

**Lợi ích:** Hình ảnh luôn đạt chất lượng tốt nhất, không làm nặng Database, và tiết kiệm dung lượng ổ cứng cục bộ của server do ảnh đã được đẩy lên Cloud mượt mà.

---

## Phân Tích "Bộ Dữ Liệu Bé Thu Thập Là Gì?"

Bộ dữ liệu mà bé thu thập trong các bài tập (Face/Fingers/Gestures) thực chất là một danh sách các mẫu (Samples). Mỗi mẫu bao gồm:
1. **Nhãn (Label)**: Lớp mà bé đang dạy (VD: "Vui vẻ 😀").
2. **Đặc trưng (Features)**: Mảng các tọa độ đã được chuẩn hóa.
3. **Ảnh mẫu (Thumbnail URL)**: **Đường dẫn (URL) tới file ảnh `.jpg` gốc được lưu trữ trên Cloudinary.**

Tất cả các thông tin này của một lần nộp sẽ được gộp thành file JSON lưu trên server.

---

## Proposed Changes

### 1. Database & API (Backend)

Sẽ tạo 2 bảng độc lập `Dataset` và `Model` để quản lý tách biệt:

#### [NEW] `server/src/modules/datasets/entities/dataset.entity.ts`
- **Các trường dữ liệu**: `id`, `userId`, `challengeType`, `dataFileUrl` (Đường dẫn tới file lưu trữ thực tế trên server), `createdAt`.

#### [NEW] `server/src/modules/models/entities/model.entity.ts`
- **Các trường dữ liệu**: `id`, `userId`, `datasetId` (Liên kết với bảng Dataset), `testScore` (Điểm số đánh giá tự động trên Golden Dataset), `teacherFeedback` (Nhận xét của giáo viên), `createdAt`.

#### [MODIFY] API Controllers & Services
- Tích hợp Cloudinary SDK để tiếp nhận mảng hình ảnh từ Frontend gửi lên, xử lý upload hàng loạt (batch upload) lấy URL.
- Viết hàm lưu file JSON (`server/uploads/`) chứa các URL Cloudinary vừa lấy được và tọa độ Features.

---

### 2. Giao diện Học Sinh (Student Flow)

#### [MODIFY] Màn hình Thử thách (VD: `client/src/app/(private)/challenge/teach-face/page.tsx`)
- **Nút "Clear (Xóa) Bộ Dữ Liệu"**: Bổ sung nút này cạnh phần thu thập ảnh. Khi bấm, bé có thể xóa sạch bộ dữ liệu hiện tại để làm lại từ đầu.
- **Tính toán Test Score**: Khi bé bấm "DẠY BẠN AI HỌC", hệ thống tính điểm dựa trên **Bộ dữ liệu mẫu (Golden Dataset)**.
- Khi bấm "Nộp Bài", hệ thống hiển thị thanh tiến trình Upload ảnh lên Cloudinary và lưu dữ liệu.

#### [NEW] Màn hình Xem lại quá trình (Student History Dashboard)
- **Đường dẫn**: `client/src/app/(private)/student/history/[challengeType]/page.tsx`
- **Tính năng**: Xem lại toàn bộ các bộ dữ liệu mình đã nộp, xem sự cải thiện điểm `Test Score` và đọc nhận xét từ giáo viên. Hình ảnh hiển thị sẽ load thẳng từ Cloudinary.

---

### 3. Giao diện Giáo Viên (Teacher Flow)

#### [NEW] Danh sách Bài tập & Học sinh
- **Đường dẫn**: `client/src/app/(private)/teacher/dashboard/page.tsx`
- Hiển thị danh sách các học sinh đã làm bài.

#### [NEW] Quá trình Cải thiện của một Học sinh
- **Đường dẫn**: `client/src/app/(private)/teacher/student/[userId]/challenge/[challengeType]/page.tsx`
- **Tính năng**:
  - Xem toàn bộ **dòng thời gian (timeline)** các bộ dữ liệu mà học sinh nộp.
  - Mỗi lần nộp sẽ hiển thị: 
    - **Thư viện ảnh trực quan (Gallery)**: Web tải file JSON từ Server về, đọc các URL và hiển thị ảnh `.jpg` rõ nét từ Cloudinary. Giáo viên có thể bấm để xem ảnh phóng to.
    - Điểm `Test Score` tự động.
  - Có khung để giáo viên nhập nhận xét (Feedback).

## Verification Plan

### Verification Steps
1. Khởi tạo dịch vụ Cloudinary và thêm API keys vào `.env`.
2. Chạy thử nghiệm quy trình học sinh: thu thập dữ liệu, nhấn nộp bài. Đảm bảo thanh tiến trình upload hoạt động và các ảnh `.jpg` xuất hiện trên bảng điều khiển của Cloudinary.
3. Đăng nhập tài khoản Giáo viên, vào xem các lần nộp. Đảm bảo UI tải file JSON thành công và hiển thị sắc nét các hình ảnh trực tiếp từ Cloudinary.
