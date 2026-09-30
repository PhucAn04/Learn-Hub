# Hướng dẫn Hệ thống: Dạy AI học Cử chỉ và Cảm xúc Khuôn mặt (KNN + Kaggle Data)

Tính năng Dạy AI (Teach) đã được mở rộng thêm hai trang mới, cho phép bé ứng dụng thuật toán KNN (K-Nearest Neighbors) để phân loại cử chỉ tay và cảm xúc khuôn mặt một cách trực quan.

## Tổng quan các trang mới

### 1. Dạy AI Học Cử Chỉ (`/challenge/teach-gestures`)
- **Mục tiêu:** Dạy AI phân loại 4 dáng tay: Thích (👍), Quyết Tâm (✊), Chiến Thắng (✌️), Chào Bạn (✋).
- **Công nghệ:** Sử dụng ml5.js (Handpose) để trích xuất 21 điểm tọa độ tay. KNN phân loại dựa trên vector đặc trưng (42 phần tử).
- **Đánh giá tự động:** Sử dụng bộ `GOLDEN_GESTURES_DATASET`. Tập dữ liệu chuẩn này được lấy từ bộ **Hand Gesture Landmarks** trên Kaggle (tác giả Youssef Elebiary).

### 2. Dạy AI Học Cảm Xúc Khuôn Mặt (`/challenge/teach-face`)
- **Mục tiêu:** Dạy AI phân loại 3 cảm xúc: Vui vẻ (😀), Buồn bã (😢), Ngạc nhiên (😲).
- **Công nghệ:** Sử dụng ml5.js (FaceMesh) để trích xuất 468 điểm tọa độ khuôn mặt. KNN phân loại dựa trên vector đặc trưng (936 phần tử).
- **Đánh giá tự động:** Sử dụng bộ `GOLDEN_FACE_DATASET`. Tập dữ liệu chuẩn này được lấy từ bộ **FER-2013 (Facial Expression Recognition)** nổi tiếng trên Kaggle (tác giả Pierre-Luc Carrier & Aaron Courville).

## Danh sách Tham khảo Luận văn Sinh viên

Để sinh viên có thể đưa vào luận văn cơ sở lý thuyết và minh chứng khoa học cho bộ Golden Dataset, dưới đây là thông tin trích dẫn:

> [!NOTE]
> **Bộ dữ liệu Cử chỉ (Hand Gestures)**
> - **Tên Dataset:** Hand Gesture Landmarks
> - **Tác giả:** Youssef Elebiary
> - **Nguồn:** [Kaggle](https://www.kaggle.com/datasets/youssefelebiary/hand-gesture-landmarks)
> - **Phương pháp xử lý:** Script `convert-kaggle-to-golden-gestures.py` lọc lấy tọa độ không gian 3D, loại bỏ trục Z, chuẩn hóa khoảng cách tương đối (tịnh tiến về cổ tay, chia cho độ dài tối đa), và dùng K-Medoids Clustering để trích xuất 5 điểm dữ liệu đặc trưng (medoids) làm đại diện đánh giá cho mỗi class.

> [!NOTE]
> **Bộ dữ liệu Cảm xúc Khuôn mặt (Facial Expressions)**
> - **Tên Dataset:** FER-2013 (Facial Expression Recognition 2013 Dataset)
> - **Tác giả:** Pierre-Luc Carrier & Aaron Courville
> - **Nguồn:** [Kaggle](https://www.kaggle.com/datasets/msambare/fer2013)
> - **Phương pháp xử lý:** Dữ liệu gốc là ảnh grayscale 48x48. Script `extract-face-landmarks.py` thực hiện xử lý ảnh (upscale lên 192x192, convert sang RGB), dùng thư viện Google MediaPipe Tasks API (FaceLandmarker) để dò 468 điểm tọa độ Landmark trên các ảnh thật. Sau khi chuẩn hóa ma trận (tịnh tiến về đỉnh mũi), thuật toán K-Medoids chọn ra 5 khuôn mặt mang tính "trung bình mẫu" (medoids) cho mỗi cảm xúc.

## Cơ chế Hoạt động của Hệ thống Đánh giá

Khi bé bấm "Nộp Bài Cho Thầy Cô", hệ thống sẽ:
1. Nạp bộ tập mẫu huấn luyện mà bé vừa dạy thông qua Camera.
2. Nạp file Golden Dataset tương ứng (được nén cứng trong mã nguồn TS: `lib/golden-gestures-dataset.ts` hoặc `lib/golden-face-dataset.ts`).
3. Lặp qua từng phần tử của tập Golden (Tập Kiểm Thử), đối chiếu với tập của bé (Tập Huấn Luyện) thông qua khoảng cách **Euclidean** (tương tự như cách các bài báo khoa học so khớp features).
4. Tính tỷ lệ chính xác Accuracy = (Tổng số dự đoán đúng KNN) / (Số mẫu trong Golden Dataset).
5. Áp dụng luật **Penalty (-2% mỗi mẫu thiếu so với quy định là 10 mẫu/class)** để yêu cầu bé phải cung cấp lượng dữ liệu đa dạng.

Cơ chế này mô phỏng chân thực chu trình làm việc của một AI Engineer: *Thu thập Dữ liệu → Huấn Luyện Mô Hình → Đánh Giá bằng Test Set Độc Lập → Nhận Điểm Số Đánh Giá (Metric).*
