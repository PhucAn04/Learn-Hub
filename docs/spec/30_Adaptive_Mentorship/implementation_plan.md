# Kế Hoạch Nâng Cấp Hệ Thống Đánh Giá & Kiểm Tra Chéo (Teacher-Student Model Cross-check)

Hệ thống hiện tại đang gặp một thách thức phổ biến trong Machine Learning, đặc biệt là với thuật toán KNN: **Hạn chế với dữ liệu Out-of-Distribution (OOD)**.
- **Biểu đồ KNN (Student):** Luôn tìm kiếm "hàng xóm gần nhất" (Nearest Neighbors) bất kể khoảng cách thực tế là bao xa. Khi bé đưa 3 ngón tay (dữ liệu không có trong tập huấn luyện), KNN vẫn ép nó vào nhãn 1 hoặc 2 ngón tay vì đó là những nhãn duy nhất nó biết.
- **Thanh Năng Lượng AI (Neural Network / Threshold-based):** Có khả năng nhận biết "không đủ tự tin" hoặc "chưa có dữ liệu" rất tốt, nhưng lại thiếu khả năng giải thích cụ thể cho bé biết *tại sao* và *cần làm gì*.

Để giải quyết triệt để và kết hợp ưu điểm của cả hai, tôi đề xuất một kế hoạch kiến trúc **"Oracle Cross-checking" (Kiểm tra chéo với mô hình Oracle của Giáo Viên)** như sau:

## User Review Required

> [!IMPORTANT]
> Kế hoạch này yêu cầu cập nhật cơ chế phân tích (inference loop) theo thời gian thực (real-time) trên trình duyệt. Việc chạy song song 2 mô hình (của Bé và của Cô) sẽ tốn thêm tài nguyên xử lý. Cần đảm bảo thiết bị (đặc biệt là iPad/Tablet của học sinh) xử lý mượt mà. Chúng ta có thể tối ưu bằng cách chỉ chạy mô hình của Cô mỗi 5-10 khung hình (frames) hoặc khi mô hình của Bé có độ tự tin thấp/có sự nhảy nhót bất thường.

## Lợi Ích Của Giải Pháp
1. **Phát hiện "Bé thiếu góc độ":** Khi bé đưa 1 ngón tay lòng bàn tay hướng vào mặt (chưa chụp) -> AI Bé đoán sai / không nhận ra -> AI Cô nhận ra (vì Cô đã chụp đủ góc) -> Báo cho bé: *"Tư thế này đúng là 1 ngón tay, nhưng bé chưa chụp góc này. Hãy chụp thêm nhé!"*
2. **Phát hiện "Bé đưa sai yêu cầu" (OOD):** Khi bé đưa 3 ngón tay -> AI Bé đoán nhầm là 2 ngón tay -> AI Cô (có dataset đa dạng hơn hoặc có class 'unknown') phát hiện ra đây KHÔNG phải 1 hay 2 ngón tay -> Báo cho bé: *"Hình như bé đang đưa 3 ngón tay? Bé chỉ cần chụp 1 hoặc 2 ngón thôi nhé!"*
3. **Giữ nguyên UX cho Giáo Viên:** Giáo viên không phải thao tác phức tạp thêm, mọi thứ tự động train ngầm.

## Proposed Changes

Dựa trên phân tích chuyên sâu về tính giáo dục và hiệu năng, chúng ta sẽ áp dụng chiến lược **"Adaptive Mentorship" (Người hướng dẫn thích ứng)**:

### 1. Teacher Component: Huấn luyện ngầm (Silent Training)
- Bổ sung logic tại các trang `teach-*`: Khi giáo viên lưu template, hệ thống đóng gói toàn bộ `samples` đa dạng thành một "Golden Dataset" hoặc `TfTrainer` model lưu vào `teacherTemplate`. Giáo viên không thấy bất kỳ thay đổi nào về giao diện.

### 2. Validation Trigger: Kiểm tra chất lượng dữ liệu của Bé
Hệ thống sẽ phân loại bộ dữ liệu của bé ngay khi bé bấm "Dạy bạn AI học":
- Sử dụng hàm `evaluateStudentDatasetPhase` (kiểm tra chất lượng không mờ/tối, không sai nhãn).
- **Phase A (Dữ liệu cơ bản nhưng chưa hoàn thiện):** Bé đã chụp đủ số lượng tối thiểu (**>= 3 ảnh/nhãn**), không sai nhãn và không mờ tối, NHƯNG chưa đạt đủ 10 ảnh/nhãn hoặc dữ liệu **chưa cân bằng**, hệ thống gán cờ `isDatasetPerfect = false`.
- **Phase B (Dữ liệu tốt & Cân bằng):** Bé đã thỏa mãn Phase A VÀ đạt **ít nhất 10 ảnh cho mỗi nhãn (>= 10 ảnh/nhãn)** cùng với sự cân bằng số lượng giữa các nhãn, hệ thống gán cờ `isDatasetPerfect = true` để kích hoạt Teacher Validator. Mặc dù ở Phase B dữ liệu có thể vẫn còn đôi chút mất cân bằng nhẹ, Biểu đồ KNN và Thanh năng lượng vẫn sẽ gọi logic `analyzeDataBalance` hiện có để cảnh báo trên UI.

### 3. Adaptive Live Cross-Check: Logic Test Thích Ứng
Tại màn hình Live Test (nơi hiển thị Biểu đồ KNN và Thanh năng lượng):
- **Hiển thị chính:** Biểu đồ KNN luôn hiển thị các điểm dữ liệu của chính Bé.
- **Khi `isDatasetPerfect === false`:** TẮT hoàn toàn mô hình Giáo Viên. Bé sẽ tự trải nghiệm hậu quả của việc lười thu thập dữ liệu (AI đoán sai lung tung).
- **Khi `isDatasetPerfect === true`:** Kích hoạt **Teacher Validator**. 
  - Mô hình của Giáo Viên sẽ chạy ngầm dưới nền (chạy tĩnh/throttled).
  - Nếu mô hình Giáo Viên phát hiện bé đưa "3 ngón tay" (dữ liệu nằm ngoài thư viện ảnh của bé - OOD) trong khi Student Model của bé đoán bừa là "1 ngón" hoặc "2 ngón", Teacher Validator sẽ **chặn kết quả lại**.
  - Thanh năng lượng AI và UI sẽ chớp cảnh báo: *"Dữ liệu chưa được học! Hình như bé đang đưa 3 ngón tay?"*. 
  - Cách này giúp tăng độ chính xác tuyệt đối, vá lỗi OOD của KNN, nhưng vẫn giữ nguyên cảm giác "Thành tựu cá nhân" trên biểu đồ của bé.

### 4. Nâng cấp AIFeedbackModal
- Bổ sung UI để báo cho bé biết trạng thái dataset của bé (đang ở Phase A hay Phase B) để tạo động lực cho bé ráng thu thập dữ liệu hoàn hảo để "kích hoạt sức mạnh ẩn" của AI.

## Verification Plan

### Automated Tests
- Tạo script giả lập truyền vào `liveFeatures` của "3 ngón tay" và kiểm tra xem hàm so sánh giữa `teacherResult` và `studentResult` có văng ra đúng thông báo cảnh báo hay không.

### Manual Verification
1. Đóng vai Giáo viên: Chụp 1 ngón tay (có cả ngửa và úp lòng bàn tay). Lưu lại template.
2. Đóng vai Học sinh: Chụp 1 ngón tay (NHƯNG CHỈ ngửa lòng bàn tay). Tiến hành qua màn Test.
3. Học sinh thử đưa 1 ngón tay úp lòng bàn tay trước camera:
   -> Kiểm tra xem thanh thông báo có hiện lên: *"Bé chụp thiếu ảnh góc này rồi, bé hãy chụp thêm nhé!"* không.
4. Học sinh thử đưa 3 ngón tay trước camera:
   -> Kiểm tra xem hệ thống có nhận diện được đây là input nhiễu thông qua model của Giáo viên và nhắc nhở học sinh không.
