# Kế hoạch Triển khai 23: Tối Ưu Trải Nghiệm Dạy AI & Tinh Chỉnh KNN

Lột xác trải nghiệm Dạy AI (Teach AI) bằng cách thêm thanh tiến trình (Progress Bar), làm rõ các hộp thoại phản hồi (AI Feedback Modal) để bé hiểu rõ tại sao AI "chê" ảnh của mình. Đồng thời, thay thế thuật toán chống nhiễu mờ thành phương pháp "Viên Đạn Bạc" (ROI Bounding Box) và nới lỏng KNN Validation.

---

## User Review Required

> [!IMPORTANT]
> **Triết lý cốt lõi:** Bé cần cảm nhận được sự tiến bộ (Sense of Progress) khi làm nhiệm vụ thu thập dữ liệu. Việc cứ đưa tay lên hạ tay xuống mà không biết bao giờ mới xong sẽ gây nhàm chán. Đồng thời, AI không được "quát" bé nếu bé đã làm đúng tư thế mà chỉ vì ảnh mờ.

> [!WARNING]
> Kế hoạch này sẽ **loại bỏ hoàn toàn thuật toán khử nhiễu Laplacian (Smear Suppression)** từ Plan 22 vì nó quá nhạy cảm. Chúng ta sẽ thay bằng kỹ thuật cắt vùng (Region Of Interest - ROI) trực tiếp từ tọa độ xương của Mediapipe.

---

## Quyết định: Dùng Bounding Box thay vì tính toán mù

### Vấn đề của Grid-based (Plan 22)
Việc chia lưới bức ảnh vẫn là "đoán mò". Lưới có thể vô tình chia cắt đôi bàn tay, khiến việc đo lường bị sai lệch. Hơn nữa, thao tác khử nhiễu Laplacian nhiều khi làm mất luôn tín hiệu mờ tự nhiên.

### "Viên Đạn Bạc": Cắt đúng Bàn Tay / Cơ Thể bằng ROI (~20 dòng)

Mediapipe ĐÃ CHO CHÚNG TA TỌA ĐỘ BÀN TAY (X, Y). Tại sao chúng ta lại đi đo độ mờ của toàn bộ bức ảnh làm gì?
- Ta tìm tọa độ `Min X, Min Y` và `Max X, Max Y` của 21 điểm khớp ngón tay.
- Vẽ một hình chữ nhật (Bounding Box) bọc lấy bàn tay, cộng thêm 10% padding.
- Ta "cắt" phần hình chữ nhật này ra khỏi ảnh, và CHỈ chạy thuật toán Laplacian trên đúng phần ảnh bàn tay này.
- **Kết quả:** Phông nền rác biến mất 100%. Phép toán chạy cực nhanh và cực kỳ chính xác.

---

## Phân Tích Hiện Trạng Codebase

### Các file bị ảnh hưởng

| File | Trạng thái | Vai trò |
|---|---|---|
| [image-quality.ts](file:///D:/HOCTAP/Learn-Hub/client/src/lib/image-quality.ts) | MODIFY | Gỡ bỏ Grid-based, thêm hàm `calculateROI()`, đổi thành ROI-based Variance |
| [TeachPanel.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/TeachPanel.tsx) | MODIFY | Bổ sung Progress Bar, sửa logic KNN Validation |
| [BodyTeachPanel.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/BodyTeachPanel.tsx) | MODIFY | Bổ sung Progress Bar, đồng bộ logic ROI |
| [SamplePreviewModal.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/SamplePreviewModal.tsx) | MODIFY | Xử lý cờ `isMisclassified` hiển thị thông báo "AI nghĩ ảnh này sai" |
| [AIFeedbackModal.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/AIFeedbackModal.tsx) | MODIFY | Redesign UI thân thiện với trẻ em |

---

## Proposed Changes

### Component 1: ROI-based Blur Detection

---

#### [MODIFY] [image-quality.ts](file:///D:/HOCTAP/Learn-Hub/client/src/lib/image-quality.ts)

Thêm hàm trích xuất hộp giới hạn (Bounding Box):

```typescript
export function calculateROI(keypoints: any[], imgW: number, imgH: number, padding = 0.1) {
  // Tìm min/max X và Y
  // Thêm % padding
  // Trả về { x, y, width, height }
}

// Cập nhật assessQuality
export function assessQuality(canvas: HTMLCanvasElement, roi?: ROI) {
  // NẾU CÓ ROI: Chỉ lấy pixel data nằm trong hình chữ nhật đó
  // Chạy Global Laplacian trên đúng vùng đó
}
```

### Component 2: Nới lỏng KNN Validation

---

#### [MODIFY] [TeachPanel.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/TeachPanel.tsx)

Bé vừa giơ tay đúng chuẩn 5 ngón, nhưng rung tay nên bị mờ. Thay vì đánh rớt bằng viền đỏ (Lỗi Tư Thế), ta chỉ lấy cờ mờ:

```typescript
// Bỏ qua việc đánh giá sai tư thế nếu ảnh đã bị mờ hoặc tối
const isMisclassified = (sample.quality?.isBlurry || sample.quality?.isDark) 
  ? false 
  : predictedLabel !== expectedLabel;
```

### Component 3: UX & Feedback

---

#### [MODIFY] [BodyTeachPanel.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/BodyTeachPanel.tsx) & [TeachPanel.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/TeachPanel.tsx)

Thêm thanh tiến trình thu thập dữ liệu (Train Progress Bar) ở giao diện chính để bé biết mình đã chụp được bao nhiêu ảnh đạt chuẩn.

#### [MODIFY] [SamplePreviewModal.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/SamplePreviewModal.tsx)

```diff
- AI nghĩ ảnh có viền nổi bật (đỏ/vàng) không giống với nhãn bé đang dạy hoặc bị mờ.
+ AI nghĩ ảnh có viền nổi bật (đỏ/vàng) không đúng nhãn bé đang dạy hoặc bị mờ.
```

Tách biệt rõ ràng lý do từ chối khi click vào ảnh để xem chi tiết.

## Verification Plan

### Manual Verification
- Vào mục Dạy AI, chụp một vài bức ảnh. Thanh Tiến Trình (Progress Bar) phải dài ra.
- Cố tình giơ tay vẫy thật nhanh để bị mờ. Khung viền xuất hiện phải là màu **VÀNG** (cảnh báo mờ), không được là màu **ĐỎ** (AI nhận diện sai tư thế).
- Mở Modal xem chi tiết ảnh bị mờ, xem thông báo có ghi đúng lý do mờ hay không.
