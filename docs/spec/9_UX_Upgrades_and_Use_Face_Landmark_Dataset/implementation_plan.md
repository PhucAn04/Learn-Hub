# Nâng cấp UX: Giữ-để-chụp, Thư viện ảnh & Xác nhận nhãn bằng AI

## Bối cảnh

Hiện tại, các trang dạy AI (`teach`, `teach-face` và `teach-gestures`) trong `D:\HOCTAP\Learn-Hub\client` chỉ hỗ trợ **click từng lần** để chụp mẫu, không có thumbnail preview, và không kiểm tra xem ảnh bé chụp có khớp với nhãn đã chọn hay không.

Tham khảo từ `D:\HOCTAP\Learn-Hub\frontend` (WizardWorkspace.tsx), hệ thống đã có sẵn pattern:
- **Hold-to-capture** (`onMouseDown` → `setInterval(captureFrame, 120ms)` → `onMouseUp` → `clearInterval`)
- **Thumbnail gallery** (mỗi sample lưu kèm `thumbnail: string` dạng base64 dataURL, hiển thị dưới dạng grid 14×14px có thể xóa từng ảnh)

## Mục tiêu

1. **Giữ để chụp (Hold-to-capture)**: Bé nhấn giữ nút → tự động chụp liên tục mỗi ~300ms → thả ra thì dừng
2. **Thư viện ảnh thu thập (Thumbnail Gallery)**: Hiển thị thumbnail nhỏ cho mỗi mẫu đã chụp, bé có thể click xem ảnh lớn hơn hoặc xóa từng ảnh
3. **Xác nhận nhãn bằng AI (Label Validation)**: Áp dụng Golden Dataset Validation (cho cử chỉ/ngón tay) và Expression-Ratio-Based Validation (cho khuôn mặt) để kiểm tra biểu cảm ngay lập tức, không cần đủ mẫu trước.
4. **Live Expression Indicator**: Hiển thị real-time biểu cảm AI đang nhận diện ngay dưới camera đối với bài toán nhận diện khuôn mặt.

---

## Proposed Changes

### Component chung (Shared)

#### [MODIFY] [knn-classifier.ts](file:///D:/HOCTAP/Learn-Hub/client/src/lib/knn-classifier.ts)
- Thêm trường `thumbnail?: string` vào `StoredSample` interface để lưu ảnh thu nhỏ base64
- Thêm trường `isValid?: boolean` để đánh dấu mẫu có qua validation hay không

---

#### [NEW] [SampleGallery.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/SampleGallery.tsx)
Component tái sử dụng cho các trang `teach`, `teach-face`, `teach-gestures`:
- **Props**: `samples`, `onDeleteSample`, `onClearAll`
- **UI**: Grid thumbnail 64×64px, flex-wrap
- Mỗi thumbnail:
  - Hover → hiện overlay Eye icon
  - Click → mở modal preview ảnh lớn (có thể navigate qua lại)
  - Nếu `isValid === false` → **viền đỏ dày (`border-4 border-red-500`)** + **ring đỏ** + badge ⚠️ nhấp nháy (animate-pulse)
- Banner cảnh báo màu đỏ khi có ảnh sai nhãn, hiển thị số lượng ảnh nghi sai
- Nút "Xóa hết" ở header gallery

---

#### [NEW] [emotion-landmark-dataset.ts](file:///D:/HOCTAP/Learn-Hub/client/src/lib/emotion-landmark-dataset.ts)
- Chứa 60 mẫu landmark đã normalize (10 mẫu × 6 class: Happy, Sad, Fear, Neutral, Angry, Disgust)
- Trích xuất từ dataset Kaggle 15.5GB (`emotion_landmark_dataset.csv`) bằng Python streaming script
- Dùng cho **scoring** (chấm điểm khi nộp bài) — KHÔNG dùng cho validation khi chụp

---

### Trang Teach Face

#### [MODIFY] [teach-face/page.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/app/(private)/challenge/teach-face/page.tsx)

**1. Capture thumbnail khi chụp mẫu:**
- Trong `captureSample()`, tạo thumbnail 240×240px, chất lượng 80% JPEG:
  ```ts
  const canvas = document.createElement('canvas');
  canvas.width = 240; canvas.height = 240;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoRef.current, 0, 0, 240, 240);
  const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
  ```

**2. Hold-to-capture thay vì click:**
- Nút "GIỮ ĐỂ CHỤP 📸" với:
  ```tsx
  onMouseDown → startCapturing()  // setInterval(captureSample, 300)
  onMouseUp → stopCapturing()     // clearInterval
  onMouseLeave → stopCapturing()
  onTouchStart → startCapturing()
  onTouchEnd → stopCapturing()
  ```
- Khi đang giữ: nút chuyển đỏ + animation pulse + text "ĐANG THU MẪU..."

**3. Expression-Ratio-Based Validation (thay KNN):**

> [!IMPORTANT]
> Validation biểu cảm **KHÔNG dùng KNN hay Euclidean distance** vì face landmarks phản ánh **hình dáng mặt** (skull shape) nhiều hơn **biểu cảm** (expression). Thay vào đó, dùng 5 chỉ số hình học (Expression Ratios) được chuẩn hóa theo kích thước khuôn mặt.

**5 Expression Ratios:**

| Chỉ số | Ý nghĩa | Công thức |
|---|---|---|
| **MAR** (Mouth Aspect Ratio) | Miệng há to cỡ nào | `mouthOpen / mouthWidth` |
| **Smile Ratio** | Miệng rộng cỡ nào so với mặt | `mouthWidth / faceWidth` |
| **Corner Lift** | Khóe miệng lên hay xuống | `(mouthCenterY - cornerAvgY) / faceHeight` |
| **EAR** (Eye Aspect Ratio) | Mắt mở to cỡ nào | `eyeHeight / eyeWidth` |
| **Brow Height** | Lông mày nhướn cỡ nào | `browToEyeDistance / faceHeight` |

**Logic nhận diện biểu cảm (`detectExpression`):**

```
1. Ngạc nhiên 😲: MAR > 0.22 VÀ smileRatio < 0.38 (miệng chữ O, không bè ngang)
2. Vui vẻ 😀: smileRatio > 0.40 HOẶC (cornerLift > 0.015 VÀ MAR < 0.2) (cười rộng hoặc nhếch khóe)
3. Bình thường 😐: smileRatio >= 0.34 VÀ cornerLift >= -0.002 (miệng thả lỏng, không trễ)
4. Buồn bã 😢: fallback — miệng chụm hẹp HOẶC khóe môi trễ xuống
```

**Validation flow (`validateExpression`):**
- Gọi `detectExpression()` để lấy biểu cảm AI đang thấy
- So sánh trực tiếp với nhãn bé đã chọn: `if (detected !== 'Vui vẻ 😀')` → `isValid: false`
- **100% đồng bộ** giữa Live Indicator và Validation — không bao giờ xảy ra mâu thuẫn

**4. Live Expression Indicator:**
- Hiển thị real-time dưới camera khi đang ở chế độ thu thập:
  - Bên trái: `🔍 AI đang thấy biểu cảm: [Vui vẻ 😀]`
  - Bên phải: `Nhãn đang chọn: [Buồn bã (Sad) 😢]`
- Cập nhật mỗi frame trong canvas drawing loop
- Giúp bé biết trước khi chụp rằng biểu cảm đã đúng chưa

**5. Toast cảnh báo khi chụp sai:**
- Hiện toast đỏ 4 giây với feedback cụ thể:
  > 🚨 Bé chưa cười đủ tươi! AI thấy bé đang "Bình thường 😐". Cười thật tươi lên nhé! 😀

---

### Trang Teach Gestures và Teach (Ngón tay)

#### [MODIFY] [teach-gestures/page.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/app/(private)/challenge/teach-gestures/page.tsx)
#### [MODIFY] [teach/page.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/app/(private)/challenge/teach/page.tsx)

Áp dụng Hold-to-capture, Thumbnail Gallery, SampleGallery component.

**Validation dùng Golden Dataset (khác với Face):**
- Gestures & Ngón tay vẫn dùng **Euclidean distance trên hand landmarks** (21 keypoints × 2 = 42 features)
- So sánh với Golden Gestures Dataset (import từ `@/lib/golden-gestures`) hoặc Golden Finger Dataset.
- Trang ngón tay kết hợp thêm **Finger counting heuristic** (đếm số ngón giơ lên).
- Logic: Nếu khoảng cách tới class SAI < 85% khoảng cách tới class ĐÚNG → `isValid: false`
- Trang `teach` còn kiểm tra thêm số lượng ngón tay thực tế, nếu sai lệch sẽ cảnh báo.

---

## Verification Plan

### Automated Tests
- `npm run build` — đảm bảo TypeScript biên dịch thành công (18/18 pages)

### Manual Verification
1. Mở trang `/challenge/teach-face`, `/challenge/teach-gestures`, `/challenge/teach`:
   - Nhấn giữ nút "GIỮ ĐỂ CHỤP" → ảnh chụp liên tục, thumbnail xuất hiện
   - Thả nút → dừng chụp
   - Xem Live Indicator cập nhật real-time (trên trang teach-face)
   - Chụp sai nhãn → toast cảnh báo 🚨 + viền đỏ trên ảnh
   - Click thumbnail → modal preview hiện lên, có thể navigate qua lại
2. Nộp bài → scoring vẫn hoạt động đúng
