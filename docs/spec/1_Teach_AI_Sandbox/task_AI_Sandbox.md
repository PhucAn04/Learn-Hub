# Danh sách công việc: Bé Dạy AI Học & Hệ Thống Chấm Bài

## Backend (NestJS)
- [x] Thiết lập entity `Submission` trong database (`server/src/modules/submissions/entities/submission.entity.ts`)
- [x] Tạo module `SubmissionsModule` chứa Service, Controller và DTO (`server/src/modules/submissions`)
  - [x] POST `/submissions` cho học sinh nộp bài
  - [x] GET `/submissions` cho giáo viên xem toàn bộ bài làm
- [x] Đăng ký `SubmissionsModule` trong `app.module.ts`
- [x] Chạy migration hoặc để TypeORM tự động đồng bộ thực thể database, khởi động test API qua Swagger.

## Frontend (Next.js)
- [x] Tạo bộ dữ liệu kiểm tra chuẩn (Golden Test Dataset) tại `client/src/lib/golden-dataset.ts`
- [x] Thiết lập hàm hỗ trợ KNN Classifier bằng JavaScript tại `client/src/lib/knn-classifier.ts`
- [x] Tạo trang `/challenge/teach` dành cho Học sinh:
  - [x] Setup luồng chọn 3 lớp nhận diện (1 ngón, 2 ngón, 2 tay)
  - [x] Thu thập và lưu tọa độ camera landmark từ model Handpose
  - [x] Hiển thị hình thu nhỏ khung xương xương tay (mini skeletons) cho các ảnh đã chụp
  - [x] Hiển thị animation huấn luyện mô hình khi bé bấm "Dạy AI Học"
  - [x] Giao diện dự đoán thực tế trực quan (Confetti, Emoji rơi, TTS đọc tiếng Việt)
  - [x] Modal nộp bài kiểm tra trắc nghiệm / tự luận phản tư và chấm chéo tự động gửi dữ liệu lên Server
- [x] Tạo trang `/teacher` dành cho Giáo viên:
  - [x] Hiển thị danh sách học sinh đã nộp bài kèm điểm số
  - [x] Vẽ lại toàn bộ khung xương tay mẫu của học sinh đã chụp từ dữ liệu JSON gửi lên
  - [x] Hiển thị chi tiết câu trả lời tự luận
- [x] Cập nhật giao diện:
  - [x] Thêm liên kết điều hướng trên trang chủ `/` (Card thứ 5)
  - [x] Cập nhật thanh Navbar để giáo viên và học sinh dễ dàng chuyển đổi qua lại
- [x] Kiểm tra build client và vận hành thực tế.
