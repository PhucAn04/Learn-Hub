# Kế Hoạch Triển Khai: Chế Độ Dạy Hành Động (Teach Action) Cho Học Sinh & Xác Thực Dữ Liệu Với Bộ Mẫu Của Giáo Viên

Tài liệu này phân tích trang `teacher/training/teach-action/page.tsx`, thiết kế trang học sinh `/challenge/teach-action`, thêm nút điều hướng chuyển đổi giữa `/challenge/teach-free` và `/challenge/teach-action`, đồng thời tích hợp bước kiểm tra & xác thực (Validation) với bộ dữ liệu template của Giáo viên ngay sau khi huấn luyện AI cho cả 2 trang, đảm bảo không sửa đổi bất kỳ logic đã định sẵn của các bài teach trước đó.

---

## 1. Phân Tích Trang `teacher/training/teach-action/page.tsx`

Trang Giáo viên `teacher/training/teach-action/page.tsx` hiện có kiến trúc phức tạp và phong phú bậc nhất trong hệ thống Learn-Hub:
1. **Mục đích cốt lõi (Action-to-Object Mapping)**:
   - Dạy AI liên kết giữa **Hành động / Cử chỉ (Gesture)** với **Đối tượng mục tiêu (Object)**.
   - Mỗi nhãn (Class) có thể chứa 2 loại mẫu dữ liệu:
     - `sourceType: 'object'`: Ảnh tĩnh của đối tượng (Quả táo 🍎, Chó 🐶, Bút ✏️, Cây trồng 🌿...).
     - `sourceType: 'gesture'`: Chuỗi khung hình cử chỉ chuyển động (Vẫy tay 👋, Nắm đấm ✊, Xoay cổ tay...).
2. **Cơ chế Thu Thập Dữ Liệu Đa Dạng**:
   - **Giữ để chụp liên tục (Hold-to-record 📸)**: Chụp liên tục @ 300ms.
   - **Giữ để quay cử chỉ (Gesture Record 🎥)**: Chụp liên tục @ 120ms (8.3 FPS) để ghi nhận chuyển động mượt mà.
   - **Tự động thu cử chỉ 5s / 10s (Auto Motion Tracker ⏱️)**:
     - Đếm ngược 3 giây sinh động (`3... 2... 1... Bắt đầu!`).
     - Đo chuyển động thời gian thực (`liveMotionScore`) bằng frame-difference trên canvas; chỉ lưu các khung hình có chuyển động rõ rệt.
     - Thanh tiến trình thời gian thu thập và nút dừng sớm.
   - **Trích xuất video (.mp4/.webm) 🎬**: Cho phép tải lên video quay sẵn, giải nén từng khung hình chuyển động @ 120ms.
   - **Tải ảnh hàng loạt 📁**: Hỗ trợ tải nhiều ảnh cho cả đối tượng và cử chỉ.
3. **Bộ Xem Chuỗi Chuyển Động (Motion Sequence Flipbook Player 🎞️)**:
   - Modal xem lại chuỗi cử chỉ đã thu thập như một tập ảnh động (Flipbook).
   - Nút Phát / Tạm dừng (Play/Pause @ 8.3 FPS / 120ms), tua từng khung hình (◀ ▶), hiển thị chỉ số khung hình `idx / total`.
4. **Huấn Luyện & Nhận Diện**:
   - Sử dụng `TfTrainer` (MobileNet embeddings) kết hợp Dataset Prototypes (`REFERENCE_CENTROIDS`).
   - Nhận diện thời gian thực qua webcam + kiểm thử ảnh tĩnh với bộ lọc OOD 4 tầng (4-Tier Bulletproof OOD).

---

## 2. Kế Hoạch Đổi Mới & Kiến Trúc Triển Khai

### 2.1. Nút Điều Hướng Chuyển Đổi Chế Độ Giữa Teach-Free và Teach-Action
- Trong [`/challenge/teach-free/page.tsx`](file:///D:/HOCTAP/Learn-Hub/client/src/app/(private)/challenge/teach-free/page.tsx):
  - Thêm nút/banner nổi bật ở đầu trang: **"🎬 Chuyển sang Dạy Hành Động (Teach Action) ⚡"** dẫn đến `/challenge/teach-action`.
- Trong [`/challenge/teach-action/page.tsx`](file:///D:/HOCTAP/Learn-Hub/client/src/app/(private)/challenge/teach-action/page.tsx):
  - Thêm nút/banner nổi bật: **"🖼️ Chuyển sang Chế Độ Phân Loại Ảnh Tạo Nhãn Tự Do (Teach Free) 🧪"** dẫn về `/challenge/teach-free`.

### 2.2. Xây Dựng Trang Học Sinh `/challenge/teach-action/page.tsx`
- Sao chép toàn bộ các tính năng tạo nhãn tự do và thu thập ảnh/video của Giáo viên:
  - Tự do thêm/xóa nhãn (tối thiểu 2, tối đa 10 nhãn), kèm emoji picker.
  - Gợi ý 1-Click Presets (Bác sĩ Nông nghiệp, Thế giới Động vật, Vườn Trái Cây, Oẳn tù tì).
  - Thu thập 2 chế độ: Chụp đối tượng (`object`) và Quay cử chỉ (`gesture` với Countdown 3s + Auto 5s/10s + Video Upload extraction).
  - Flipbook Player xem chuỗi cử chỉ 🎞️.
  - Kiểm tra chất lượng ảnh và Zero-Shot OOD Warning (viền đỏ trong Thư viện).
  - Cài đặt tham số nâng cao Under the Hood ⚙️.
  - Tự động nạp bài tập từ Thầy/Cô (nếu giáo viên có xuất bản template `teach-action`).
  - Luồng nộp bài & đánh giá học sinh (`ReportCard`, câu hỏi phản tư, lưu tiến độ hành trình).

### 2.3. Bước Xác Thực Với Bộ Dữ Liệu Template Của Giáo Viên (Teacher Template Validation)
> [!IMPORTANT]
> **Ràng buộc nghiêm ngặt**: Không chỉnh sửa các logic đã định sẵn của các bài teach trước (`TeachPanel.tsx`, `BodyTeachPanel.tsx`, `teacher-validator.ts`). Toàn bộ logic kiểm tra và giao diện phản hồi sẽ được viết vào file hoàn toàn mới!

Tạo mới 2 file độc lập:
1. **[`client/src/lib/teacher-image-validator.ts`](file:///D:/HOCTAP/Learn-Hub/client/src/lib/teacher-image-validator.ts)** [NEW]:
   - Module chuyên biệt đối soát đặc trưng MobileNet cho các bài teach tự do (`teach-free` và `teach-action`):
     - **Chiều 1: Đánh giá ảnh học sinh bằng bộ mẫu Giáo viên**:
       - So sánh từng ảnh học sinh với bộ `teacherTemplate.samples` (hoặc dataset prototypes nếu chưa có bài giáo viên).
       - Phát hiện các ảnh nghi ngờ sai nhãn (`isMisclassified`), ảnh tối/mờ (`isDark`, `isBlurry`).
       - Phân tích độ cân bằng số lượng mẫu giữa các nhãn.
     - **Chiều 2: Đánh giá mô hình học sinh trên bộ mẫu Giáo viên**:
       - Cho mô hình AI vừa huấn luyện của học sinh dự đoán toàn bộ ảnh mẫu của Giáo viên.
       - Tính tỷ lệ khớp (`teacherTemplateAccuracy`: ví dụ 92%).
       - Chỉ ra các nhãn mà AI của học sinh nhận diện nhầm so với giáo viên.
2. **[`client/src/components/journey/ImageAIFeedbackModal.tsx`](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/ImageAIFeedbackModal.tsx)** [NEW]:
   - Modal hiển thị trực quan kết quả xác thực ngay sau khi bấm **"Dạy AI HỌC 🚀"**:
     - Thống kê tỷ lệ chuẩn xác đối soát với Thầy Cô (Accuracy %).
     - Tab **"Ảnh Nghi Ngờ Sai Nhãn"**: So sánh song song ảnh học sinh chụp vs ảnh mẫu chuẩn của Thầy Cô. Cho phép học sinh xóa nhanh ảnh lỗi.
     - Tab **"Cân Bằng Dữ Liệu"**: Biểu đồ phân bổ mẫu giữa các nhãn.
     - Tab **"Chất Lượng Ảnh"**: Cảnh báo ảnh mờ, thiếu sáng.
     - Nút **"Tiếp tục thử nghiệm"** để học sinh tiến tới bước kiểm tra camera / nộp bài.

---

## 3. Các Tệp Sẽ Tạo & Chỉnh Sửa

### Component / Module Mới
1. **[NEW] `client/src/lib/teacher-image-validator.ts`**:
   - Thuật toán xác thực mẫu ảnh và cử chỉ với Teacher Template & Prototypes.
2. **[NEW] `client/src/components/journey/ImageAIFeedbackModal.tsx`**:
   - Giao diện báo cáo phân tích đối soát dữ liệu của bé với Thầy Cô sau khi huấn luyện.
3. **[NEW] `client/src/app/(private)/challenge/teach-action/page.tsx`**:
   - Trang thử thách Dạy AI Hành Động & Đối Tượng dành cho học sinh.

### Tệp Cập Nhật
4. **[MODIFY] `client/src/app/(private)/challenge/teach-free/page.tsx`**:
   - Thêm nút chuyển sang chế độ Teach Action.
   - Gọi bước xác thực `validateStudentWithTeacherTemplate` và mở `ImageAIFeedbackModal` sau khi huấn luyện AI.

---

## 4. Kế Hoạch Xác Minh (Verification Plan)

### Kiểm Tra Tự Động & Biên Dịch
- Chạy `npx tsc --noEmit` trong thư mục `client` để đảm bảo 100% không có lỗi TypeScript.
- Chạy `npm run build` để kiểm tra hoàn tất bundling Next.js Turbopack cho cả 2 route `/challenge/teach-free` và `/challenge/teach-action`.

### Kiểm Tra Nghiệp Vụ & Người Dùng
- Kiểm tra nút chuyển đổi qua lại giữa `/challenge/teach-free` và `/challenge/teach-action`.
- Kiểm tra luồng bấm "DẠY AI HỌC 🚀": AI học xong tự động chạy bước validate với Teacher Template và hiển thị modal phản hồi sư phạm rõ ràng.
- Đảm bảo các trang teach cũ (`/challenge/teach`, `/challenge/teach-face`, `/challenge/teach-body`, `/challenge/teach-gestures`, `/challenge/teach-two-hands`) hoạt động hoàn toàn bình thường, không bị ảnh hưởng.
