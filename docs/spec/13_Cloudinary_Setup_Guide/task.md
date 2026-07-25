# Task Checklist - Quản Lý Bộ Dữ Liệu và Mô Hình AI

## Backend (Server) ✅
- [x] Tạo module `datasets` (Entity, Service, Controller, DTO)
- [x] Tạo module `models` (Entity, Service, Controller, DTO)
- [x] Tạo thư mục uploads và cấu hình file serving
- [x] Đăng ký modules mới vào `app.module.ts`
- [x] Thêm OneToMany relation Dataset → Model để load điểm số
- [x] Transform query results để trả về `model` field cho frontend
- [x] Fix TypeORM relation syntax (object format thay vì string array)

## Frontend (Client) ✅
- [x] Thêm API methods mới vào `lib/api.ts` (createDataset, getMyDatasets, etc.)
- [x] Thêm nút "Clear All Dataset" + "Xem lại bộ dữ liệu" vào teach-face
- [x] Thêm nút "Clear All Dataset" + "Xem lại bộ dữ liệu" vào teach (fingers)
- [x] Thêm nút "Clear All Dataset" + "Xem lại bộ dữ liệu" vào teach-gestures
- [x] Cập nhật hàm nộp bài: gọi `createDataset` API mới
- [x] Tạo màn hình lịch sử học sinh (`student/history/[challengeType]`)
- [x] Tạo/Cập nhật Teacher Dashboard (thêm navigation cards theo bài tập)
- [x] Tạo màn hình xem chi tiết timeline nộp bài của học sinh (cho giáo viên) - `/teacher/datasets/[challengeType]`

## Verification ✅
- [x] Build server thành công (0 errors)
- [x] Build client thành công (0 errors, 19 routes)

## Bugfixes (Pre-existing) ✅
- [x] Fix sandbox page empty (gây lỗi build)
- [x] Fix `twoHandUnlocked` undefined trong teach page
- [x] Loại bỏ `speakVietnamese` khỏi project

## Testing ✅
- [x] Kiểm tra DB migration tạo bảng mới thành công
- [x] Kiểm tra luồng upload Cloudinary hoạt động (Đã config Cloudinary ở file `.env.local` bằng thông tin Cloud Name và Upload Preset)
- [x] Kiểm tra giao diện học sinh và giáo viên hiển thị đúng (Chạy client ở port 3000)
