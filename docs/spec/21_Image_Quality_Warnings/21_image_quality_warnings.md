# Kế hoạch Triển khai 21: Cảnh Báo Chất Lượng Ảnh Real-time & Từ Chối Sớm

Xây dựng hệ thống cảnh báo chất lượng hình ảnh (mờ, tối) ngay trong lúc bé đang giơ tay/tạo dáng trước camera. Loại bỏ các khung hình kém chất lượng từ sớm để tránh làm rác dữ liệu huấn luyện AI.

---

## User Review Required

> [!IMPORTANT]
> **Triết lý cốt lõi:** Trẻ em thường có xu hướng di chuyển tay quá nhanh hoặc chơi trong phòng thiếu sáng. Thay vì thu thập dữ liệu rác rồi để AI học sai, chúng ta phải "phòng bệnh hơn chữa bệnh" bằng cách cảnh báo tức thì ngay trên màn hình.

> [!WARNING]
> Kế hoạch này sẽ **thay đổi luồng thu thập dữ liệu gốc** ([TeachPanel.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/TeachPanel.tsx)). Ảnh mờ/tối sẽ bị chặn lại và đánh dấu là ảnh lỗi chất lượng (viền vàng) thay vì ảnh sai tư thế (viền đỏ).

---

## Quyết định: Cảnh báo thời gian thực & Phân biệt Lỗi

### Tại sao lại chia ra Viền Vàng và Viền Đỏ?

Mục tiêu thật sự của giao diện dạy AI là **giúp bé hiểu tại sao ảnh của mình bị từ chối**.
- **Lỗi tư thế (Viền Đỏ):** Bé giơ sai số ngón tay, hoặc tư thế quá khác biệt so với nhãn đang học. Lúc này bé cần sửa lại tư thế.
- **Lỗi chất lượng (Viền Vàng):** Tư thế bé đúng, nhưng ảnh bị nhòe nhoẹt (do rung tay) hoặc quá tối. Bé chỉ cần giữ im tay hoặc bật đèn, chứ không phải đổi tư thế.

Nếu gộp chung thành viền đỏ, bé sẽ nghĩ là mình đang làm sai động tác và cố gắng đổi động tác khác, dẫn đến một vòng lặp bế tắc.

### Đo lường độ mờ (Blur) bằng Global Laplacian

Để phát hiện ảnh mờ, chúng ta sẽ áp dụng toán tử Laplacian để tìm các đường viền (edges) trong ảnh, sau đó tính phương sai (variance) của các giá trị này.
Ảnh càng sắc nét -> đường viền càng mạnh -> phương sai càng cao.
Chúng ta sẽ thiết lập ngưỡng (threshold) ban đầu là `305`. Dưới mốc này, ảnh bị coi là mờ.

---

## Phân Tích Hiện Trạng Codebase

### Kiến trúc kiểm tra tính hợp lệ của Ảnh

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Trích xuất Keypoints (Mediapipe)                         │
│ 2. Đánh giá chất lượng (MỚI) ──────┐                        │
│ 3. Đếm số ngón tay                 │                        │
│ 4. Tính khoảng cách KNN            │                        │
│                                    ▼                        │
│                           [isBadQuality = true]             │
│                           - Sinh ra toast cảnh báo          │
│                           - Đổi viền ảnh thành màu vàng     │
└─────────────────────────────────────────────────────────────┘
```

### Các file bị ảnh hưởng

| File | Trạng thái | Vai trò |
|---|---|---|
| [TeachPanel.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/TeachPanel.tsx) | MODIFY | Cập nhật logic đánh giá `isBadQuality`, chặn không gọi KNN nếu ảnh mờ |
| [BodyTeachPanel.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/BodyTeachPanel.tsx) | MODIFY | Tương tự TeachPanel nhưng áp dụng cho toàn thân |
| [SampleGallery.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/SampleGallery.tsx) | MODIFY | Thêm style viền vàng (`border-yellow-500`) khi nhận flag chất lượng kém |
| [DataBalanceWarning.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/DataBalanceWarning.tsx) | MODIFY | Khôi phục và cải tiến UI cảnh báo |
| **image-quality.ts** | **NEW** | File tiện ích chứa thuật toán tính Laplacian Variance & Brightness |

---

## Proposed Changes

### Component 1: Utilities Chất lượng ảnh

---

#### [NEW] [image-quality.ts](file:///D:/HOCTAP/Learn-Hub/client/src/lib/image-quality.ts)

Module tính toán toán học để đánh giá ảnh:

```typescript
export function assessQuality(canvas: HTMLCanvasElement) {
  // 1. Chuyển canvas sang grayscale
  // 2. Chạy ma trận convolution Laplacian
  // 3. Tính phương sai
  // Nếu variance < 305 => isBlurry = true
  // Nếu độ sáng trung bình < 60 => isDark = true
}
```

---

#### [MODIFY] [TeachPanel.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/TeachPanel.tsx) & [BodyTeachPanel.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/BodyTeachPanel.tsx)

Cập nhật hàm bắt ảnh để đánh giá chất lượng ngay lập tức:

```typescript
// Ưu tiên 1: Nếu ảnh mờ/tối, từ chối thu thập nhưng không đánh dấu là sai tư thế (isValid = true)
if (quality.isBlurry || quality.isDark) {
  rejectedAny = true;
  rejectionMsg = quality.isBlurry 
    ? 'Ảnh hơi mờ! Bé cố gắng giữ chắc tay nhé 🔍' 
    : 'Ảnh hơi tối! Bé tìm chỗ sáng hơn xíu nha 🌑';
} else {
  // Thực hiện Validation 1 & 2 (Đếm ngón tay, KNN...)
}
```

---

#### [MODIFY] [SampleGallery.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/SampleGallery.tsx)

Thêm logic viền vàng:

```typescript
const isInvalid = s.isValid === false;
const isBadQuality = s.quality?.isBlurry || s.quality?.isDark;

className={
  isInvalid 
    ? 'border-4 border-red-500' // Sai tư thế
    : isBadQuality
    ? 'border-4 border-yellow-500' // Ảnh mờ/tối
    : 'border-2 border-transparent'
}
```

## Verification Plan

### Automated Tests
- Test các giá trị ma trận Laplacian trên ảnh tĩnh mẫu.

### Manual Verification
- Chạy app ở nơi thiếu sáng, giơ tay và xem hệ thống có chửi "Ảnh hơi tối" không.
- Rung tay mạnh, kiểm tra xem viền vàng có bao quanh ảnh ở Gallery không.
