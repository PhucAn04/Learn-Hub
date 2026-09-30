# 📖 Khảo Sát Tính Năng: Luồng Người Dùng Mới (Plan 10)

Chào mừng bạn đến với phiên bản tái cấu trúc hoàn chỉnh của dự án! Trong kế hoạch này, chúng ta đã loại bỏ đi những thứ không cần thiết và thiết lập lại một luồng người dùng mang đậm chất "kể chuyện". 

Mục tiêu chính là giúp trẻ nhỏ làm quen với các khái niệm phức tạp của AI thông qua một hành trình dễ hiểu, vui vẻ trước khi cho trẻ tự tay tạo Model trong Sandbox.

## 🚀 Các Tính Năng Đã Hoàn Thiện

### 1. Trang Chủ "Story-driven" (`/`)
Trang chủ không còn đơn thuần là một bảng điều khiển khô khan. 
- **Thiết kế bắt mắt:** Cụm logo `HỌC VIỆN AI NHÍ` giờ đây đã có hiệu ứng `lúc lắc sinh động` (Bounce & Pulse) kết hợp với các Icon bám sát chủ đề. Lỗi mờ Emoji cũng đã được khắc phục triệt để.
- **Tên Chương Sinh Động:** Mỗi chức năng AI được bọc trong một vỏ bọc câu chuyện lôi cuốn:
  - C1: Câu Chuyện Đếm Ngón Tay (Image Classification)
  - C2: Ngôn Ngữ Ký Hiệu Bí Mật (Gesture Recognition)
  - C3: Thám Tử Đọc Cảm Xúc (Emotion Recognition)
- Nút bấm điều hướng giờ đây sẽ không mở lên Pop-up chật chội nữa, mà đưa thẳng trẻ sang một **Trang Dẫn Dắt Độc Lập**.

### 2. Trang Dẫn Dắt & Câu Đố Lý Thuyết (`/concepts/[slug]`)
Đây là trái tim của bản nâng cấp này. Các trang được xây dựng chung trên một `Dynamic Route`, giúp dễ dàng mở rộng thêm các Chương sau này.

**Cách Hoạt Động:**
- **Không Gian Rộng Rãi:** Trẻ được đưa tới một trang mới toanh, loại bỏ mọi yếu tố gây nhiễu.
- **Slide Ngang:** Thông tin được chia nhỏ thành các Slide. 
  - Tại đây, các thuật ngữ kỹ thuật khô khan (như lấy mẫu ảnh, vẽ điểm ảnh lưới khuôn mặt) được "dịch" sang ngôn ngữ trẻ thơ cực kỳ khéo léo (ví dụ: đắp một tấm lưới tàng hình lên mặt bé để tìm hiểu cảm xúc).
- **Trạm Gác Quiz (Câu Đố):** Ở Slide cuối, trẻ phải giải một câu đố nhỏ để kiểm tra xem đã hiểu khái niệm chưa.
  - Chọn Sai: Thông báo nhẹ nhàng, giải thích thêm.
  - Chọn Đúng: Âm thanh "Ting Ting" chiến thắng cất lên!

### 3. Cánh Cửa Mở Ra Sandbox (`/challenge/...`)
Điểm hay nhất của luồng thiết kế mới này là tính kết nối logic. Sau khi trẻ chứng minh được sự hiểu biết ở màn Quiz, một Nút bấm nổi bật sẽ hiển thị, dẫn bé trực tiếp tới các Sandbox nguyên bản mà hệ thống đã xây dựng trước đây (`/challenge/teach`, `/challenge/teach-gestures`, `/challenge/teach-face`).

Bằng cách này, chúng ta đã biến một trang Web học tập bình thường thành một **Hành Trình Khám Phá AI** đầy cảm hứng!
