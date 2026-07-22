# Kế hoạch triển khai: Trang Sandbox (Tự tạo nhãn không giới hạn)

Thay vì sửa đổi trực tiếp trang `teach/page.tsx` đang chạy ổn định, chúng ta sẽ tạo một trang hoàn toàn mới dành riêng cho chế độ **Sandbox (Tự do sáng tạo)**. Điều này giúp giữ nguyên bài tập chuẩn và tạo không gian an toàn cho bé khám phá.

## Proposed Changes

### 1. Tạo trang Sandbox mới
- **Copy component hiện tại**: Sao chép logic từ `teach/page.tsx` sang một route mới: `client/src/app/(private)/challenge/sandbox/page.tsx`.
- **Đổi tên & UI**: Đổi tiêu đề thành "Phòng Thí Nghiệm AI (Sandbox) 🧪".

### 2. Logic Quản lý Nhãn Động (Dynamic Classes)
Trong file `sandbox/page.tsx` mới:
- Chuyển `CLASSES` từ hằng số thành state: `const [classes, setClasses] = useState([])`.
- Mặc định có thể bắt đầu với mảng rỗng hoặc 1 nhãn mẫu.
- Thêm giao diện (Input + Nút Add) để bé tự gõ tên nhãn mới (vd: "Thả tim", "3 ngón tay", "Nắm tay") và thêm vào danh sách.
- Bé có thể xóa bất kỳ nhãn nào mình đã tạo.

### 3. Logic Đánh giá (Evaluation)
Vì đây là chế độ tự do, dữ liệu của bé (vd: 5 ngón, thả tim) sẽ không có trong bộ *Golden Test Dataset* (chỉ có 1 ngón, 2 ngón).
- Nút "Nộp bài cho Thầy Cô" sẽ đổi thành **"Lưu Bộ Dữ Liệu 💾"**.
- Bỏ qua bước chạy chấm điểm qua `GOLDEN_TEST_DATASET`.
- Modal xác nhận sẽ không hiện điểm số % chính xác, mà chỉ chúc mừng bé đã tạo ra một AI mới với các nhãn độc đáo của riêng mình, và lưu cấu hình này lên Server để giáo viên có thể xem.

### 4. Thêm nút điều hướng (Navigation)
- **Trên trang chủ (hoặc dashboard)**: Thêm nút dẫn đến `/challenge/sandbox` với nhãn "Phòng Thí Nghiệm AI".
- **Trên trang teach cũ**: Có thể thêm một nút phụ: *"Hoặc thử tạo AI của riêng bé trong Sandbox 🧪"* dẫn sang trang mới.

## User Review Required
> [!IMPORTANT]
> - Trang Sandbox mới sẽ không chấm điểm % chính xác như trang Teach, mà tập trung vào việc lưu trữ và xem lại các dáng tay độc lạ bé tự tạo.
> - Xin xác nhận xem bạn có đồng ý với luồng hoạt động này không để tôi bắt đầu tạo trang mới!
