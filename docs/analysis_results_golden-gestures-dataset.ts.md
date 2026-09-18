# Phân tích: Chỉ số CŨ vs MỚI trong `golden-gestures-dataset.ts`

## Kết luận chính

> [!IMPORTANT]
> **File CŨ (196 mẫu) chứa tọa độ THÔ (raw) chưa được chuẩn hóa đúng cách.**
> **File MỚI (364 mẫu) chứa tọa độ ĐÃ chuẩn hóa đúng theo `normalizeHandKeypoints()`.**

---

## So sánh mẫu đầu tiên (`class_1` / thumb, sample 1)

### Dữ liệu gốc từ CSV Kaggle (wrist đã ở gốc `(0,0)`)

| Landmark | Raw X | Raw Y |
|----------|-------|-------|
| 0 (Wrist) | 0.0 | 0.0 |
| 1 (Thumb CMC) | -0.126341 | -0.482888 |
| 4 (Thumb Tip) | 0.074670 | **-2.048864** |
| 6 (Index PIP) | 0.605504 | -1.264861 |

### Khoảng cách từ Wrist đến từng Landmark

Landmark xa nhất = **Thumb Tip (LM4)**: $d_4 = \sqrt{0.0747^2 + 2.0489^2} = \mathbf{2.0502}$

### So sánh giá trị chuẩn hóa

| LM | **File CŨ** (git HEAD) | **File MỚI** (hiện tại) | **Tính tay** (÷ 2.0502) | Khớp CŨ? | Khớp MỚI? |
|---|---|---|---|---|---|
| 0 | `0, 0` | `0.0, 0.0` | `0.0, 0.0` | ✅ | ✅ |
| 1 | **`-0.126341, -0.482888`** | `-0.061623, -0.235529` | `-0.061623, -0.235529` | ❌ | ✅ |
| 2 | **`-0.036992, -1.15644`** | `-0.018043, -0.564053` | `-0.018043, -0.564053` | ❌ | ✅ |
| 4 | **`0.074670, -2.04886`** | `0.036420, -0.999337` | `0.036420, -0.999337` | ❌ | ✅ |
| 6 | **`0.605504, -1.26486`** | `0.295335, -0.616938` | `0.295335, -0.616938` | ❌ | ✅ |

> [!CAUTION]
> **File CŨ = tọa độ RAW từ CSV**, chưa chia cho `maxDist`.
> Giá trị vượt ngoài phạm vi `[-1, 1]` (VD: `-2.04886`).
> File MỚI = tọa độ đã chia cho `maxDist = 2.0502`, nằm gọn trong `[-1, 1]`. **Khớp 100% với thuật toán `normalizeHandKeypoints()`.**

---

## Nguyên nhân gốc rễ

Bộ dữ liệu Kaggle "Hand Gesture Landmarks" của tác giả Youssef Elebiary đã **sẵn tịnh tiến wrist về (0,0)** nhưng **CHƯA chia cho khoảng cách lớn nhất**. Script trích xuất cũ (ngày 2026-07-22) đã sao chép trực tiếp tọa độ từ CSV mà **không áp dụng bước chuẩn hóa maxDist**.

Trong khi đó, hệ thống frontend (`knn-classifier.ts` → `normalizeHandKeypoints()`) luôn chuẩn hóa tọa độ live camera bằng cách chia cho `maxDist`, tạo ra feature vector nằm trong `[-1, 1]`.

### Hậu quả

Khi so sánh khoảng cách Euclidean giữa:
- **Live camera features** (đã chuẩn hóa, range `[-1, 1]`)
- **Golden dataset features CŨ** (chưa chuẩn hóa, range `[-2, +1]`)

→ Khoảng cách bị **phóng đại ~2x** cho tất cả các cử chỉ, gây nhầm lẫn nghiêm trọng trong validation. Đặc biệt Rock & Roll và Peace có hình dạng tương tự (đều giơ 2 ngón), nên khi khoảng cách bị sai lệch, hệ thống dễ nhầm nhất ở 2 nhãn này.

---

## Tổng kết thay đổi

| | File CŨ (git HEAD) | File MỚI (hiện tại) |
|---|---|---|
| **Số mẫu** | 196 | 364 |
| **Nhãn `_inverted`** | ❌ Bỏ qua | ✅ Bao gồm |
| **Chuẩn hóa `÷ maxDist`** | ❌ **Thiếu** (raw CSV) | ✅ **Đúng** |
| **Phạm vi giá trị** | `[-2.05, +0.93]` | `[-1.0, +1.0]` |
| **Khớp `normalizeHandKeypoints()`** | ❌ | ✅ |
