# Tối ưu hóa trang Profile Giáo Viên và Xử lý lỗi 404

Dưới đây là kế hoạch chi tiết để loại bỏ sự dư thừa của trang Profile giáo viên và giải quyết các liên kết hỏng (404) trong hệ thống.

## Open Questions
- Bạn có muốn mình tiến hành code luôn giao diện cho các trang `teach-body` và `body-exercise` (thuộc Phase 4) ngay sau khi tối ưu Profile xong không?

## Proposed Changes

### 1. Tối ưu luồng Profile Giáo Viên
Hiện tại, trang `/profile/teacher` đang là một bước trung gian thừa thãi. Giáo viên truy cập vào Profile chỉ để thấy thông tin cá nhân và 2 nút bấm dẫn sang trang Dashboard (`/teacher`). 

**Giải pháp:**
- Gộp thông tin cá nhân (Avatar, Tên, Email) vào thẳng phần đầu của trang Dashboard (`/teacher/page.tsx`).
- Thay đổi logic điều hướng ở `/profile/page.tsx`: Khi giáo viên bấm vào "Trang cá nhân" trên thanh điều hướng, hệ thống sẽ chuyển hướng thẳng đến `/teacher` thay vì `/profile/teacher`.
- Xóa hoàn toàn file `/profile/teacher/page.tsx`.

### 2. Xử lý các trang 404 (Missing Pages)
Qua rà soát toàn bộ source code, mình phát hiện các trang sau đang bị lỗi 404:

#### [DELETE] `/concepts` (404)
- **Vị trí lỗi:** Đang được gắn ở nút "Xem giáo án khái niệm AI" trong trang `/profile/teacher`.
- **Cách xử lý:** Vì trang `/profile/teacher` sẽ bị xóa, lỗi này sẽ tự động được khắc phục. Trong Dashboard mới, nếu cần, mình sẽ dẫn link về `/home` (trang tổng hợp các concept).

#### [NEW] `/challenge/teach-body` (404)
- **Vị trí lỗi:** Nút "Bắt đầu Dạy AI" ở cuối trang khái niệm Tập Thể Dục (`/concepts/body-exercises`).
- **Nguyên nhân:** Đây là giao diện của Phase 4 (Nhận diện cơ thể) chưa được xây dựng.
- **Cách xử lý:** Cần tạo mới trang này để học sinh có thể thu thập dữ liệu cơ thể.

#### [NEW] `/challenge/body-exercise` (404)
- **Vị trí lỗi:** Sau khi huấn luyện AI cơ thể xong, hệ thống sẽ chuyển học sinh sang trang game này.
- **Nguyên nhân:** Giao diện Game của Phase 4 chưa được xây dựng.
- **Cách xử lý:** Cần tạo mới trang gameplay này.

## Verification Plan
1. Đăng nhập bằng tài khoản Giáo viên, bấm vào "Trang cá nhân" trên Navbar -> Đảm bảo được chuyển thẳng đến trang báo cáo thành tích (`/teacher`).
2. Đảm bảo trên đầu trang `/teacher` có hiển thị tên, avatar và email của giáo viên.
3. Chờ phản hồi của bạn để tiếp tục code Phase 4 (các trang 404 còn lại).
