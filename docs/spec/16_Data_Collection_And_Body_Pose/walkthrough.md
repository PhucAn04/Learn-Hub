# Learn-Hub — Walkthrough: Hoàn Tất Phase 6 (Google OAuth & Google Drive)

## ✅ Build Status: PASS

```
Server: ✓ Compiled successfully (0 errors)
Client: ✓ Compiled successfully (22 static pages generated)
```

---

## Chi tiết Triển Khai Phase 6

### 1. Backend: Đăng nhập Google (OAuth2)
- **`GoogleStrategy`**: Tích hợp `passport-google-oauth20`, lấy thông tin cá nhân và xin quyền truy cập Google Drive (`https://www.googleapis.com/auth/drive.file`).
- **`AuthService.validateOAuthLogin`**: Tự động tạo user mới hoặc liên kết với user cũ qua email, đồng thời lưu trữ `googleAccessToken` để thao tác với Google Drive.
- **`AuthController`**: Thêm 2 endpoints mới:
  - `GET /auth/google`: Redirect sang trang đăng nhập của Google.
  - `GET /auth/google/callback`: Xử lý dữ liệu trả về và redirect sang giao diện frontend kèm theo token.
- Cập nhật entity `User` để chứa các trường `googleId`, `googleAccessToken`, `googleRefreshToken`, `avatarUrl`.

### 2. Backend: Tích hợp Google Drive
- **`GoogleDriveService`**: Đảm nhiệm việc kết nối với Google Drive API của user.
  - Tự động tạo thư mục `Learn-Hub-[challengeType]-[date]` nếu chưa có.
  - Upload file (ảnh/video) lên thư mục trên.
  - Đặt quyền chia sẻ (chia sẻ dạng read-only link).
- **`DatasetsService.createDataset`**: Sau khi lưu bộ dữ liệu xuống database thành công, một **Task chạy nền (Background)** sẽ tự động kích hoạt để upload thumbnail của các ảnh vừa thu thập được lên Google Drive mà **không làm chậm trễ phản hồi của hệ thống**. Khi xong, thư mục URL sẽ được lưu lại trong CSDL (`googleDriveFolderUrl`).

### 3. Frontend: Nút Đăng nhập và Xử lý Callback
- Gắn nút **Đăng nhập với Google** và **Đăng ký với Google** vào 2 trang `/login` và `/register`.
- Thiết lập trang `app/auth/callback/page.tsx` (có Suspense/CSR bailout fix) để thu nhận JWT token từ URL do server gửi tới, sau đó lưu vào bộ nhớ cục bộ và chuyển hướng user vào trang `/home`.

---

## 🔧 Hướng dẫn Cấu Hình (Cho Admin/Dev)
Để tính năng này chạy được trên môi trường thật, bạn cần cấu hình Google Cloud Console:
1. Tạo một dự án (Project) mới.
2. Bật API **Google Drive API** và **Google+ API / People API**.
3. Tại phần OAuth Consent Screen, thêm Test Users nếu đang ở chế độ Testing.
4. Tạo Credentials loại **OAuth client ID** (Loại Web Application).
5. Đặt Authorized redirect URIs là: `http://localhost:3001/auth/google/callback`.
6. Sao chép Client ID và Client Secret đưa vào tệp `.env` của thư mục `server`:
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
   CLIENT_URL=http://localhost:3000
   ```

Tất cả luồng dữ liệu về Media của nền tảng hiện tại (Cloudinary và Google Drive) đã được hoàn thiện đúng theo thiết kế. Hệ thống vẫn giữ lại Upload Cloudinary mặc định ở frontend, nhưng có thêm Drive Sync ở backend!
