# Kế hoạch Tích hợp AI (TfTrainer) cho Dashboard Giáo Viên & Trang Challenge

Đúng như bạn nói, để tạo ra một luồng trải nghiệm đồng nhất, việc trang bị mạng Neural Network (TensorFlow.js) cho trang học sinh là chưa đủ. Chúng ta cần nâng cấp cả phần giao diện của Giáo viên và các trang Trò chơi (Challenges) để phản ánh đúng công nghệ này.

Tuy nhiên, bảng điều khiển của giáo viên (`TeachPanel`, `BodyTeachPanel`) lại có các tính năng đặc thù dùng thuật toán KNN rất hay như: phân tích từng bức ảnh xem nó có bị lỗi gán nhãn sai không và **hiển thị ảnh gần giống nhất (Nearest Match)** để giải thích lý do.

## Đề xuất Giải pháp "Hybrid" Đỉnh Cao cho Teacher Dashboard
Chúng ta sẽ tiếp tục áp dụng triết lý "Tích hợp thông minh":
1. **Live Camera Prediction (Dự đoán thực tế):** Chuyển từ KNN sang `TfTrainer`. Giáo viên sẽ có 1 nút "Huấn luyện AI Model" ẩn/hiện, và khi xem qua Camera, họ sẽ thấy chính xác kết quả dự đoán từ mạng Nơ-ron giống như những gì học sinh sẽ thấy.
2. **Dataset Diagnosis (Chẩn đoán bộ dữ liệu):** VẪN GIỮ nguyên `classifyKNNDetailed` để tính toán Cross-Validation. Điều này là vì mạng Nơ-ron chỉ xuất ra tỷ lệ % (confidence), còn KNN mới có thể chỉ ra chính xác bức ảnh nào trong hàng ngàn ảnh khiến AI bị nhầm lẫn (Nearest Neighbor). Đây là một công cụ quá tuyệt vời cho giáo viên và không nên bỏ.

**Kết luận được phê duyệt (Phương án 1): Nâng cấp một nửa (Khuyên dùng)**
- Dùng `TfTrainer` (Mạng Nơ-ron) làm thuật toán chính để train và đưa ra kết quả cuối cùng (Predicted Label).
- Chạy ngầm thuật toán KNN song song chỉ để tìm ra bức ảnh `nearestMatchThumbnail` phục vụ cho giao diện giải thích lỗi sai (AI Feedback Modal).
- Ưu điểm: Vừa có mô hình thông minh, vừa không làm vỡ giao diện sư phạm.
## Proposed Changes

### 1. `client/src/components/journey/TeachPanel.tsx` & `BodyTeachPanel.tsx`
- Tích hợp `useRef<TfTrainer>`.
- Chỉnh sửa luồng `useEffect` của Prediction Loop: Thay vì dùng `classifyKNNWithVotes`, gọi `trainerRef.current.predict()`.
- Thêm logic: Mỗi khi giáo viên sửa đổi bộ dataset (Thêm/Xóa ảnh), tự động gọi hàm `train()` ở chế độ nền (hoặc hiển thị nút Train) để cập nhật mô hình Nơ-ron mới nhất.

### 2. Trang Trò Chơi (`client/src/app/(private)/challenge/body-exercise/page.tsx`)
- Trang này hiện đang lấy mảng tọa độ Cơ thể (Body Landmarks) và dùng `classifyKNN` từng frame.
- **Thay đổi:** Khởi tạo `TfTrainer`, gọi `await trainer.train(samples)` ngay khi game vừa load xong.
- Cập nhật vòng lặp `requestAnimationFrame` để gọi `await trainer.predict(features)` siêu mượt.

## Open Questions
> [!WARNING]
> Tại trang **Giáo viên**, khi giáo viên thêm/xóa ảnh liên tục, nếu chúng ta train model tự động (Auto-train) sau mỗi thao tác thì có thể gây delay (khoảng 1-2 giây để TFJS chạy 50 epochs). 
> Bạn muốn: 
> 1) Auto-train ngầm (có thể hơi giật nhẹ).
> 2) Hiện 1 nút "Re-train Model" để giáo viên chủ động bấm trước khi test Camera? (Khuyên dùng để tối ưu hiệu suất).

Bạn cho mình xin ý kiến về câu hỏi trên rồi mình sẽ tiến hành triển khai nhé!
