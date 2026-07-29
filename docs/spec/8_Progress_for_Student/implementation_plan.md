# Xây dựng Hệ thống Cơ sở dữ liệu và Quản lý Tiến trình (Progress Management)

Kế hoạch này phác thảo quá trình thiết kế, phát triển và tích hợp hệ thống lưu trữ dữ liệu cho dự án Learn-Hub. Mục tiêu là xây dựng backend bằng NestJS + PostgreSQL để lưu trữ thông tin học sinh, điểm số các thử thách AI và kết quả huấn luyện mô hình, đồng thời cung cấp API để NextJS Frontend cập nhật kết quả tự động.

## User Review Required

> [!IMPORTANT]
> - Cần đảm bảo hệ thống của bạn (môi trường local) đã cài đặt **Docker** để có thể chạy PostgreSQL một cách ổn định thông qua `docker-compose.yml`.
> - Trường `dataset` trong bảng `Submissions` sẽ lưu trữ trực tiếp cấu trúc JSON (tọa độ các điểm neo ngón tay). Cần cân nhắc về dung lượng nếu học sinh chụp số lượng mẫu quá lớn.

## Open Questions

> [!NOTE]
> - Bạn có muốn tích hợp hệ thống **Đăng nhập (Authentication - JWT)** bảo mật ngay trong giai đoạn này không, hay tạm thời dùng cơ chế "Mô phỏng User" (Mock User ID) để tập trung phát triển và test chức năng học tập trước?
> - Bạn có dự định tạo thêm một trang **Dashboard dành riêng cho Giáo viên** để xem toàn bộ lịch sử điểm (Progress) và bài tập nộp (Submissions) của học sinh không?

## Proposed Changes

Kế hoạch sẽ được thực hiện đồng bộ trên 3 lớp:

### 1. Database Layer (NestJS TypeORM Entities)
Thiết kế các Entity đại diện cho các bảng trong CSDL.

#### [NEW] `server/src/modules/users/entities/user.entity.ts`
- Định nghĩa thông tin học sinh (`id`, `username`, `email`, `avatar`, `role`).
#### [NEW] `server/src/modules/progress/entities/progress.entity.ts`
- Định nghĩa lịch sử tiến trình học tập (`userId`, `challengeType`, `score`). Bảng này có quan hệ (Many-to-One) với bảng `Users`.
#### [NEW] `server/src/modules/submissions/entities/submission.entity.ts`
- Quản lý lịch sử nộp bài mô hình AI (`userId`, `challengeType`, `accuracy`, `dataset` dạng JSON, `reflectionAnswer`).

### 2. Backend API (NestJS Services & Controllers)
Cung cấp các cổng giao tiếp RESTful cho Frontend.

#### [NEW] `server/src/modules/progress/progress.service.ts`
- Xử lý logic lưu điểm (`saveProgress`) và lấy tổng điểm của học sinh.
#### [NEW] `server/src/modules/submissions/submissions.service.ts`
- Xử lý logic lưu trữ dữ liệu bài tập và bộ dataset mà AI đã học từ học sinh.
- Cấu hình API Endpoints (vd: `POST /api/progress`, `POST /api/submissions`).

### 3. Frontend Integration (NextJS)
Kết nối các màn hình trò chơi với API của Server.

#### [MODIFY] `client/src/lib/api.ts`
- Bổ sung các Axios helpers: `submitAssignment(score, samples, reflection)` và `saveProgress(challengeType, score)`.
#### [MODIFY] `client/src/app/(private)/challenge/teach/page.tsx`
- Tích hợp logic: Khi học sinh nhấn "XÁC NHẬN NỘP", ứng dụng sẽ hiển thị loading, gọi API `submitAssignment`, và sau đó hiển thị popup chúc mừng (hiện tại file này đã có sẵn các logic giao diện cơ bản, cần lắp ghép API thực tế).

## Verification Plan

### Automated Tests
- Chạy lệnh `npm run migration:run` trong thư mục `server` để đảm bảo các bảng được khởi tạo chính xác trong PostgreSQL.
- Chạy unit test backend (`npm run test`) để kiểm tra tính toàn vẹn của logic tính toán và xử lý lỗi (ví dụ: gửi payload sai format).

### Manual Verification
- Khởi động stack bằng lệnh `docker-compose up -d --build`.
- Truy cập vào trang web với tư cách Học sinh, thực hiện quá trình Dạy AI và Nộp Bài.
- Mở database viewer (như DBeaver hoặc pgAdmin), kiểm tra trực tiếp bảng `progress` và `submissions` xem dữ liệu đã được lưu thành công kèm theo Timestamp chưa.
