# Kế hoạch triển khai: Thêm lớp 2 Bàn Tay vào Bài Tập (Teach Mode)

Bạn yêu cầu thêm 2 khối div (2 lớp mới) vào trang Teach:
1. `2 Bàn Tay, 1 Ngón Tay` (mỗi bàn giơ 1 ngón tay)
2. `2 Bàn Tay, 2 Ngón Tay` (mỗi bàn giơ 2 ngón tay)

## Phân tích Vấn đề Kỹ thuật
Hiện tại, mô hình KNN và bộ dữ liệu đang được thiết kế để học **trên 1 bàn tay** (chụp 42 tọa độ của 1 bàn tay). Khi bạn giơ 2 bàn tay ra trước camera, hệ thống sẽ tách ra làm 2 bàn tay độc lập, dự đoán từng bàn tay xem đó là "1 ngón" hay "2 ngón", sau đó cộng lại (như code hiện tại ở dòng 138-149 đang làm).

Nếu thêm 2 lớp mới này vào danh sách `CLASSES` để học sinh thu thập mẫu, chúng ta sẽ gặp 2 bài toán:
1. **Thu thập mẫu (Capture):** Nếu học sinh giơ 2 bàn tay, hệ thống sẽ phải lưu cả 2 bàn tay vào 1 mẫu (84 tọa độ) hay tách ra làm 2 mẫu riêng lẻ? Nếu lưu 84 tọa độ, mô hình KNN hiện tại sẽ bị lỗi vì độ dài dữ liệu học (42 vs 84) không khớp nhau.
2. **Golden Test (Chấm điểm):** Bộ test chuẩn (Golden Dataset) hiện tại chỉ có 10 mẫu dành cho 1 ngón và 2 ngón. Hệ thống không có mẫu chuẩn cho dáng 2 bàn tay để chấm điểm.

## Đề xuất Giải pháp (Proposed Changes)

Thay vì bắt mô hình KNN học một array 84 tọa độ (rất khó chính xác vì tay trái/tay phải có thể đổi chỗ cho nhau), chúng ta sẽ giữ nguyên cơ chế **KNN chỉ học 1 bàn tay**, nhưng sẽ thay đổi logic Thu thập mẫu và Giao diện:

### 1. Thay đổi UI (`CLASSES`)
Thêm 2 lớp mới vào `CLASSES`:
- Lớp 3: `1 Ngón Tay (Trái & Phải) ☝️☝️` (để mô phỏng 2 Bàn Tay, 1 Ngón Tay)
- Lớp 4: `2 Ngón Tay (Trái & Phải) ✌️✌️` (để mô phỏng 2 Bàn Tay, 2 Ngón Tay)

### 2. Logic Thu thập mẫu (Capture Sample)
Khi học sinh chọn Lớp 3 hoặc Lớp 4 và bấm Chụp:
- Bắt buộc học sinh phải giơ đủ **2 bàn tay** vào khung hình.
- Hệ thống sẽ trích xuất tọa độ của tay thứ 1 và tay thứ 2, sau đó lưu thành **2 mẫu độc lập** (mỗi mẫu 42 tọa độ) nhưng dùng chung 1 nhãn (ví dụ: gán nhãn `1 Ngón Tay ☝️` cho cả 2 tay vừa chụp ở Lớp 3).
- Bằng cách này, học sinh vẫn có cảm giác mình đang dạy AI nhận biết "2 bàn tay cùng lúc", nhưng AI thực chất đang học dữ liệu của "1 ngón tay" từ nhiều góc độ của cả tay trái và tay phải, giúp mô hình thông minh hơn.

### 3. Logic Đánh giá (Golden Test)
Vì thực chất AI vẫn đang học nhận diện "1 ngón" và "2 ngón" từ 4 class trên, nên bộ **Golden Test Dataset (10 mẫu)** hiện tại vẫn sẽ hoạt động hoàn hảo và chấm điểm chính xác mà không cần sửa.

### 4. Logic Dự đoán (Prediction)
Phần logic dự đoán khi có 2 bàn tay (Tay 1: 1 ngón, Tay 2: 1 ngón -> Tổng 2 ngón) đã được viết sẵn trong code hiện tại, sẽ hoạt động tốt với dữ liệu mới này.

## User Review Required
> [!IMPORTANT]
> Cách giải quyết này giúp học sinh có trải nghiệm chụp 2 tay cùng lúc như bạn muốn, nhưng vẫn giữ được sự ổn định của thuật toán ML và hệ thống chấm điểm tự động. Bạn có đồng ý với hướng triển khai này không? Xin vui lòng xác nhận để tôi tiến hành sửa code.
