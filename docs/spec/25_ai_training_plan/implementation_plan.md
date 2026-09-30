# Kế hoạch Đồng bộ hóa "Train Thật" cho Toàn Dự Án

Chúng ta sẽ nâng cấp toàn bộ các trang Dạy AI còn lại (`teach`, `teach-face`, `teach-gestures`) lên kiến trúc **Hybrid (Lai)**. Lần này, chúng ta sẽ khéo léo kết hợp điểm tinh túy nhất của cả 2 hệ tư tưởng:

1. **Từ "Learn-Hub" cũ (Smart Data Collection):** Giữ lại hệ thống Cảnh báo viền đỏ (Heuristic Validation & Golden Dataset). Nếu trẻ em cố tình nhét ảnh mặt "Khóc" vào nhãn mặt "Cười", AI vẫn sẽ cảnh báo "Có vẻ bạn đang chụp sai nhãn!". Đây là điểm vượt trội hoàn toàn so với Teachable Machine (vốn cho phép người dùng nhập rác bừa bãi).
2. **Từ "LearningHub" mới (Real Training):** Sử dụng `TfTrainer` (TensorFlow.js) để huấn luyện một mạng Nơ-ron thật sự trên trình duyệt từ các dữ liệu đã được thu thập ở bước 1.

## Đánh giá chi tiết các trang cần sửa

### 1. Phục hồi Validation cho `teach-two-hands`
- **Vấn đề:** Ở bước trước, mình đã xóa logic đếm ngón tay và so sánh KNN để thu thập mẫu tự do.
- **Giải pháp:** Khôi phục lại logic bắt lỗi. Vẫn đánh dấu ảnh bị lỗi (`isValid: false`) để hiện viền đỏ, nhưng VẪN ĐƯA vào `model.fit()` để tôn trọng quyền quyết định cuối cùng của trẻ em.

### 2. Trang `teach` & `teach-gestures` (Cử chỉ tay 1 bàn)
- **Thu thập dữ liệu:** Giữ nguyên logic tính `result = classifyKNN(features, mappedGolden, 3)`. Nếu sai nhãn, hiện Toast báo lỗi và set `isValid = false`.
- **Huấn luyện:** Khởi tạo `TfTrainer`, gọi `trainer.train(samples)`.
- **Dự đoán Live:** Gọi `trainer.predict(features)` để hiển thị kết quả.

### 3. Trang `teach-face` (Biểu cảm khuôn mặt)
- **Thu thập dữ liệu:** Giữ nguyên logic so sánh `isSmiling`, `isSurprised` dựa trên các Tỷ lệ vàng (Mouth Ratio, Eye Ratio). Nếu bé gắn nhãn "Cười" mà `isSmiling` là false, báo lỗi viền đỏ.
- **Huấn luyện:** Khởi tạo `TfTrainer`, train mạng Nơ-ron trên mảng `936` tọa độ khuôn mặt.
- **Dự đoán Live:** Chạy `trainer.predict(features)` để đưa ra nhãn Vui/Buồn/Ngạc Nhiên.

## Proposed Changes

#### [MODIFY] `client/src/app/(private)/teacher/training/teach-two-hands/page.tsx`
Khôi phục lại luồng Validation so sánh `GOLDEN_TEST_DATASET` trong hàm `captureSample`.

#### [MODIFY] `client/src/app/(private)/teacher/training/teach/page.tsx`
- Tích hợp `useRef(new TfTrainer())`.
- Đổi nút Train thành Async Function gọi `trainer.train()`.
- Sửa hàm `runPrediction` từ `classifyKNN` thành `trainer.predict()`.

#### [MODIFY] `client/src/app/(private)/teacher/training/teach-gestures/page.tsx`
- Tích hợp `TfTrainer`.
- Sửa đổi UI Progress Bar lúc train.
- Sửa logic Inference.

#### [MODIFY] `client/src/app/(private)/teacher/training/teach-face/page.tsx`
- Tương tự như trên, nhưng Input Shape sẽ là 936 (thay vì 42). Mạng nơ-ron hoàn toàn xử lý tốt kích thước này trong vài mili-giây.

## Verification Plan
1. Vào trang Khuôn mặt, cố tình chụp mặt buồn lưu vào nhãn "Vui". Xác nhận hệ thống vẫn báo lỗi viền đỏ ⚠️ (Giữ được ưu điểm của dự án cũ).
2. Bấm "Huấn luyện AI". Xác nhận Progress bar chạy mượt mà không treo trình duyệt (Hoạt động của TensorFlow).
3. Bật Live Camera, biểu cảm khuôn mặt. Xác nhận kết quả dự đoán (Inference) hoạt động nhạy và chính xác (Khắc phục lỗi học vẹt).
