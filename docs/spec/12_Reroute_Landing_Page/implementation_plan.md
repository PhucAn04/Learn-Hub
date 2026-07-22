# Định tuyến lại trang Landing Page và Concepts

Dựa trên yêu cầu của bạn, chúng ta sẽ thiết lập trang Slide Giới thiệu AI (trang `/concepts` cũ) làm trang đích (Landing Page - hiển thị đầu tiên khi vào web). Các chức năng khám phá chuyên sâu (3 câu chuyện) sẽ được chuyển vào một trang Dashboard dành cho người dùng đã đăng nhập.

## Các thay đổi đề xuất

### 1. Thay đổi nội dung trang chủ (`/`)
- Chuyển toàn bộ nội dung của trang `/concepts/page.tsx` (Slide Bài học giới thiệu AI) ra ngoài thành `app/(public)/page.tsx`.
- Tại màn hình hoàn thành câu đố, thay vì nút "Vào Game Đếm Ngón Tay!", sẽ thay bằng lời nhắn: *"🎉 Chúc mừng bé đã hoàn thành bài học mở đầu! Để khám phá nhiều trò chơi thú vị hơn, bé hãy đăng nhập hoặc đăng ký vào hệ thống vừa học vừa chơi này nhé! 🚀"* kèm theo 2 nút **Đăng Nhập** và **Đăng Ký**.

### 2. Di chuyển trang chủ hiện tại (3 câu chuyện)
- Trang chủ hiện tại (chứa Chương 1: Đếm ngón tay, Chương 2: Cử chỉ, Chương 3: Cảm xúc) sẽ được di chuyển vào `app/(private)/dashboard/page.tsx`.
- Điều này có nghĩa là người dùng **bắt buộc phải đăng nhập** mới thấy được danh sách các bài học này.

### 3. Cập nhật thanh Navbar
- Xóa bỏ mục **"Lớp Học AI"** trên Navbar.
- Chỉnh sửa nút **"Trang Chủ"**: 
  - Nếu đã đăng nhập: Chuyển hướng đến `/dashboard` (Bản đồ bài học).
  - Nếu chưa đăng nhập: Chuyển hướng đến `/` (Landing Page Giới thiệu AI).

### 4. Cập nhật luồng Đăng nhập / Đăng ký
- Chỉnh sửa file `login/page.tsx` và `register/page.tsx` để khi đăng nhập thành công, hệ thống sẽ chuyển hướng người dùng thẳng tới `/dashboard` thay vì `/` như hiện tại.
- Xóa bỏ file `app/(public)/concepts/page.tsx` do đã được gộp ra trang chủ. (Các trang con như `/concepts/fingers` vẫn giữ nguyên để phục vụ cho Dashboard).

## User Review Required
> [!IMPORTANT]  
> Xin bạn hãy xác nhận xem việc chuyển "3 Câu chuyện khám phá" vào trang `/dashboard` (chỉ dành cho người đã đăng nhập) có đúng với ý định "để khám phá nhiều hơn bé hãy đăng nhập..." của bạn không nhé? Nếu bạn đồng ý, hãy bấm **Proceed/Tiếp tục** để mình thực hiện.
