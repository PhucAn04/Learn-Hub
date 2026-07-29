# Xây dựng công cụ trích xuất Face Landmarks bằng TensorFlow.js (Node.js + Docker)

Mục tiêu: Xây dựng một môi trường Docker cô lập (sử dụng `node:20-slim`) để chạy script Node.js trích xuất tọa độ khuôn mặt từ ảnh gốc FER-2013 bằng thư viện TensorFlow.js, thay thế hoàn toàn công cụ Python cũ.

## User Review Required

> [!IMPORTANT]
> - **Ảnh gốc FER-2013**: Trước đó tôi đã xóa thư mục `dataset/` cho nhẹ máy. Khi chạy công cụ này, bạn sẽ cần chuẩn bị lại thư mục `dataset/FER-2013/` chứa các ảnh đã chia theo thư mục (ví dụ: `happy/`, `sad/`, `surprise/`).
> - **Hiệu năng**: TensorFlow.js trên Node.js (`tfjs-node`) sẽ biên dịch binding C++ tĩnh, do đó chạy rất nhanh trong Docker.

## Proposed Changes

Chúng ta sẽ tạo một thư mục mới `scripts/tfjs-extractor/` để chứa toàn bộ mã nguồn xử lý này, đảm bảo không ảnh hưởng đến code của Web App.

### Môi trường Docker

#### [NEW] `scripts/tfjs-extractor/Dockerfile`
- Base image: `node:20-slim`
- Cài đặt thêm các gói hệ thống tối thiểu (nếu cần thiết cho `tfjs-node`). Mặc định `@tensorflow/tfjs-node` đã có sẵn binary (pre-built) cho Linux x64 nên sẽ cài rất mượt.

#### [NEW] `scripts/tfjs-extractor/docker-compose.yml`
- Cấu hình Volume: Mount thư mục `dataset/` vào trong container để đọc ảnh. Mount `client/src/lib/` để script có thể ghi trực tiếp file `golden-face-dataset.ts` vào đúng chỗ cho Next.js dùng.

### Mã nguồn Node.js

#### [NEW] `scripts/tfjs-extractor/package.json`
- Các thư viện:
  - `@tensorflow/tfjs-node`: Core engine để chạy TF.js trên môi trường Node không có trình duyệt.
  - `@tensorflow-models/face-landmarks-detection`: Chứa model MediaPipe Face Mesh.

#### [NEW] `scripts/tfjs-extractor/extract.js`
- Đọc từng file ảnh `.jpg`/`.png` trong tập dữ liệu.
- Sử dụng hàm `tf.node.decodeImage()` (tích hợp sẵn trong `tfjs-node`, không cần cài thư viện đồ họa bên ngoài như `canvas`).
- Chạy model `faceLandmarksDetection` để lấy ra 468 điểm (x, y, z).
- Dịch chuyển điểm chóp mũi về `(0,0)` và chuẩn hóa tọa độ (chia cho khoảng cách lớn nhất).
- Lưu ngẫu nhiên (hoặc K-medoids) 20 mẫu cho mỗi cảm xúc.
- Sinh ra code TypeScript và xuất ra file `golden-face-dataset.ts`.

## Verification Plan

### Manual Verification
1. Bạn tải lại một vài ảnh mẫu vào thư mục `dataset/FER-2013/happy/`, `sad/`, `surprise/`.
2. Mở Terminal chạy lệnh: `cd scripts/tfjs-extractor && docker-compose up --build`.
3. Kiểm tra xem file `client/src/lib/golden-face-dataset.ts` có được ghi đè thành công và hệ thống game trên web hoạt động bình thường hay không.
