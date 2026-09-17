# Báo Cáo Phân Tích Codebase Hiện Tại

Theo yêu cầu của anh/chị, em đã quét lại toàn bộ kiến trúc mã nguồn (`server` và `client`) để lên kế hoạch sửa đổi chính xác. Dưới đây là hiện trạng và các công việc kỹ thuật cần làm:

## 1. Phía Server (Backend - NestJS)
Hiện tại, Backend đang được xây dựng bằng **NestJS** kết hợp với **TypeORM** (cơ sở dữ liệu PostgreSQL). 

- **Hiện trạng Database**: Bài nộp của bé đang được lưu trong bảng `submissions` (tại `server/src/modules/submissions/entities/submission.entity.ts`). Bảng này hiện đang nhồi nhét cả `dataset` (dạng JSON) và `accuracy` (điểm).
- **Phân tích Cloudinary**: Kiểm tra file `package.json` của server, em **chưa thấy** thư viện `cloudinary` được cài đặt.
- **Công việc kỹ thuật cần làm**:
  - `npm install cloudinary multer` để hỗ trợ tiếp nhận và upload ảnh.
  - Tạo 2 module mới hoàn toàn: `datasets` và `models` (bao gồm Entity, Controller, Service).
  - Cập nhật hàm xử lý upload: Tách các ảnh Base64 từ Frontend gửi lên, đẩy qua API của Cloudinary, lấy URL trả về, sau đó ghi các URL này cùng với Features vào tệp tin JSON tĩnh. Lưu đường dẫn tệp JSON này vào bảng `Dataset`.

## 2. Phía Client (Frontend - Next.js)
Frontend đang dùng **Next.js (App Router)** và **TailwindCSS**.

- **Hiện trạng Chế độ "Dạy Bạn AI"**: Logic màn hình thử thách đang nằm ở các file như `client/src/app/(private)/challenge/teach-face/page.tsx`. Tại đây đã có sẵn giao diện thu thập dữ liệu bằng Camera và hook tính điểm AI (`useMl5FaceMesh`, `useCamera`).
- **Hiện trạng Dashboard**: 
  - Đã có khung màn hình giáo viên tại `client/src/app/(private)/teacher/page.tsx`.
  - Đã có khung màn hình học sinh tại `client/src/app/(private)/dashboard/page.tsx`.
- **Công việc kỹ thuật cần làm**:
  - **Trong file thử thách (Ví dụ: `teach-face`)**:
    - Thêm nút **Clear Dataset** (`setSamples([])`).
    - Viết lại hàm Nộp Bài (`submit`): Gửi mảng mẫu vật chứa Base64 lên Server để Server đẩy lên Cloudinary (Hoặc dùng Unsigned Upload của Cloudinary trực tiếp từ Frontend để giảm tải cho Server).
    - Tính điểm Test Score ngay sau khi có bộ Golden Dataset.
  - **Tạo các màn hình (Route) mới**:
    - Lịch sử học sinh: `app/(private)/student/history/[challengeType]/page.tsx`
    - Chi tiết nộp bài cho giáo viên: `app/(private)/teacher/student/[userId]/challenge/[challengeType]/page.tsx`
  - **Xây dựng UI Component**: Tạo một Component `DatasetGallery` nhận vào file JSON URL, tự động parse và hiển thị danh sách ảnh từ Cloudinary thật đẹp mắt.

## Đề Xuất Luồng Upload Cloudinary Tối Ưu
> [!TIP]
> Em khuyến nghị **upload ảnh trực tiếp từ Frontend lên Cloudinary** (bằng Unsigned Upload) ngay khi bé vừa bấm chụp xong (hoặc khi bấm nộp bài). Backend Server sẽ không phải gánh luồng xử lý ảnh nặng nề, chỉ cần nhận URL mượt mà từ Frontend và lưu file JSON. Cách này giúp server không bao giờ bị nghẽn!

## Kết luận
Codebase hiện tại rất rõ ràng và được tổ chức tốt. Việc tích hợp tách bảng `Dataset`/`Model` và `Cloudinary` hoàn toàn khả thi mà không ảnh hưởng (break) các tính năng cũ. 

Nếu anh/chị đồng ý với báo cáo phân tích này, chúng ta có thể chuyển sang bước Code (Thực thi) ạ!
