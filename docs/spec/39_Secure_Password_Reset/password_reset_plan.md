# Kế hoạch Triển khai Tính năng Cấp lại Mật khẩu (Secure Password Reset)

## Mục tiêu
Cung cấp cơ chế cấp lại mật khẩu cho người dùng (Giáo viên và Học sinh) đáp ứng các tiêu chí bảo mật khắt khe:
1. **Zero-Knowledge đối với Admin**: Admin (hoặc bất kỳ ai quản trị hệ thống) tuyệt đối không được xem mật khẩu mới của người dùng dưới dạng plain text trên giao diện.
2. **Không rò rỉ dữ liệu (No Data Leak)**: Quá trình thiết lập lại mật khẩu không được phép trả về mật khẩu hay dữ liệu nhạy cảm (như file ảnh, thông tin cá nhân) trên các API response.
3. **An toàn mạng**: Toàn bộ quá trình phải được mã hóa và có cơ chế giới hạn thời gian (Time-to-Live).

---

### Phương án Đề xuất: Giải pháp Kết hợp (Hybrid Approach)
*Kết hợp cả gửi Email tự động và Copy Link thủ công.*

**Cách hoạt động của luồng kết hợp:**
1. **(Admin)** Trong trang quản lý User của Admin Panel, Admin nhấn nút `[Cấp Lại Mật Khẩu]`.
2. **(Server)** Backend ngay lập tức sinh ra một Reset Token (mã hóa an toàn) và lưu băm vào Database với thời hạn 15 phút.
3. **(Giao diện Admin)** Một Modal (Cửa sổ Pop-up) hiện lên cung cấp cho Admin 2 lựa chọn song song:
   - **Tùy chọn A (Tự động):** Nút `[Gửi link qua Email]`. Nhấn vào đây hệ thống sẽ dùng Nodemailer tự động gửi link reset trực tiếp vào hòm thư của User. Admin đóng cửa sổ.
   - **Tùy chọn B (Thủ công):** Hiển thị sẵn đường link `https://<domain>/reset-password?token=xyz...` và nút `[Copy Link]`. Admin có thể copy link này để gửi Zalo/Teams cho user nếu user không check được email hoặc hệ thống email bị lỗi.
4. **(Public User)** Ngoài ra, ở trang Đăng nhập (`/login`), User cũng có thể tự bấm nút `[Quên Mật Khẩu]` để hệ thống tự động gửi email (sử dụng lại logic của Tùy chọn A).
5. **(Hoàn thành)** Dù qua Email hay Link copy tay, User bấm vào sẽ mở ra trang web nhập mật khẩu mới. Admin không hề biết mật khẩu và API không trả về bất kỳ dữ liệu nhạy cảm nào.

> **Lợi ích tối đa**: Rất linh hoạt. Vừa có sự chuyên nghiệp tự động của Email (P.án 2), vừa có tính dự phòng cao (fallback) khi hệ thống mail trục trặc hoặc user muốn Admin cấp ngay qua tin nhắn chat (P.án 1).

---

## Chi tiết Kỹ thuật Triển khai (Giải pháp Kết hợp)

### 1. Thay đổi Database (User Entity)
Bổ sung các trường sau vào `user.entity.ts`:
```typescript
@Column({ nullable: true, select: false })
resetPasswordToken?: string; // Lưu token dạng chuỗi đã được băm (hash)

@Column({ type: 'timestamp', nullable: true, select: false })
resetPasswordExpires?: Date; // Hạn sử dụng của token
```

### 2. Backend API (NestJS)

**Bổ sung vào `AdminUsersController` & `AuthController`:**
*   `POST /admin/users/:id/generate-reset-link`:
    *   **Logic**: Tạo token, băm token lưu DB (hạn 15 phút), trả về `{ resetLink: string }` cho Admin Panel hiển thị.
*   `POST /admin/users/:id/send-reset-email` (hoặc `/auth/forgot-password` cho User):
    *   **Logic**: Tạo token, băm token lưu DB. Gọi service Email (Nodemailer) gửi thư chứa link. Trả về `{ success: true }`.
*   `POST /auth/reset-password`:
    *   **Input**: `{ token: string, newPassword: string }`
    *   **Logic**: Kiểm tra token hợp lệ & còn hạn. Hash password mới cập nhật vào DB. Xóa token cũ. Trả về 200 OK. Lọc sạch không trả về Avatar hay dữ liệu dư thừa.

### 3. Frontend (Next.js)

**Phần Admin Panel (`app/(admin)/...`):**
*   Trong trang chi tiết User, bấm `[Cấp Lại Mật Khẩu]` sẽ gọi API `/generate-reset-link` trước để lấy link.
*   Hiển thị Modal:
    *   Ô Input read-only chứa link + nút `[Copy]`.
    *   Nút hành động: `[Gửi Link này qua Email cho User]`. Nút này gọi API gửi mail.

**Phần Public (`app/(public)/auth/...`):**
*   **Trang Quên mật khẩu**: Nhập email -> Hệ thống báo đã gửi link.
*   **Trang Đặt lại mật khẩu (`/auth/reset-password?token=...`)**:
    *   Form có 2 ô: `Mật khẩu mới` và `Xác nhận mật khẩu mới` (ẩn ký tự `***`).
    *   Submit thành công chuyển hướng về `/login`.

---

## Đánh giá Tiêu chuẩn Bảo mật (Security Checklist)
- [x] **Mật khẩu tàng hình**: Admin không nhìn thấy mật khẩu (bởi vì Admin chỉ gửi Link, User tự thiết lập password mới ở máy của họ).
- [x] **Không rò rỉ Dữ liệu DB (No DB Leak)**: `resetPasswordToken` lưu dưới DB đã được băm (hash). Kẻ gian hack DB cũng không lấy được link reset. Các API trả về được loại bỏ hoàn toàn các trường dữ liệu ảnh hay thông tin nhạy cảm.
- [x] **Time-boxed**: Token tự động hủy sau 15 phút, ngăn chặn việc tái sử dụng.
- [x] **Data Privacy**: Endpoint đổi mật khẩu chỉ trả về thông báo thành công, không query ngược lại dữ liệu User để trả về HTTP response.
