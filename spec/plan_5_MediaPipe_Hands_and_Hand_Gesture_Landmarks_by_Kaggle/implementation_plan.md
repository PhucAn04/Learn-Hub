# Thay thế Golden Test Dataset bằng Dữ liệu Thực tế từ MediaPipe Hands

## Mục tiêu
Thay thế bộ Golden Test Dataset hiện tại (10 mẫu tọa độ lý thuyết tự viết tay) bằng dữ liệu thực tế được trích xuất từ bàn tay thật qua mô hình MediaPipe Hands, sử dụng bộ dữ liệu công khai **Hand Gesture Landmarks** trên Kaggle làm nguồn dữ liệu chính.

## Bối cảnh

### Vấn đề hiện tại
Bộ Golden Test Dataset hiện tại tại [golden-dataset.ts](file:///d:/HOCTAP/Learn-Hub/client/src/lib/golden-dataset.ts) gồm 10 mẫu vector 42 chiều được lập trình viên **tự ước lượng bằng trực giác toán học**, không có cơ sở dữ liệu thực nghiệm → Khó chứng minh tính chính xác trong luận văn.

### Giải pháp
Sử dụng bộ dữ liệu **Hand Gesture Landmarks** (Kaggle, tác giả Youssef Elebiary) chứa tọa độ 21 điểm mốc (x, y, z) đã được trích xuất bằng **MediaPipe Hands** từ bàn tay thật. Bộ dữ liệu này có:
- Cử chỉ **`point`** = tương đương "1 Ngón Tay ☝️"
- Cử chỉ **`peace`** = tương đương "2 Ngón Tay ✌️"

## Yêu cầu người dùng thao tác

> [!IMPORTANT]
> Bạn cần tải bộ dữ liệu Kaggle về thủ công trước khi chạy script chuyển đổi:
> 1. Truy cập: https://www.kaggle.com/datasets/youssefelebiary/hand-gesture-landmarks
> 2. Nhấn **Download** (cần đăng nhập Kaggle)
> 3. Giải nén file ZIP
> 4. Đặt file `gesture_landmarks.csv` vào thư mục: `d:\HOCTAP\Learn-Hub\scripts\`

## Proposed Changes

### [Component 1] Script chuyển đổi dữ liệu

#### [NEW] [convert-kaggle-to-golden.py](file:///d:/HOCTAP/Learn-Hub/scripts/convert-kaggle-to-golden.py)
Script Python thực hiện:
1. Đọc file CSV từ Kaggle (`gesture_landmarks.csv`)
2. Lọc ra các mẫu thuộc lớp `point` (1 ngón) và `peace` (2 ngón)
3. Áp dụng **cùng thuật toán chuẩn hóa** với hàm `normalizeHandKeypoints` trong hệ thống:
   - Tịnh tiến cổ tay (Landmark 0) về gốc tọa độ (0, 0)
   - Chia tọa độ cho khoảng cách lớn nhất từ cổ tay (Scale Normalization)
   - Chỉ lấy tọa độ 2D (x, y), bỏ z
4. Chọn ra **5 mẫu đại diện** cho mỗi cử chỉ bằng phương pháp **K-Medoids** (chọn mẫu thực tế gần tâm cụm nhất, đảm bảo đa dạng)
5. Xuất ra file TypeScript `golden-dataset.ts` mới

---

### [Component 2] Cập nhật Golden Test Dataset

#### [MODIFY] [golden-dataset.ts](file:///d:/HOCTAP/Learn-Hub/client/src/lib/golden-dataset.ts)
- Thay thế 10 mẫu lý thuyết cũ bằng 10 mẫu thực tế mới (5 `point` + 5 `peace`)
- Cập nhật comment ghi rõ nguồn gốc dữ liệu từ Kaggle
- Giữ nguyên interface `GoldenTestSample` và tên biến `GOLDEN_TEST_DATASET`

## Verification Plan

### Automated Tests
- Chạy `npm run build` để kiểm tra TypeScript compile thành công
- Chạy script Python để đảm bảo quá trình chuyển đổi không lỗi

### Manual Verification
- Kiểm tra bộ dữ liệu mới có 10 mẫu (5 "1 Ngón Tay" + 5 "2 Ngón Tay")
- Mỗi mẫu có đúng 42 chiều đặc trưng
- Giá trị tọa độ nằm trong khoảng [-1.0, 1.0]
- Phần tử đầu tiên (wrist) luôn là (0, 0)
