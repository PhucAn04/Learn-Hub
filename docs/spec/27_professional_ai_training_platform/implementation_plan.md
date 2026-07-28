# Kế Hoạch Nâng Cấp Learn-Hub Thành Nền Tảng Huấn Luyện AI Chuyên Nghiệp

Dựa trên việc phân tích toàn bộ source code của project **Learn-Hub**, tôi nhận thấy đây là một dự án giáo dục AI (tương tự Google Teachable Machine) rất sáng tạo, sử dụng MediaPipe và TensorFlow.js/KNN trên trình duyệt. 

Tuy nhiên, để chuyển mình từ một "ứng dụng đồ chơi giáo dục" (toy app) thành một **dự án huấn luyện AI thực thụ (Real AI Training Project / MLOps lite)**, chúng ta cần tái cấu trúc và bổ sung các thành phần quan trọng dưới đây.

---

## 1. Những Điểm Cần Chỉnh Chu Lại (Refactoring & Optimizing)

Phần này tập trung vào việc khắc phục các hạn chế kỹ thuật hiện tại trong codebase.

### 1.1. Tối Ưu Hóa Lưu Trữ Dataset Tại Backend (NestJS)
- **Vấn đề hiện tại**: Dataset đang được lưu dưới dạng file JSON tĩnh (`fs.writeFileSync`) vào thư mục `uploads/datasets`, và đọc lên bằng hàm đồng bộ `fs.readFileSync` (gây block Node.js Event Loop).
- **Giải pháp**: 
  - Chuyển sang lưu trữ file trên **Cloud Storage** (AWS S3, MinIO, hoặc Cloudinary).
  - Hoặc lưu trữ các mẫu dữ liệu (samples) thành các bản ghi trong **Database (PostgreSQL)** để dễ dàng truy vấn, phân trang (pagination) và lọc dữ liệu.
  - Loại bỏ các thao tác File System đồng bộ (`fs.readFileSync/writeFileSync`).

### 1.2. Hoàn Thiện Vòng Đời Của Model (Model Lifecycle)
- **Vấn đề hiện tại**: Entity `Model` trong database hiện tại chỉ lưu trữ `testScore` và `teacherFeedback`. Việc huấn luyện Neural Network (qua `TfTrainer`) diễn ra hoàn toàn trên RAM của Client (trình duyệt) và **chưa hề lưu trữ lại file weights** (trọng số) của mô hình.
- **Giải pháp**: 
  - Cho phép xuất mô hình TF.js (file `model.json` và `.bin`) trên client.
  - Upload file weights này lên Server sau khi train xong. Cập nhật Entity `Model` để lưu trữ đường dẫn `modelArtifactUrl`.

### 1.3. Tách Biệt Rõ Ràng Lớp ML (Machine Learning Abstraction)
- **Vấn đề hiện tại**: Logic ML đang hardcode trong `knn-classifier.ts` và `tf-trainer.ts`. Neural Network bị fix cứng kiến trúc (2 lớp Dense).
- **Giải pháp**: Xây dựng interface chung `IClassifier` cho phép dễ dàng switch giữa KNN, MLP, hoặc các thuật toán khác. Cho phép người dùng tùy chỉnh tham số kiến trúc.

---

## 2. Những Tính Năng Cần Phát Triển Thêm (Features for "Real AI")

Để biến dự án thành một hệ thống train AI chuyên nghiệp, chúng ta cần đưa tư duy **MLOps (Machine Learning Operations)** vào dự án.

### 2.1. Đưa Huấn Luyện Lên Server (Server-Side Training Pipeline)
Hiện tại việc train phụ thuộc vào cấu hình máy tính của trẻ em (client). Một dự án AI thật sẽ cần có khả năng train trên Server/Cloud.
- **Message Queue**: Tích hợp **Redis + BullMQ** vào NestJS. Khi người dùng bấm "Train", client sẽ gửi API request tạo một Training Job.
- **Training Worker**: Xây dựng một Worker Service (có thể dùng Python/PyTorch hoặc Node.js `@tensorflow/tfjs-node`). Worker này sẽ lấy dataset từ DB, thực hiện train model độc lập với API, không làm treo server.
- **WebSockets (Real-time tracking)**: Sử dụng `Socket.io` trong NestJS để stream các thông số `loss`, `accuracy` từng epoch từ Worker trả về giao diện Client theo thời gian thực (Giống như TensorBoard).

### 2.2. Khả Năng Suy Luận Bằng API (Server-side Inference / Deployment)
- AI thật không chỉ nằm trên web. Khi train xong một Model, hệ thống cần cung cấp một **Inference API endpoint** (VD: `POST /api/models/:id/predict`).
- Người dùng có thể dùng Postman hoặc code Python gọi API này, gửi tọa độ landmarks hoặc ảnh gốc lên để nhận kết quả phân loại từ Model đã được deploy trên Server.

### 2.3. Theo Dõi Thử Nghiệm & Tinh Chỉnh Siêu Tham Số (Experiment Tracking & Hyperparameter Tuning)
- Cho phép người dùng thiết lập các siêu tham số (Hyperparameters) trước khi train:
  - Số `Epochs` (vòng lặp).
  - `Batch Size`.
  - `Learning Rate`.
  - Thuật toán tối ưu (Adam, SGD).
- Lưu lại lịch sử các lần train (Experiments) cho cùng một Dataset để so sánh (Lần train nào có accuracy cao hơn).

### 2.4. Tiền Xử Lý & Tăng Cường Dữ Liệu (Data Augmentation)
- Phát triển thêm pipeline tự động sinh dữ liệu: lật ngược tọa độ (flip), thêm nhiễu (noise add) vào các điểm landmarks để làm giàu dữ liệu, giúp Model chống lại Overfitting (học vẹt).

---

## Tóm Lược Lộ Trình Triển Khai Đề Xuất (Roadmap)

> [!IMPORTANT]
> **Bạn muốn ưu tiên triển khai phần nào trước?**
> 
> 1. **Phase 1**: Tái cấu trúc Backend (Lưu trữ Model weights, đổi File System sang Cloud/S3/DB để tránh block event loop).
> 2. **Phase 2**: Phát triển UI Tùy chỉnh tham số (Hyperparameters) và lưu lại các phiên bản Model khác nhau.
> 3. **Phase 3**: Xây dựng **Server-side Training Worker** (Tách việc train khỏi trình duyệt, dùng Queue & WebSockets để báo cáo tiến độ).
> 4. **Phase 4**: Xây dựng Inference API để phục vụ dự đoán từ bên ngoài.

Vui lòng cho tôi biết bạn muốn bắt đầu đi sâu vào hiện thực hóa phần nào, hoặc nếu bạn có định hướng riêng cho dự án, tôi sẽ code theo ý bạn!
