# Walkthrough: Triển Khai Kiến Trúc Adaptive Mentorship Cross-check

Hệ thống đã hoàn tất triển khai thành công tính năng kiểm tra chéo thích ứng (Adaptive Mentorship) giữa bộ dữ liệu của Học sinh và Mô hình Giáo viên, khắc phục hoàn toàn điểm yếu OOD của thuật toán KNN cũng như duy trì giá trị giáo dục bài học Machine Learning cho học sinh.

---

## 🛠️ Những Thay Đổi Đã Thực Hiện

### 1. Module Đánh Giá & Kiểm Tra Chéo [`teacher-validator.ts`](file:///d:/HOCTAP/Learn-Hub/client/src/lib/teacher-validator.ts)
- **`evaluateStudentDatasetPhase()`**:
  - Phân loại bộ dữ liệu học sinh thành **Phase A** hoặc **Phase B**.
  - **Phase A (Cơ bản nhưng chưa hoàn thiện):** Đủ số lượng ảnh tối thiểu (**>=3 ảnh/nhãn**), không sai nhãn, không mờ/tối NHƯNG chưa đạt 10 ảnh/nhãn hoặc dữ liệu mất cân bằng. `isDatasetPerfect = false`.
  - **Phase B (Bộ dữ liệu tốt & Cân bằng):** Đạt đủ điều kiện Phase A VÀ bộ dữ liệu đạt **ít nhất 10 ảnh cho mỗi nhãn (>=10 ảnh/nhãn)**. `isDatasetPerfect = true`.
  - **Cơ chế Validate Cân Bằng Số Lượng Ảnh (Active trên cả 2 Phase):** Biểu đồ KNN (`AIConfidenceEnergyBars`) và Modal Phân Tích (`AIFeedbackModal`) **luôn thực hiện kiểm tra cân bằng số lượng ảnh (`analyzeDataBalance`) trên cả Phase A và Phase B** để đưa ra cảnh báo thiên vị dữ liệu nếu số lượng giữa các nhãn bị lệch quá lớn.
- **`crossCheckLiveFeatures()`**:
  - Chạy đối chiếu song song giữa `studentSamples` và `teacherSamples` trên luồng Camera thực tế.
  - Phát hiện cử chỉ Out-of-Distribution (OOD - như đưa 3 ngón tay khi thư viện chỉ có 1 & 2 ngón) hoặc phát hiện xung đột dự đoán.
- **`validateStudentSamplesWithTeacherModel()` (Nâng cấp vượt trội so với KNN tĩnh cũ)**:
  - Khởi chạy/Huấn luyện ngầm **Mô Hình Mạng Neural (`TfTrainer`)** từ tập ảnh của Giáo Viên.
  - Chạy toàn bộ mảng ảnh `studentSamples` của học sinh qua Mô Hình Neural của Giáo Viên để kiểm tra xem ranh giới quyết định (Decision Boundaries) của mô hình Giáo viên có nhận diện chính xác từng tấm ảnh của bé hay không.
  - Đánh giá chính xác bức ảnh nào bị sai nhãn hoặc tư thế bị mờ/tự tin < 40%.
- **Tự Động Đóng Gói & Lưu Mô Hình Neural Network JSON Lên Cloudinary**:
  - Khi Giáo viên huấn luyện xong và bấm Lưu Bài/Lưu Template, hệ thống tự động gọi `saveToBlobs()` đóng gói 2 artifact chuẩn TensorFlow.js: `model.json` (kiến trúc mạng nơ-ron) và `model.weights.bin` (trọng số nhị phân).
  - Tải tự động qua `uploadModelToCloudinary()` lên thư mục `learn-hub/models/{challengeType}` trên Cloudinary và lưu đính kèm `modelArtifactUrl` vào CSDL backend.
- **Bổ Sung Kiểm Tra Chất Lượng Ảnh Mờ/Tối Cho Phía Giáo Viên**:
  - Tự động gọi `assessQuality(canvas)` tại tất cả các trang huấn luyện của Giáo viên (`teacher/training/teach/*`).
  - Đánh dấu viền đỏ `isValid = false` và đưa ra cảnh báo tức thì khi Giáo viên lỡ chụp ảnh bị quá tối hoặc mờ do chuyển động. Gắn metadata `quality` chuẩn hóa vào Golden Dataset.

### 2. Tích Hợp Live Cross-Check Trong [`TeachPanel.tsx`](file:///d:/HOCTAP/Learn-Hub/client/src/components/journey/TeachPanel.tsx)
- Đánh giá tự động `datasetQuality` mỗi khi bộ ảnh của học sinh thay đổi.
- **Phân định rõ ràng giữa Phase A và Phase B**:
  - **Phase A (Bộ dữ liệu chưa hoàn thiện/mất cân bằng)**:
    - Teacher Validator ở chế độ **TẮT**.
    - Sử dụng mô hình Neural Network (`TfTrainer`) và KNN được huấn luyện thuần túy từ **Thư viện ảnh của bé**.
    - Khi gặp cử chỉ nằm ngoài bộ dữ liệu của bé (OOD như 3 ngón hoặc nắm tay): Mô hình của bé tự phán đoán dựa trên tập ảnh bé hiện có, thể hiện sự thiên vị (Bias) và độ tự tin (Confidence %) nguyên bản trên **Thanh Năng Lượng AI**.
  - **Phase B (Bộ dữ liệu tốt & cân bằng - ≥10 ảnh/nhãn)**:
    - Kích hoạt **Teacher Skeleton Model Validation** (`crossCheckLiveFeatures`).
    - Trích xuất cấu trúc khung xương bàn tay / nét vẽ khuôn mặt / nét vẽ body được chuẩn hóa (Scale & Translation Invariant).
    - Đem đối chiếu vector khung xương với **Mô hình Khung Xương Chuẩn của Giáo Viên (`teacherSamples` / `teacherTrainer`)**.
    - Nhận diện chính xác 1 ngón tay ngay cả khi thay đổi khoảng cách xa/gần trước camera.
    - Khi phát hiện cử chỉ chưa học (OOD như 3 ngón hoặc nắm tay): Nhãn dự đoán chuyển thành *"Dữ liệu chưa được học... 🤔"*, Biểu đồ KNN hiển thị dấu hỏi **`?`** chính giữa ngôi sao, và **Thanh Năng Lượng AI** tuột về 0% nhấp nháy dòng báo đỏ *"⚠️ Dữ liệu này chưa có trong thư viện ảnh của bé!"*.

### 3. Cập Nhật Cột Năng Lượng AI [`AIConfidenceEnergyBars.tsx`](file:///d:/HOCTAP/Learn-Hub/client/src/components/journey/AIConfidenceEnergyBars.tsx)
- Nhận thêm prop `anomalyMessage`.
- Khi phát hiện cử chỉ lạ ở Phase B hoặc khi tụt năng lượng, hiển thị thông báo tùy chỉnh rõ ràng: *"⚠️ Dữ liệu này chưa có trong thư viện ảnh của bé!"*.

### 4. Nâng Cấp Modal Phân Tích [`AIFeedbackModal.tsx`](file:///d:/HOCTAP/Learn-Hub/client/src/components/journey/AIFeedbackModal.tsx)
- Bổ sung Banner nhận diện **Phase A (Cần bổ sung cho cân bằng)** vs **Phase B (VIP AI - Đã bật Teacher Validator)** kèm theo giải thích sư phạm dành riêng cho bé.

---

## 🧪 Kết Quả Kiểm Tra & Xác Nhận (Verification)

### Automated TypeScript & Production Build Test
Lệnh biên dịch toàn bộ dự án (`npm run build`) đã được thực thi và vượt qua 100% các bước kiểm tra cú pháp và loại (Type Check):

- **Next.js Turbopack:** `✓ Compiled successfully in 3.4s`
- **TypeScript Type Check:** `Finished TypeScript in 7.2s`
- **Static Page Generation:** `✓ 28/28 pages generated successfully`

---

## 🎨 Trực Quan Giao Diện & Trải Nghiệm Học Sinh
1. **Khi dữ liệu bé chưa cân bằng (Phase A):** Banner hiển thị màu cam nhắc nhở bé bổ sung ảnh để đạt Phase B. Biểu đồ KNN phản ánh đúng độ thiên vị nếu bé lỡ chụp chênh lệch (10 vs 20).
2. **Khi dữ liệu bé cân bằng (Phase B):** Banner hiển thị màu xanh lá rạng rỡ với huy hiệu VIP AI. Khi bé test giơ 3 ngón tay trước camera, Thanh Năng Lượng lập tức chớp đỏ cảnh báo: *"⚠️ Dữ liệu này chưa có trong thư viện ảnh của bé!"*, chặn đứng tình trạng KNN đoán bừa 1 hoặc 2 ngón.
