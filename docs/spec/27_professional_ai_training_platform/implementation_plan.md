# Định Hướng Kiến Trúc & Kế Hoạch Nâng Cấp Learn-Hub: Hệ Thống AI Hybrid (Neural Network + KNN Shadow Engine)

## 1. Triết Lý Sản Phẩm (Product Vision)

Khác với các công cụ dạy AI thông thường như **Google Teachable Machine** (chỉ train mô hình Neural Network như một "hộp đen" black box, dễ bị học vẹt/overfitting khi dữ liệu ít hoặc nhiễu và không thể giải thích lý do tại sao AI đoán sai), **Learn-Hub** định hình một kiến trúc **Hybrid AI (Shadow Guardian Architecture)**:

1. **Neural Network (TF.js MLP)**: Đóng vai trò là **Bộ Não Suy Luận Chính (Primary Inference Engine)** cho tốc độ nhận diện siêu nhanh và khả năng tổng quát hóa tốt.
2. **KNN (K-Nearest Neighbors)**: Chạy **ngầm bên dưới (Shadow Engine)** đóng vai trò là "Người Giám Sát Kỹ Thuật":
   - **Phát hiện dữ liệu nhiễu (Outlier Detection)**: Khi bé chụp ảnh mới, KNN tính khoảng cách khoảng cách hình học Euclidean của các điểm Landmarks để phát hiện ngay ảnh chụp lỗi/góc nghiêng bất thường.
   - **Giải thích lỗi sai (Explainable AI / Nearest Match)**: Khi Neural Network nhầm lẫn, KNN tìm ra bức ảnh mẫu có khoảng cách gần nhất (`nearestMatchThumbnail`) để giải thích trực quan cho bé ("Ảnh này giống nhãn X bé chụp trước đó hơn!").
   - **Cảnh báo lệch dữ liệu (Data Imbalance Guard)**: Ngầm tính toán tỷ lệ phân bổ mẫu giữa các nhãn để cảnh báo viền đỏ ⚠️ nhẹ nhàng.
3. **UX Trẻ Em (Kids-Friendly & Zero-Complexity UX)**:
   - **Không làm phức tạp giao diện**: Giấu hoàn toàn các thuật ngữ toán học/kỹ thuật như Epochs, Learning Rate, Batch Size, KNN vs MLP.
   - **Auto-Tuning Hyperparameters ngầm**: Hệ thống tự động tính toán siêu tham số tối ưu (số epoch, learning rate) dựa trên dung lượng dataset bé thu thập.

---

## 2. Kiến Trúc Kỹ Thuật (Architecture Overview)

```
                       ┌─────────────────────────┐
                       │   Bé Thu Thập Mẫu Ảnh   │
                       └────────────┬────────────┘
                                    │
                                    ▼
                     ┌──────────────────────────────┐
                     │ Extracted Landmarks Features │
                     └──────────────┬───────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌─────────────────────────────┐                  ┌──────────────────────────────┐
│ Primary Inference Engine    │                  │ Shadow Guardian Engine (KNN) │
│ (Neural Network / MLP)      │                  │ (Lưu trong RAM / Cache)      │
├─────────────────────────────┤                  ├──────────────────────────────┤
│ - Nhận diện realtime        │                  │ - Tìm Nearest Neighbor       │
│ - Tốc độ mượt mà            │                  │ - Giải thích lỗi sai         │
│ - Đưa ra Confidence Score   │                  │ - Outlier & Imbalance Check  │
└──────────────┬──────────────┘                  └──────────────┬───────────────┘
               │                                                │
               └──────────────────────┬─────────────────────────┘
                                      ▼
                        ┌───────────────────────────┐
                        │   Giao Diện Trực Quan     │
                        │   (Dành Cho Trẻ Em)       │
                        └───────────────────────────┘
```

---

## 3. Lộ Trình Triển Khai Chi Tiết (Implementation Plan)

### Phase 1: Hoàn Thiện Hybrid AI Engine Ngầm (Shadow Pipeline)
- **Tích hợp KNN Shadow vào Neural Network**: Khi gọi `NeuralNetworkClassifierAdapter.predict()`, đồng thời chạy ngầm `classifyKNNDetailed()` ở background thread/tidy block để lấy `nearestMatch`.
- **Auto Hyperparameter Tuning**: Xây dựng helper `calculateAutoHyperparameters(sampleCount)` tự động chọn `epochs` (vd: < 20 mẫu ➔ 30 epochs; > 50 mẫu ➔ 50 epochs) và `learningRate` phù hợp mà không cần trẻ em phải cấu hình.
- **Backend Model Artifacts Storage**: Tiếp tục hoàn thiện lưu trữ file weights (`model.json` + `weights.bin`) và `trainingLogs` ở backend NestJS khi bé bấm "Lưu mô hình".

### Phase 2: Nâng Cấp AI Feedback & Red-Border Warnings (Kids UX)
- **Cảnh báo trực quan (Visual Feedback)**: Hiển thị viền đỏ ⚠️ hoặc icon cảnh báo khi KNN phát hiện ảnh chụp bị out-of-distribution (khác xa tập huấn luyện) hoặc dữ liệu nhãn bị lệch quá 2x.
- **AI Companion Popup**: Khi AI đoán sai hoặc bé thắc mắc, hiển thị modal so sánh ảnh chụp hiện tại với ảnh `nearestMatch` do KNN tìm được một cách thân thiện.

### Phase 3: Server-side Model Archiving & Teacher Analytics
- Giáo viên có thể vào Dashboard để xem báo cáo chẩn đoán dữ liệu (Cross-validation accuracy, Confusion Matrix, Imbalance Report) do KNN shadow engine tổng hợp từ phía server.
- Lưu trữ các phiên bản mô hình của học sinh lên PostgreSQL để đánh giá tiến trình học tập.

---

## 4. Xác Nhận Kế Hoạch

- **Không tạo giao diện chỉnh tham số phức tạp cho bé**.
- **KNN chạy hoàn toàn ngầm để hỗ trợ và khắc phục điểm yếu của Neural Network**.
- **Giữ giao diện tinh gọn, tập trung vào tương tác camera vui nhộn**.
