# Kế hoạch Triển khai 22: Chống Nhiễu Mờ Dạng Lưới (Grid-based Blur) & Cải Thiện UX

Nâng cấp thuật toán phát hiện mờ (Blur Detection) để chống lại hiện tượng "Smear Noise" (nhiễu phông nền), đồng thời sửa đổi UX liên quan đến việc bật/tắt khung xương (Skeleton) và trích xuất ảnh gốc (Raw Thumbnail) một cách chính xác.

---

## User Review Required

> [!IMPORTANT]
> **Triết lý cốt lõi:** Trẻ em không ngồi trước một bức tường trắng tinh. Phòng của bé sẽ có giá sách, đồ chơi, poster – những thứ tạo ra hàng ngàn đường nét (edges) sắc nét ở phông nền. Thuật toán Laplacian cũ cộng gộp toàn bộ màn hình sẽ bị "mù", nó nhìn thấy phông nền sắc nét và kết luận ảnh không mờ, mặc dù bàn tay của bé đang nhòe nhoẹt.

> [!WARNING]
> Kế hoạch này sẽ **thay đổi toàn bộ lõi toán học** của việc tính toán độ mờ ([image-quality.ts](file:///D:/HOCTAP/Learn-Hub/client/src/lib/image-quality.ts)). Chúng ta chuyển từ Global Variance (Phương sai toàn cục) sang **Grid-based Maximum Variance** (Phương sai cực đại dạng lưới).

---

## Quyết định: Cắt Lưới Tìm Độ Mờ Thực Sự

### Tại sao KHÔNG dùng Global Variance nữa?

Global Variance lấy tổng tất cả các pixel sắc nét chia đều cho khung hình. Nếu một bàn tay vung vẩy (rất mờ) nằm trước một giá sách (rất nét), trung bình cộng lại vẫn ra một con số rất lớn (VD: > 500). Hệ thống đánh lừa rằng ảnh đạt chuẩn, khiến dataset bị ô nhiễm bởi các bức ảnh tay nhòe nhoẹt.

### Phương án thay thế: Grid-based Max Variance (~40 dòng)

Chúng ta chia bức ảnh thành một lưới `N x M` (VD: 3x3 hoặc 4x4). Ta tính phương sai cho từng ô vuông một. 
- Nếu tay bị mờ, ô chứa tay sẽ có variance rất thấp (VD: 50).
- Ô chứa giá sách vẫn sẽ có variance cao (VD: 800).
Tuy nhiên, tay thường chiếm một vùng lớn, nếu ta quan sát sự chênh lệch giữa các ô, ta có thể áp dụng thêm **Smear Suppression** (khử nhiễu vệt). Thay vì lấy trung bình, ta lấy phương sai của các ô thấp nhất/cao nhất để đại diện cho trạng thái chuyển động của chủ thể.

```
Ví dụ chia lưới 3x3:

 ┌──────┬──────┬──────┐
 │ NÉT  │ NÉT  │ NÉT  │ ← Phông nền (Sách)
 ├──────┼──────┼──────┤
 │ NÉT  │ MỜ!  │ MỜ!  │ ← Tay vung vẩy
 ├──────┼──────┼──────┤
 │ NÉT  │ NÉT  │ NÉT  │ ← Quần áo
 └──────┴──────┴──────┘
```
Thuật toán sẽ tự động dò tìm vùng "MỜ!" để đưa ra phán quyết, bất chấp phông nền có nét đến đâu.

---

## Phân Tích Hiện Trạng Codebase

### Các file bị ảnh hưởng

| File | Trạng thái | Vai trò |
|---|---|---|
| [image-quality.ts](file:///D:/HOCTAP/Learn-Hub/client/src/lib/image-quality.ts) | MODIFY | Triển khai thuật toán Grid-based Max Variance |
| [DataCollector.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/DataCollector.tsx) | MODIFY | Sửa lỗi chụp Raw Thumbnail (bắt trước khi vẽ bộ xương) |
| [TeachPanel.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/TeachPanel.tsx) | MODIFY | Đồng bộ logic chụp ảnh gốc |
| [SampleGallery.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/SampleGallery.tsx) | MODIFY | Đổi icon nút ẩn/hiện xương từ `Eye` (mờ đi) thành `EyeOff` |

---

## Proposed Changes

### Component 1: Lõi Thuật Toán Lưới (Grid Algorithm)

---

#### [MODIFY] [image-quality.ts](file:///D:/HOCTAP/Learn-Hub/client/src/lib/image-quality.ts)

Chuyển đổi vòng lặp quét pixel đơn giản thành vòng lặp quét theo Block:

```typescript
// Bước 1: Chia ảnh thành GRID_SIZE x GRID_SIZE
// Bước 2: Duyệt từng block, tính variance cục bộ
// Bước 3: Tìm Max Variance
// Bước 4: Khử nhiễu cục bộ (Smear Suppression) bằng cách phạt điểm những vùng có biên độ mờ bất thường
```

### Component 2: UX Khung xương & Ảnh gốc

---

#### [MODIFY] [DataCollector.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/DataCollector.tsx)

Sửa lỗi chụp `rawThumbnail` bị dính nét vẽ xương của Mediapipe:

```diff
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  ctx.drawImage(videoRef, 0, 0);
+ const rawThumb = cv.toDataURL('image/jpeg', 0.8); // CHỤP NGAY LÚC NÀY
  drawSkeleton(ctx, keypoints); // VẼ XƯƠNG SAU
  const thumb = cv.toDataURL('image/jpeg', 0.8);
```

#### [MODIFY] Giao diện các trang có SampleGallery

Đồng bộ nút bật/tắt hiển thị bộ xương. Dùng `EyeOff` thay vì `Eye` xám mờ:

```diff
- {showSkeleton ? <Eye className="text-indigo-600" /> : <Eye className="text-gray-400" />}
+ {showSkeleton ? <Eye className="text-indigo-600" /> : <EyeOff className="text-gray-400" />}
```

## Verification Plan

### Automated Tests
- Truyền một bức ảnh có tay mờ và phông nền sắc nét vào hàm Grid-based Variance xem nó có trả về `isBlurry = true` không.

### Manual Verification
- Test thực tế: Lấy tay vẫy thật nhanh trước một tấm rèm nhiều hoa văn. Nếu hệ thống báo "Ảnh hơi mờ" thì thuật toán thành công.
- Vào Gallery, bấm nút hình con Mắt (`Eye`) xem nó có đổi thành `EyeOff` không.
- Chụp ảnh, vào xem chi tiết, kéo thanh `Opacity` bộ xương về 0. Đảm bảo ảnh gốc bên dưới **không có bất kỳ đường nét xanh đỏ nào của Mediapipe**.
