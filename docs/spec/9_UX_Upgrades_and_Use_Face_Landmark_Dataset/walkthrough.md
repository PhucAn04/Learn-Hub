# Nâng cấp Trải nghiệm "Dạy AI" (UX Upgrades)

Quá trình nâng cấp tính năng thu thập dữ liệu và đánh giá AI trên các trang `teach`, `teach-face` và `teach-gestures` đã hoàn tất thành công. Build của ứng dụng hoàn toàn không có lỗi (18/18 static pages prerendered).

## Các thay đổi chính đã thực hiện

### 1. Cơ chế Chụp liên tục (Hold-to-Capture) 📸
- Thay vì click chuột thủ công từng lần để thu thập mỗi ảnh, giờ đây bé chỉ cần **nhấn giữ nút** "GIỮ ĐỂ CHỤP" trên tất cả các trang dạy học.
- Hệ thống sẽ tự động chụp một bức ảnh mỗi `300ms` (3 ảnh mỗi giây) và có hiệu ứng chớp tắt (pulse) cảnh báo trạng thái đang thu thập mẫu.
- Cơ chế này giúp thu thập các biến thể siêu tinh tế khi bé cử động đầu hoặc thay đổi góc tay rất tự nhiên, mà không làm bé mỏi tay.

### 2. Thư viện Ảnh & Xem trước (Thumbnail Gallery) 🖼️
- Mỗi khi chụp, một bức ảnh preview 240×240px (JPEG 80%) sẽ được lưu lại.
- Tích hợp component `SampleGallery` ngay dưới nút chụp để bé thấy trực quan những gì mình vừa chụp trên tất cả các trang.
- Bé có thể cuộn danh sách, hover để xem, hoặc **Click vào ảnh** để mở Modal phóng to ảnh và navigate qua lại.
- Ảnh bị đánh dấu sai nhãn có **viền đỏ dày** (`border-4 border-red-500`) + **ring đỏ** + icon ⚠️ nhấp nháy.
- Banner cảnh báo đỏ hiện lên khi có ảnh nghi sai, kèm hướng dẫn bé xóa và chụp lại.
- Component có sẵn nút "Xóa hết" và xóa từng ảnh.

### 3. Expression-Ratio-Based Validation (Face) 🧠

> **Bài học quan trọng**: Phương pháp ban đầu dùng Euclidean distance trên 468 face landmarks (936 features) đã **THẤT BẠI** vì face landmarks phản ánh **hình dáng khuôn mặt** (skull shape) đến 90%+ — chỉ ~10% là biểu cảm. Hai người khác nhau với cùng biểu cảm sẽ có khoảng cách rất lớn, trong khi cùng một người với 2 biểu cảm khác nhau lại có khoảng cách rất nhỏ.

**Giải pháp**: Trích xuất **5 chỉ số hình học** (Expression Ratios) đã chuẩn hóa theo kích thước khuôn mặt, hoàn toàn bất biến với hình dáng mặt:

| Chỉ số | Ý nghĩa | Dùng nhận diện |
|---|---|---|
| **MAR** | Miệng há to cỡ nào | Ngạc nhiên (cao), Bình thường (thấp) |
| **Smile Ratio** | Miệng rộng so với mặt | Vui vẻ (cao), Buồn bã (thấp) |
| **Corner Lift** | Khóe miệng lên/xuống | Vui vẻ (+), Buồn bã (-) |
| **EAR** | Mắt mở to cỡ nào | Ngạc nhiên (cao) |
| **Brow Height** | Lông mày nhướn cỡ nào | Ngạc nhiên (cao) |

**Logic nhận diện (`detectExpression`) — thứ tự ưu tiên quan trọng:**

```
1. Ngạc nhiên 😲: MAR > 0.22 VÀ smileRatio < 0.38
   → Miệng chữ O, không bè ngang. Kiểm tra TRƯỚC Happy vì khi há miệng,
     hàm dưới hạ khiến cornerLift tăng giả → dễ nhầm thành cười.

2. Vui vẻ 😀: smileRatio > 0.40 HOẶC (cornerLift > 0.015 VÀ MAR < 0.2)
   → Cười rộng miệng, hoặc nhếch khóe miệng (nhưng chỉ khi miệng đang khép).

3. Bình thường 😐: smileRatio >= 0.34 VÀ cornerLift >= -0.002
   → Kiểm tra TRƯỚC Buồn bã (reverse logic). Miệng thả lỏng tự nhiên,
     khóe không trễ xuống.

4. Buồn bã 😢: fallback
   → Mọi thứ còn lại: miệng chụm hẹp (smileRatio < 0.34) HOẶC
     khóe môi hơi trễ xuống (cornerLift < -0.002).
```

**Validation (`validateExpression`) — 100% đồng bộ với Detection:**
- Gọi `detectExpression()` rồi so trực tiếp: `if (detected !== 'Vui vẻ 😀')` → invalid.
- Đảm bảo không bao giờ xảy ra tình huống Live Indicator hiện "Bình thường" nhưng ảnh vẫn pass validation cho nhãn "Vui vẻ".

### 4. Live Expression Indicator 🔍
- Panel hiển thị real-time ngay dưới camera khi đang ở chế độ thu thập (không hiện khi đã train):
  - **Bên trái**: `🔍 AI đang thấy biểu cảm: [Vui vẻ 😀]`
  - **Bên phải**: `Nhãn đang chọn: [Buồn bã (Sad) 😢]`
- Cập nhật mỗi frame trong canvas drawing loop (từ face đầu tiên phát hiện được).
- Giúp bé biết trước khi chụp rằng biểu cảm đã đúng chưa, tránh chụp thừa ảnh sai.

### 5. Toast Cảnh báo Khi Chụp Sai 🚨
- Khi ảnh bị đánh dấu invalid, hiện toast đỏ 4 giây với feedback cụ thể kèm biểu cảm AI phát hiện:
  > 🚨 Bé chưa cười đủ tươi! AI thấy bé đang "Bình thường 😐". Cười thật tươi lên nhé! 😀

### 6. Golden Dataset Validation (Gestures & Ngón tay) ✋
- Trang Gestures và Ngón tay (`/challenge/teach` và `/challenge/teach-gestures`) vẫn dùng **Euclidean distance** trên hand landmarks (21 keypoints × 2 = 42 features).
- Trang `teach` dùng thêm heuristic đếm số ngón tay trực tiếp (`getExpectedFingerCount`) để kiểm tra nếu bé giơ sai số ngón.
- So sánh với Golden Dataset tương ứng. Nếu khoảng cách tới class SAI < 85% khoảng cách tới class ĐÚNG → invalid.
- Khác với Face vì hand landmarks thể hiện cử chỉ chính xác hơn (ít bị ảnh hưởng bởi hình dáng bàn tay).

### 7. Emotion Landmark Dataset cho Scoring 📊
- Trích xuất 60 mẫu normalized từ Kaggle dataset 15.5GB (`emotion_landmark_dataset.csv`).
- 10 mẫu × 6 class (Happy, Sad, Fear, Neutral, Angry, Disgust).
- Xử lý bằng Python streaming script (memory-efficient, `buffering=65536`).
- Lưu tại `client/src/lib/emotion-landmark-dataset.ts`.
- **Chỉ dùng cho scoring** khi nộp bài (LOOCV evaluation) — KHÔNG dùng cho validation khi chụp.

## Các files đã thay đổi

| File | Thay đổi |
|---|---|
| [knn-classifier.ts](file:///D:/HOCTAP/Learn-Hub/client/src/lib/knn-classifier.ts) | Thêm `thumbnail`, `isValid` vào `StoredSample` |
| [SampleGallery.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/SampleGallery.tsx) | Component mới — gallery + preview modal |
| [emotion-landmark-dataset.ts](file:///D:/HOCTAP/Learn-Hub/client/src/lib/emotion-landmark-dataset.ts) | 60 golden samples cho scoring |
| [teach-face/page.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/app/(private)/challenge/teach-face/page.tsx) | Hold-to-capture, Expression Ratios, Live Indicator, Validation |
| [teach-gestures/page.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/app/(private)/challenge/teach-gestures/page.tsx) | Hold-to-capture, Golden Dataset validation, SampleGallery |
| [teach/page.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/app/(private)/challenge/teach/page.tsx) | Hold-to-capture, Finger counting validation, SampleGallery |

## Kết quả kiểm thử (Verification)
- ✅ Cấu trúc dữ liệu `StoredSample` đã được migrate với tính tương thích ngược (thumbnail/isValid là optional).
- ✅ Script TypeScript và Build Next.js biên dịch hoàn chỉnh (18/18 pages, 0 lỗi).
- ✅ Expression Ratio validation hoạt động ngay từ ảnh đầu tiên (không cần đủ mẫu).
- ✅ Live Indicator và Validation 100% đồng bộ (không mâu thuẫn).

## Các vấn đề đã giải quyết trong quá trình phát triển

### Vấn đề 1: Face Shape vs Expression
- **Triệu chứng**: Euclidean distance trên raw landmarks luôn báo sai dù biểu cảm đúng.
- **Nguyên nhân**: 90%+ variance nằm ở hình dáng mặt, không phải biểu cảm.
- **Giải pháp**: Chuyển sang Expression Ratios (shape-invariant).

### Vấn đề 2: Ngạc nhiên bị nhầm thành Vui vẻ
- **Triệu chứng**: Há hốc miệng nhưng AI báo "Vui vẻ".
- **Nguyên nhân**: Khi hàm dưới hạ, phép tính `cornerLift` tự nhiên tăng cao (khóe miệng "nâng" tương đối).
- **Giải pháp**: Kiểm tra Surprised trước Happy; giới hạn cornerLift-based Happy chỉ khi `MAR < 0.2`.

### Vấn đề 3: Buồn bã không trigger được
- **Triệu chứng**: Dù trề môi hay chụm miệng vẫn chỉ thấy "Bình thường".
- **Nguyên nhân**: Ngưỡng Sad quá chặt hoặc dùng `&&` (AND) cần cả 2 điều kiện.
- **Giải pháp**: Reverse logic — xác nhận "Bình thường" trước (cần cả smileRatio >= 0.34 VÀ cornerLift >= -0.002), phần còn lại tự fallback thành "Buồn bã".

### Vấn đề 4: Live Indicator và Validation không khớp
- **Triệu chứng**: Camera hiện "Bình thường" nhưng chụp vào vẫn pass validation cho nhãn "Vui vẻ".
- **Nguyên nhân**: `detectExpression` và `validateExpression` dùng 2 bộ ngưỡng riêng biệt.
- **Giải pháp**: `validateExpression` gọi `detectExpression()` rồi so trực tiếp kết quả.

## Mở rộng tương lai (Đề xuất)
- Có thể áp dụng component SampleGallery và Hold-to-capture cho các phần Challenge sau này để tạo luồng học tập đồng bộ.
- Có thể thêm **debug mode** hiển thị giá trị 5 ratios real-time trên camera để hỗ trợ tinh chỉnh ngưỡng trên các thiết bị khác nhau.
