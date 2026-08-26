# Walkthrough: Định tuyến lại Landing Page và Dashboard

Dựa trên yêu cầu của bạn, hệ thống đã được tái cấu trúc thành công với các thay đổi sau:

## 1. Landing Page Mới (`/`)
Trang giới thiệu các slide cơ bản "Trí Tuệ Nhân Tạo (AI) là gì?" trước đây ở `/concepts` nay đã chính thức trở thành **Trang chủ (Landing Page)** của website. 
- Tại màn hình hoàn thành câu đố, thay vì đưa bé vào Sandbox ngay, hệ thống hiển thị thông điệp mời gọi bé Đăng Nhập hoặc Đăng Ký kèm theo các nút kêu gọi hành động (Call To Action).

## 2. Trang Dashboard Mới (`/dashboard`)
Trang chứa danh sách 3 câu chuyện khám phá (Đếm ngón tay, Cử chỉ, Cảm xúc) đã được dời vào tuyến đường riêng `app/(private)/dashboard/page.tsx`.
- Người dùng bắt buộc phải **Đăng nhập** mới có thể nhìn thấy và truy cập vào danh sách các bài học tương tác này, đúng với tinh thần "Đăng nhập để khám phá".

## 3. Cập nhật Menu Điều Hướng (Navbar)
- Đã **loại bỏ** nút "Lớp Học AI" do trang bài giảng lý thuyết đã chuyển ra ngoài làm Trang Chủ.
- Nút **"Trang Chủ"** hiện tại có khả năng nhận biết người dùng:
  - Nếu chưa đăng nhập: Trỏ về `/` (Slide khởi động).
  - Nếu đã đăng nhập: Trỏ về `/dashboard` (Danh sách 3 câu chuyện).

## 4. Cập nhật Luồng Xác Thực
Các trang Đăng Nhập (`/login`) và Đăng Ký (`/register`) đã được thay đổi đích đến. Ngay khi tạo tài khoản hay đăng nhập thành công, hệ thống sẽ đưa học sinh nhảy thẳng vào `Trang Dashboard`, giúp bắt đầu trải nghiệm 3 câu chuyện lập tức thay vì đưa về lại trang Slide.

## Cách Kiểm Tra
1. Hãy mở trình duyệt ở chế độ Ẩn danh, vào đường dẫn gốc (Homepage) để xem Slide Bài Mở Đầu và chơi thử Quiz để thấy nút **Đăng Nhập/Đăng Ký**.
2. Thử Đăng Ký hoặc Đăng Nhập một tài khoản, bạn sẽ thấy mình được chuyển ngay tới trang danh sách bài học thú vị! 
3. Xem lại nút "Trang Chủ" trên Navbar lúc này xem nó có chuyển hướng về danh sách bài học không nhé.
