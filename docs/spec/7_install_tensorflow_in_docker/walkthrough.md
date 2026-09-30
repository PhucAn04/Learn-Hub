# Hướng dẫn sử dụng TF.js Extractor (Docker)

Tôi đã thiết lập xong hệ thống trích xuất tọa độ khuôn mặt thuần túy bằng JavaScript, chạy bên trong môi trường Docker cách ly. Bằng cách này, bạn có thể xử lý hàng chục ngàn bức ảnh thô một cách an toàn mà không làm "bẩn" máy tính bởi các thư viện cài đặt dư thừa.

## Kiến trúc thư mục mới

Các file xử lý đã được đặt trong `scripts/tfjs-extractor`:
- `Dockerfile`: Môi trường `node:20-slim`.
- `docker-compose.yml`: Quản lý việc kết nối ổ đĩa chứa `dataset` (ảnh thô) và thư mục `output` (nơi xuất file `.ts`).
- `package.json`: Chứa `@tensorflow/tfjs-node` và `@tensorflow-models/face-landmarks-detection`.
- `extract.js`: Mã nguồn lõi dùng `tf.node.decodeImage()` đọc ảnh, lấy 468 điểm mốc khuôn mặt và tự động tạo ra file TypeScript.

## Các bước chạy

### Bước 1: Chuẩn bị ảnh
Do thư mục dataset cũ đã bị xóa cho nhẹ máy, bạn cần tải lại ảnh thô FER-2013 và xếp theo cấu trúc:
```text
D:\HOCTAP\Learn-Hub\
├── dataset\
│   └── FER-2013\
│       ├── happy\
│       │   ├── image1.jpg
│       │   └── ...
│       ├── sad\
│       └── surprise\
```

### Bước 2: Chạy công cụ (Bằng Docker)
Mở Terminal, di chuyển vào thư mục `scripts/tfjs-extractor` và chạy:
```bash
cd D:\HOCTAP\Learn-Hub\scripts\tfjs-extractor
docker compose up --build
```

### Quá trình hoạt động
1. Docker sẽ tự động tải `node:20-slim` và cài đặt `tfjs-node` một cách gọn gàng.
2. Script sẽ bắt đầu đọc từng tấm ảnh của từng cảm xúc.
3. Module lõi `tfjs-node` sẽ đẩy ảnh lên xử lý với mô hình *MediaPipeFaceMesh* của TensorFlow.js.
4. Nó tự động cân chỉnh độ phân giải về 192x192, trích xuất điểm mốc, tịnh tiến và chuẩn hóa tọa độ.
5. Cuối cùng, 20 ảnh tốt nhất đại diện cho mỗi cảm xúc sẽ được xuất trực tiếp đè vào file `client/src/lib/golden-face-dataset.ts`.

> [!TIP]
> Bạn có thể yên tâm chạy lại script này bất cứ khi nào bạn có thêm bộ ảnh mới. Máy tính của bạn sẽ không bị "nặng" thêm chút nào vì sau khi chạy xong, toàn bộ môi trường thực thi sẽ tự giải phóng. Mọi thứ diễn ra bên trong không gian chứa của Docker.
