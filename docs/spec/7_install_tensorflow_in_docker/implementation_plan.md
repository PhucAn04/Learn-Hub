# Tích hợp công cụ trích xuất Face Landmarks vào Docker Compose chính

Mục tiêu: Đưa cấu hình chạy công cụ trích xuất bằng TensorFlow.js vào chung file `D:\HOCTAP\Learn-Hub\docker-compose.yml` hiện tại để dễ quản lý, thay vì tạo một `docker-compose.yml` riêng lẻ.

## User Review Required

> [!IMPORTANT]
> Công cụ trích xuất (chạy bằng `node` + `@tensorflow/tfjs-node`) chỉ cần chạy **một lần** khi bạn muốn trích xuất dữ liệu, nó không phải là một service chạy nền liên tục như `nextjs` hay `server`.
> Vì vậy, chúng ta sử dụng tính năng `profiles` của Docker Compose. Service này sẽ không tự động bật khi bạn chạy `docker-compose up`, mà chỉ chạy khi bạn gọi đích danh nó.

## Proposed Changes

### 1. Cập nhật Docker Compose gốc
#### [MODIFY] [docker-compose.yml](file:///D:/HOCTAP/Learn-Hub/docker-compose.yml)
- Thêm một service mới tên là `face_extractor`.
- Gắn `profiles: ["tools"]` để service này ẩn đi ở chế độ mặc định.
- Cấu hình volume map thư mục gốc `./` vào `/app` để đọc được `dataset/FER-2013` và ghi đè được file `client/src/lib/golden-face-dataset.ts`.
- Sử dụng base image `node:20-slim`.
- Cấu hình lệnh (command) để cài đặt thư viện và chạy script: `bash -c "npm install && node extract.js"`.

### 2. File Script (Tạo mới)
#### [NEW] `scripts/tfjs-extractor/package.json`
- Chứa các thư viện `@tensorflow/tfjs-node`, `@tensorflow-models/face-landmarks-detection`.
- Không nằm chung với package.json của web để tránh làm nặng dự án.

#### [NEW] `scripts/tfjs-extractor/extract.js`
- Chứa script đọc ảnh từ `/app/dataset/FER-2013`, trích xuất 468 điểm tọa độ khuôn mặt, chuẩn hóa và xuất thẳng ra file `/app/client/src/lib/golden-face-dataset.ts`.

## Verification Plan

### Manual Verification
1. Bạn chép ảnh vào thư mục `dataset/FER-2013/`.
2. Mở Terminal ở thư mục gốc `D:\HOCTAP\Learn-Hub` và chạy lệnh:
   ```bash
   docker-compose run --rm face_extractor
   ```
3. Docker sẽ tải `node:20-slim`, cài đặt TensorFlow và tự động chạy `extract.js`. Chạy xong container sẽ tự tắt (`--rm` sẽ xóa container đó đi, không gây tốn tài nguyên).
4. Kiểm tra file `client/src/lib/golden-face-dataset.ts` xem đã cập nhật chưa.
