# Báo cáo hoàn thành: Bé Dạy AI Học & Hệ Thống Chấm Bài

Chúng tôi đã triển khai thành công tính năng "Bé Dạy AI Học" (Teach AI Sandbox) giúp các bé học sinh tiểu học tự tay ghi nhận dữ liệu hình ảnh/video qua camera, dạy bạn AI phân biệt ngón tay và gửi nộp kết quả bài làm cho thầy cô.

## Các Thay Đổi Đã Thực Hiện

### 1. Hệ thống Backend (NestJS)
- **Submission Entity ([submission.entity.ts](file:///d:/HOCTAP/Learn-Hub/server/src/modules/submissions/entities/submission.entity.ts)):** Thiết lập thực thể lưu trữ bài nộp bao gồm độ chính xác mô hình (`accuracy`), tập dữ liệu tọa độ khớp xương tay (`dataset`), câu trả lời phản tư và lời nhắn (`reflectionAnswer`).
- **SubmissionsModule ([submissions.module.ts](file:///d:/HOCTAP/Learn-Hub/server/src/modules/submissions/submissions.module.ts)):** Định nghĩa API và controller hỗ trợ nộp bài (`POST /submissions`) và lấy danh sách bài nộp (`GET /submissions`) để giáo viên chấm điểm. Tự động liên kết khóa ngoại với tài khoản học sinh.
- **Bảo Vệ Quyền Hạn Theo Vai Trò (Roles Decorator & Guard - [roles.decorator.ts](file:///d:/HOCTAP/Learn-Hub/server/src/modules/auth/roles.decorator.ts), [roles.guard.ts](file:///d:/HOCTAP/Learn-Hub/server/src/modules/auth/roles.guard.ts)):**
  - Tạo decorator `@Roles()` và bộ lọc `@UseGuards(RolesGuard)` để hạn chế quyền truy cập của các route nhạy cảm.
  - Áp dụng trực tiếp vào `GET /submissions` để đảm bảo chỉ những tài khoản có vai trò `'teacher'` mới được truy cập dữ liệu bài nộp.
- **Hạt Giống Khởi Tạo (Database Seeds - [seed-teacher.ts](file:///d:/HOCTAP/Learn-Hub/server/src/shared/database/seeds/seed-teacher.ts), [seed-student.ts](file:///d:/HOCTAP/Learn-Hub/server/src/shared/database/seeds/seed-student.ts)):**
  - Tách biệt logic khởi tạo dữ liệu mẫu thành các tệp tin hạt giống riêng biệt.
  - Tự động kiểm tra và khởi tạo tài khoản giáo viên (`teacher@learnhub.com` / `123456`) và học sinh (`student@learnhub.com` / `123456`) khi hệ thống khởi động.

### 2. Hệ thống Học máy trên Trình duyệt (Client-side ML)
- **Chuẩn hóa Tọa độ tay ([knn-classifier.ts](file:///d:/HOCTAP/Learn-Hub/client/src/lib/knn-classifier.ts)):** Viết thuật toán biến đổi 21 điểm mốc tọa độ tay từ camera thành vector đặc trưng (42 phần tử) có tính chất bất biến đối với kích thước tay (gần/xa camera) và vị trí của tay trên màn hình. Tích hợp bộ phân loại K-Nearest Neighbors (KNN).
- **Bộ Kiểm Thử Chuẩn ([golden-dataset.ts](file:///d:/HOCTAP/Learn-Hub/client/src/lib/golden-dataset.ts)):** Tạo tập dữ liệu chuẩn gồm 10 mẫu đặc trưng của 3 nhãn khác nhau làm công cụ chấm chéo tự động ngay khi bé nộp bài để tính điểm chất lượng mô hình của bé.

### 3. Giao diện Người dùng (Next.js)
- **Màn hình Học sinh ([teach/page.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(private)/challenge/teach/page.tsx)):** 
  - Khởi tạo camera trực tiếp, vẽ khung xương bàn tay bằng canvas theo thời gian thực.
  - Cho bé chụp mẫu tay cho từng nhãn (1 ngón tay, 2 ngón tay).
  - Trình diễn hiệu ứng "Huấn luyện AI" ngộ nghĩnh.
  - Chế độ nhận dạng trực tiếp (Live Predict): Tự động phát âm thanh tiếng Việt bằng TTS (*"AI đoán đây là 2 ngón tay!"*) và tạo mưa Emoji trên màn hình khi AI đoán trúng.
  - Tự động nhận dạng song song 2 bàn tay và đếm tổng số ngón tay trên cả 2 bàn tay (*"Tay trái có 1 ngón, Tay phải có 2 ngón. Tổng là 3 ngón!"*).
- **Trang Giáo viên ([teacher/page.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(private)/teacher/page.tsx)):**
  - Hiển thị danh sách toàn bộ học sinh đã nộp bài, điểm kiểm thử (Test Accuracy) và các câu trả lời tự luận.
  - **Tái tạo Khung xương tay trực quan (Mini skeleton render):** Dựng lại hình ảnh 3D/2D các tư thế xương tay học sinh đã chụp từ bộ dữ liệu lưu trên server để giáo viên dễ dàng xem học sinh có giơ nhầm tay hay không.
- **Bộ Bảo Vệ Định Tuyến ((private) Route Group & Layout - [layout.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(private)/layout.tsx)):**
  - Di chuyển các trang yêu cầu xác thực (`challenge`, `profile`, `teacher`) vào nhóm định tuyến `(private)`.
  - Thiết lập layout bảo vệ tự động kiểm tra token trong `localStorage` và chuyển hướng (redirect) người dùng về trang đăng nhập `/login` nếu chưa được cấp quyền.
- **Tích hợp Navbar & Trang chủ ([page.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(public)/page.tsx), [Navbar.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/components/Navbar.tsx)):** Bổ sung Card thứ 5 to đẹp trên trang chủ và liên kết dẫn vào Trang Giáo Viên trên thanh điều hướng.

---

## Kết Quả Kiểm Thử (Verification Results)

Cả frontend và backend đều vượt qua bài kiểm thử biên dịch production thành công:
1. **NestJS Server Build:** Biên dịch thành công tệp JavaScript phân phối.
2. **Next.js Client Build:** Biên dịch thành công các định tuyến tĩnh, bao gồm cả `/challenge/teach` và `/teacher`.
3. **Database Sync:** TypeORM tự động ánh xạ cấu trúc bảng `submissions` vào cơ sở dữ liệu PostgreSQL khi khởi động nhờ tùy chọn `synchronize: true` trong môi trường phát triển.
