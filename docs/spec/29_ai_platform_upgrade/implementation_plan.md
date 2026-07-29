# Kế Hoạch Nâng Cấp Learn-Hub Thành Nền Tảng Huấn Luyện AI Chuyên Nghiệp

Dựa trên việc phân tích toàn bộ source code của project **Learn-Hub**, tôi nhận thấy đây là một dự án giáo dục AI (tương tự Google Teachable Machine) rất sáng tạo, sử dụng MediaPipe và TensorFlow.js/KNN trên trình duyệt. 

Tuy nhiên, để chuyển mình từ một "ứng dụng đồ chơi giáo dục" (toy app) thành một **dự án huấn luyện AI thực thụ (Real AI Training Project / MLOps lite)**, chúng ta cần tái cấu trúc và bổ sung các thành phần quan trọng dưới đây.

---

## 1. Những Điểm Cần Chỉnh Chu Lại (Refactoring & Optimizing)

Phần này tập trung vào việc khắc phục các hạn chế kỹ thuật hiện tại trong codebase.

### 1.1. ✅ Tối Ưu Hóa Lưu Trữ Dataset Tại Backend (NestJS)
- **Tiến độ**: Đã hoàn thành 100%. Tích hợp thành công **Cloudinary** để lưu trữ hình ảnh và Dataset JSON. Tích hợp thêm tự động sao lưu (auto-backup) vào **Google Drive** của người dùng dưới nền (Background Task).
- **Vấn đề đã giải quyết**: Dataset đang được lưu dưới dạng file JSON tĩnh (`fs.writeFileSync`) vào thư mục `uploads/datasets`, và đọc lên bằng hàm đồng bộ `fs.readFileSync` (gây block Node.js Event Loop).
- **Giải pháp**: 
  - Chuyển sang lưu trữ file trên **Cloud Storage** (AWS S3, MinIO, hoặc Cloudinary).
  - Hoặc lưu trữ các mẫu dữ liệu (samples) thành các bản ghi trong **Database (PostgreSQL)** để dễ dàng truy vấn, phân trang (pagination) và lọc dữ liệu.
  - Loại bỏ các thao tác File System đồng bộ (`fs.readFileSync/writeFileSync`).

### 1.2. ✅ Hoàn Thiện Vòng Đời Của Model (Model Lifecycle)
- **Tiến độ**: Đã hoàn thành 100%. Dữ liệu model weights (`.json` và `.bin`) sinh ra từ trình duyệt đã được tự động đóng gói (Blobs) và đẩy lên Cloudinary/Google Drive ngay khi học sinh nộp bài. Đã cập nhật Entity lưu trữ `modelArtifactUrl`.
- **Vấn đề hiện tại**: Entity `Model` trong database hiện tại chỉ lưu trữ `testScore` và `teacherFeedback`. Việc huấn luyện Neural Network (qua `TfTrainer`) diễn ra hoàn toàn trên RAM của Client (trình duyệt) và **chưa hề lưu trữ lại file weights** (trọng số) của mô hình.
- **Giải pháp**: 
  - Cho phép xuất mô hình TF.js (file `model.json` và `.bin`) trên client.
  - Upload file weights này lên Server sau khi train xong. Cập nhật Entity `Model` để lưu trữ đường dẫn `modelArtifactUrl`.

### 1.3. ❌ Tách Biệt Rõ Ràng Lớp ML (Machine Learning Abstraction) - [ĐÃ HỦY BỎ / CANCELED]
- **Tiến độ**: Ý tưởng này ĐÃ BỊ HỦY BỎ HOÀN TOÀN (ABANDONED).
- **Lý do hủy bỏ**: Việc chuyển đổi toàn bộ logic ML đang hardcode trong `knn-classifier.ts` và `tf-trainer.ts` sang một Interface chung (như `IClassifier`) sẽ đụng chạm quá sâu vào kiến trúc các file UI (như `TeachPanel`, `BodyTeachPanel`). Điều này mang lại rủi ro rất cao làm gãy hệ thống hiện tại.
- **Lưu ý nghiêm ngặt cho AI & Developer**: TUYỆT ĐỐI KHÔNG ĐƯỢC lật lại vấn đề này trong tương lai. Xin hãy bỏ qua hoàn toàn yêu cầu thiết kế IClassifier và giữ nguyên cấu trúc codebase hiện hành. File nháp trước đây đã bị đổi tên thành `_ABANDONED_DO_NOT_IMPLEMENT_classifier_blueprint.txt` để vô hiệu hóa.

---

## 2. Những Tính Năng Cần Phát Triển Thêm (Features for "Real AI")

Để biến dự án thành một hệ thống train AI chuyên nghiệp, chúng ta cần đưa tư duy **MLOps (Machine Learning Operations)** vào dự án.

### 2.1. ⏳ Đưa Huấn Luyện Lên Server (Server-Side Training Pipeline)
Hiện tại việc train phụ thuộc vào cấu hình máy tính của trẻ em (client). Một dự án AI thật sẽ cần có khả năng train trên Server/Cloud.
- **Message Queue**: Tích hợp **Redis + BullMQ** vào NestJS. Khi người dùng bấm "Train", client sẽ gửi API request tạo một Training Job đẩy vào Queue.
- **Training Worker (Python / PyTorch / TensorFlow)**: Tránh sử dụng `@tensorflow/tfjs-node` do thư viện này phụ thuộc nhiều vào native bindings (node-gyp, prebuilt binaries), thường xuyên gây lỗi biên dịch chéo nền tảng, kén phiên bản Node.js và có nguy cơ rò rỉ bộ nhớ (memory leak) trên Node.js. Thay vào đó:
  - **Giải pháp**: Xây dựng một **Python Microservice/Worker** độc lập. Python là ngôn ngữ tiêu chuẩn của AI, hoạt động ổn định và hỗ trợ tốt GPU.
  - **Cơ chế**: Worker Python sẽ lắng nghe hàng đợi (sử dụng thư viện `bullmq` bản Python hoặc Celery/RQ). Khi có Job, Worker kéo Dataset từ DB/Cloudinary về, dùng PyTorch/TF để huấn luyện.
  - Kiến trúc này cô lập hoàn toàn môi trường AI (Python) với môi trường Web (Node.js/NestJS), đảm bảo server không bao giờ bị treo hay crash vì lỗi C++ bindings.
- **WebSockets (Real-time tracking)**: Sử dụng `Socket.io` trong NestJS. Python Worker sẽ publish (qua Redis Pub/Sub) các thông số `loss`, `accuracy` từng epoch, và NestJS sẽ stream thẳng về Client theo thời gian thực (Giống như TensorBoard).

### 2.2. ⏳ Khả Năng Suy Luận Bằng API (Server-side Inference / Deployment)
- AI thật không chỉ nằm trên web. Khi train xong một Model, hệ thống cần cung cấp một **Inference API endpoint** (VD: `POST /api/models/:id/predict`).
- Người dùng có thể dùng Postman hoặc code Python gọi API này, gửi tọa độ landmarks hoặc ảnh gốc lên để nhận kết quả phân loại từ Model đã được deploy trên Server.

### 2.3. ⏳ Theo Dõi Thử Nghiệm & Tinh Chỉnh Siêu Tham Số (Experiment Tracking & Hyperparameter Tuning)
- Cho phép người dùng thiết lập các siêu tham số (Hyperparameters) trước khi train:
  - Số `Epochs` (vòng lặp).
  - `Batch Size`.
  - `Learning Rate`.
  - Thuật toán tối ưu (Adam, SGD).
- Lưu lại lịch sử các lần train (Experiments) cho cùng một Dataset để so sánh (Lần train nào có accuracy cao hơn).

### 2.4. ✅ Tiền Xử Lý & Tăng Cường Dữ Liệu (Data Augmentation) - *[Tùy Chọn Mở Rộng / Bài Học Nâng Cao]*
- **Tiến độ**: Đã hoàn thành (Dưới dạng module ngầm). Đã viết sẵn lõi thuật toán tại `client/src/lib/data-augmentation.ts` (thực hiện Jittering và Scaling tọa độ 1D).
- **Mục đích giáo dục**: Giúp học sinh hiểu về hiện tượng "Học vẹt" (Overfitting) khi lượng dữ liệu ít và cách AI tổng quát hóa (Generalization).
- Tính năng này được thiết kế **hoàn toàn độc lập** và chưa gắn trực tiếp vào hệ thống hiện tại để tránh làm trẻ bối rối ở những bài học cơ bản. Khi trẻ học đến bài nâng cao, giáo viên chỉ việc gọi hàm `augmentLandmarks()` trước khi đưa dữ liệu vào huấn luyện.

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