# Kế hoạch Triển khai: Dạy AI học Gestures và Face với dữ liệu Kaggle

## Trả lời câu hỏi hiện tại
- Trang `/challenge/face`: **Có dùng model có sẵn**. Nó dùng `useMl5FaceMesh`, bọc lại pre-trained model FaceMesh của thư viện ml5.js / MediaPipe (Google) để lấy tọa độ 468 điểm trên mặt.
- Trang `/challenge/gestures`: **Có dùng model có sẵn**. Nó dùng `useMl5Handpose` để lấy tọa độ tay, sau đó dùng thuật toán "tự chế" tính toán góc/khoảng cách (trong file `hand-utils.ts`) để nhận diện cử chỉ, thay vì dùng một mô hình học máy (Machine Learning) phân loại riêng.

## Mục tiêu mới
Dựa trên thành công của trang `teach`, tạo ra 2 trang mới nơi **bé tự dạy AI (bằng KNN)** để nhận biết Cử chỉ (Gestures) và Cảm xúc khuôn mặt (Face). Điểm số bài nộp sẽ được chấm chéo tự động bằng 2 tập **Golden Dataset** lấy từ dữ liệu thật trên Kaggle.

---

## Proposed Changes

### 1. Dạy AI học Cử chỉ (Gestures)
Dựa trên bộ dữ liệu Kaggle đã tải trước đó (*Hand Gesture Landmarks*), chúng ta đã có sẵn các nhãn: `thumb` (Thích), `rock` (Nắm tay), `peace` (Chiến thắng), `open` (Xòe tay).

#### [NEW] [scripts/convert-kaggle-to-golden-gestures.py](file:///d:/HOCTAP/Learn-Hub/scripts/convert-kaggle-to-golden-gestures.py)
- Script Python đọc file `gesture_landmarks.csv` hiện có.
- Trích xuất 4 class: Thumbs Up (thumb), Fist (rock/close), Peace (peace), Open Hand (open).
- Áp dụng K-Medoids chọn 5-10 mẫu xuất sắc nhất mỗi class.
- Xuất ra file TypeScript: `client/src/lib/golden-gestures-dataset.ts`.

#### [NEW] [client/src/app/(private)/challenge/teach-gestures/page.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(private)/challenge/teach-gestures/page.tsx)
- Giao diện cho phép bé chụp hình 4 cử chỉ: 👍 Thích, ✊ Quyết Tâm, ✌️ Chiến Thắng, ✋ Chào Bạn.
- Khi nộp bài, so khớp mô hình KNN của bé với `GOLDEN_TEST_GESTURES_DATASET`.

### 2. Dạy AI học Cảm xúc Khuôn mặt (Face)
Để dạy khuôn mặt (Vui, Buồn, Ngạc nhiên), chúng ta cần một bộ dữ liệu từ Kaggle như **FER-2013** (Facial Expression Recognition) hoặc một bộ sưu tập ảnh người thật.
Vì dữ liệu Kaggle thường là *ảnh gốc (jpg/png)*, không phải tọa độ landmark có sẵn như bộ tay, quy trình sẽ khác một chút:

#### [NEW] [scripts/extract-face-landmarks.py](file:///d:/HOCTAP/Learn-Hub/scripts/extract-face-landmarks.py)
- Script Python yêu cầu cài đặt `pip install mediapipe opencv-python`.
- Đọc thư mục chứa vài chục tấm ảnh mẫu (Vui, Buồn, Bình thường) lấy từ Kaggle FER hoặc ảnh thật.
- Chạy thư viện Google MediaPipe FaceMesh bằng Python để trích xuất 468 điểm tọa độ từ các ảnh này.
- Chuẩn hóa (tịnh tiến về chóp mũi, chia cho kích thước mặt).
- Xuất ra file TypeScript: `client/src/lib/golden-face-dataset.ts`.

#### [NEW] [client/src/app/(private)/challenge/teach-face/page.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(private)/challenge/teach-face/page.tsx)
- Giao diện dùng `useMl5FaceMesh`.
- Cho phép bé làm nét mặt trước camera: 😀 Vui vẻ, 😢 Buồn bã, 😲 Ngạc nhiên.
- Dùng KNN phân loại 468 điểm (đã được chuẩn hóa) để nhận diện biểu cảm.
- Khi nộp bài, tính Test Score dựa trên `GOLDEN_TEST_FACE_DATASET`.

---

## User Review Required

> [!IMPORTANT]
> Với thử thách khuôn mặt (Face), bạn có muốn tôi viết một script Python tự động tải xuống dữ liệu ảnh từ Kaggle bằng Kaggle API không? Hay bạn muốn tự tải một dataset về máy (ví dụ FER-2013) rồi chạy script trích xuất tọa độ của tôi? Xin hãy xác nhận phương pháp bạn muốn với dữ liệu khuôn mặt.

> [!NOTE]
> Tôi có thể tiến hành viết trang `teach-gestures` và script xử lý `golden-gestures-dataset.ts` ngay bây giờ vì chúng ta đã có sẵn file CSV của phần Gestures. Bạn có đồng ý triển khai phần Gestures trước không?

## Verification Plan
1. Chạy các script Python để sinh ra 2 file `golden-*-dataset.ts`.
2. Truy cập thử `http://localhost:3000/challenge/teach-gestures` và `teach-face` để kiểm tra luồng train/test AI của bé.
3. Xác nhận KNN Model có thể nhận diện chính xác qua camera.
