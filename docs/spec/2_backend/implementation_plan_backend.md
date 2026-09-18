# Hướng B: Backend — User System & Progress Tracking

Bổ sung hệ thống tài khoản người dùng, đăng nhập/đăng ký, lưu kết quả thử thách và hiển thị bảng xếp hạng.

## User Review Required

> [!IMPORTANT]
> Cần cài đặt thêm các thư viện sau trên server:
> - `bcryptjs` & `@types/bcryptjs` (mã hóa mật khẩu)
> - `@nestjs/jwt` (tạo và kiểm thực JSON Web Token)
>
> Chúng tôi sử dụng `bcryptjs` thay vì `bcrypt` gốc để tránh các vấn đề xung quanh việc biên dịch native code của C++ trên môi trường Windows.

> [!NOTE]
> Để tăng tính tương tác và sinh động cho bé:
> 1. **Avatar Picker**: Khi đăng ký, bé sẽ được chọn các hình đại diện ngộ nghĩnh (các con vật, siêu anh hùng dưới dạng emoji hoặc hình tròn hoạt hình).
> 2. **Huy hiệu (Medals)**: Trong trang cá nhân `/profile`, bé sẽ nhận được các danh hiệu như "Đồng", "Bạc", "Vàng" dựa trên số điểm tối đa đã đạt được ở từng thử thách.
> 3. **Bảng xếp hạng trực tiếp**: Trên trang chủ hoặc bên cạnh mỗi thử thách, bé sẽ nhìn thấy danh sách Top 5 bạn nhỏ có điểm cao nhất để thi đua.

## Proposed Changes

---

### [Component 1] Server (NestJS)

Thiết lập các Entity cơ sở dữ liệu và API endpoints.

#### [NEW] [user.entity.ts](file:///d:/HOCTAP/Learn-Hub/server/src/modules/users/entities/user.entity.ts)
- Định nghĩa bảng `users` bao gồm: `id` (uuid), `username` (tên hiển thị), `email` (duy nhất), `password` (đã băm), `avatar` (tên emoji/url avatar), `createdAt`, `updatedAt`.

#### [NEW] [users.module.ts](file:///d:/HOCTAP/Learn-Hub/server/src/modules/users/users.module.ts)
- `UsersService`: Truy vấn cơ sở dữ liệu để tìm người dùng theo Email, ID, hoặc tạo mới.

#### [NEW] [progress.entity.ts](file:///d:/HOCTAP/Learn-Hub/server/src/modules/progress/entities/progress.entity.ts)
- Định nghĩa bảng `progress` bao gồm: `id`, `userId`, `challengeType` ('fingers' | 'gestures' | 'face'), `score` (số điểm hoặc số ảnh chụp được), `completedAt`.
- Liên kết ManyToOne với bảng `User`.

#### [NEW] [auth.module.ts](file:///d:/HOCTAP/Learn-Hub/server/src/modules/auth/auth.module.ts)
- `AuthService`:
  - `register()`: Đăng ký tài khoản mới, băm mật khẩu, tự động trả về JWT token.
  - `login()`: Kiểm tra thông tin đăng nhập, ký JWT token.
- `AuthController`:
  - `POST /auth/register` (body: username, email, password, avatar)
  - `POST /auth/login` (body: email, password)
  - `GET /auth/profile` (lấy thông tin user hiện tại qua token)
- `JwtAuthGuard`: Guard tùy chỉnh để phân tích Bearer Token trong headers và gán User vào request context.

#### [NEW] [progress.module.ts](file:///d:/HOCTAP/Learn-Hub/server/src/modules/progress/progress.module.ts)
- `ProgressService`:
  - `saveProgress(userId, challengeType, score)`: Lưu điểm số mới đạt được. Nếu đã có điểm của thử thách này, chỉ cập nhật nếu điểm mới cao hơn (HighScore) hoặc lưu lịch sử điểm.
  - `getLeaderboard(challengeType)`: Lấy Top 10 người chơi có điểm cao nhất kèm thông tin tên và avatar.
  - `getUserStats(userId)`: Thống kê điểm cao nhất của từng mục cho người dùng.
- `ProgressController`:
  - `POST /progress` (Lưu điểm - Cần Đăng Nhập)
  - `GET /progress/leaderboard/:challengeType` (Bảng xếp hạng - Công Khai)
  - `GET /progress/stats` (Xem điểm cá nhân - Cần Đăng Nhập)

---

### [Component 2] Client (Next.js)

Tích hợp giao diện người dùng và gọi API.

#### [NEW] [api.ts](file:///d:/HOCTAP/Learn-Hub/client/src/lib/api.ts)
- Viết Axios/Fetch client wrapper để tự động đính kèm JWT Token từ `localStorage` vào header `Authorization: Bearer <token>`.
- Định nghĩa các hàm `api.login()`, `api.register()`, `api.getProfile()`, `api.saveScore()`, `api.getLeaderboard()`.

#### [MODIFY] [layout.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(public)/layout.tsx)
- Thêm một thanh **Navbar** ở trên cùng trang chủ và các trang challenge:
  - Hiển thị Logo, Lớp học.
  - Bên phải hiển thị nút **Đăng Nhập / Đăng Ký** (nếu chưa đăng nhập).
  - Hiển thị **Avatar hoạt hình + Username** và nút **Đăng Xuất** (nếu đã đăng nhập).

#### [NEW] [login/page.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(public)/login/page.tsx)
- Trang đăng nhập với thiết kế thân thiện cho bé (nền màu kẹo ngọt, các nút bấm tròn trịa, hiệu ứng nổi bật).

#### [NEW] [register/page.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(public)/register/page.tsx)
- Trang đăng ký tài khoản có chức năng chọn **Avatar Con Vật Ngộ Nghĩnh** (ví dụ: 🦁 Sư tử, 🐼 Gấu trúc, 🦊 Cáo nhỏ, 🐰 Thỏ ngọc, 🐨 Koala).

#### [NEW] [profile/page.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(public)/profile/page.tsx)
- Trang cá nhân hiển thị tiến trình học tập của bé:
  - Hiển thị danh hiệu bé đạt được (Ví dụ: Đạt 50 điểm Đếm ngón tay -> Nhận Huy hiệu Bạc 🥈).
  - Biểu đồ hoặc danh sách điểm cao nhất của bé.

#### [MODIFY] [Challenge Pages](file:///d:/HOCTAP/Learn-Hub/client/src/app/(public)/challenge)
- Tích hợp gọi API để lưu điểm tự động khi bé tích lũy điểm thành công.
- Hiển thị danh sách Top 5 của thử thách đó ở bảng bên trái (dưới phần mô tả) giúp bé có động lực vượt qua kỷ lục của các bạn khác.

---

## Verification Plan

### Automated Tests
- Khởi động hệ thống thông qua `Docker Compose`.
- Gửi các request mẫu (Signup, Login, Save Progress, Leaderboard) bằng công cụ REST Client để đảm bảo API hoạt động đúng 200/201.

### Manual Verification
- Đăng ký tài khoản mới trên giao diện Next.js, chọn avatar.
- Đăng nhập thành công và nhìn thấy thanh Navbar cập nhật avatar.
- Chơi thử thách đếm ngón tay, hoàn thành lượt chơi và kiểm tra điểm số có được đồng bộ lên Leaderboard của hệ thống hay không.
