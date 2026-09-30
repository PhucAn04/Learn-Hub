# Báo Cáo Tổng Thể Kỹ Thuật: Migration Loại Bỏ `any` Type (Chuẩn Bị Cho MLOps)

**Ngày thực hiện**: 28/07/2026
**Mục tiêu**: Loại bỏ 100% việc sử dụng `any` type (bao gồm `: any`, `as any`, `<any[]>`, `Promise<any>`) trên cả hai môi trường Client (Next.js) và Server (NestJS). Bước này nhằm thiết lập nền tảng Type Safety cực kỳ nghiêm ngặt, dọn đường cho việc triển khai hệ thống MLOps và các tính năng AI phức tạp sau này mà không lo ngại về lỗi dữ liệu ngầm.

---

## 1. Triết Lý & Chiến Lược Refactor

Thay vì chỉ sửa lỗi linter cho qua chuyện, đợt refactor này đã tái cấu trúc lại cách hệ thống nhận diện và trao đổi dữ liệu:
- **Shared Types là cốt lõi**: Mọi payload đi qua API đều phải được ánh xạ qua một Interface hoặc Type đã được định nghĩa rõ ràng. Không còn các API trả về object ẩn danh.
- **Bao bọc (Encapsulate) thư viện ngoài**: Các thư viện ML được load qua CDN (như TensorFlow.js, ml5.js) vốn không có type declaration chuẩn trên môi trường Next.js hiện tại, đã được bao bọc bằng các Custom Interfaces tự định nghĩa thay vì dùng biến `any` lỏng lẻo.
- **Strict Data Casting**: Tại những nơi dữ liệu trả về linh động (như tọa độ pose/hand), thay vì ép kiểu `as any` để lấy thuộc tính, chúng ta ép kiểu cụ thể về cấu trúc cần thiết (ví dụ: `as { x: number; y: number, z?: number }[]`).

---

## 2. Chi Tiết Các Mẫu (Patterns) Thay Thế `any`

Để thuận tiện cho việc maintenance sau này, dưới đây là các giải pháp đã áp dụng để thay thế `any`:

### 2.1. API Responses & Database Entities
**Trước đây:** Thường dùng `Promise<any>` hoặc gán trực tiếp `data: any`.
**Bây giờ:**
- Sử dụng các model chuẩn đã định nghĩa tại `client/src/types/models.ts` và `server/src/shared/types/index.ts`.
- Các Type chính bao gồm: `DatasetResponse`, `SubmissionResponse`, `UserProfile`, `LeaderboardEntry`, `TrainingSample`, `CustomClass`, `TeacherTemplate`.

### 2.2. Object Linh Động (Dynamic Objects)
**Trước đây:** `metadata: any`, `options: any`.
**Bây giờ:** 
- Sử dụng `Record<string, unknown>` để biểu diễn một object có key là string nhưng value chưa rõ ràng. Bắt buộc developer phải kiểm tra kiểu dữ liệu (type-checking) trước khi trích xuất giá trị từ object này.
- Ví dụ: Thay `options?: any` bằng `options?: Record<string, unknown>` (trong `ml5.ts`).

### 2.3. ML Libraries từ CDN (TensorFlow, Ml5)
**Trước đây:** Dùng `window.ml5` dưới dạng `any` hoặc khai báo `declare const tf: any;`.
**Bây giờ:**
- Định nghĩa các interface đại diện (Proxy Interfaces) với các phương thức/thuộc tính chúng ta thực sự sử dụng.
- Đối với **Ml5**: Có `Ml5Module`, `Ml5DetectorInstance` (gồm `HandPoseModel`, `Ml5FaceMeshModel`, `BodyPoseModel`).
- Đối với **TensorFlow**: Định nghĩa `TFStatic`, `TFLayersModel`, `TFTensor` phục vụ cho logic huấn luyện KNN và Neural Network tại `tf-trainer.ts`.
- Mở rộng đối tượng `Window` an toàn thông qua interface như `Ml5Window` hay `AudioContextWindow`.

---

## 3. Nhật Ký Chi Tiết Các File Đã Thay Đổi (Changelog)

### Tầng Shared (Client & Server)
- **`server/src/shared/types/index.ts`** & **`client/src/types/models.ts`**:
  - Tạo mới và củng cố toàn bộ hệ thống Interface. Đây là **Source of Truth** cho cả dự án.

### Tầng Server (NestJS)
- **`server/src/modules/progress/progress.service.ts`**:
  - Cập nhật hàm `getLeaderboard` trả về `Promise<LeaderboardEntry[]>`.
  - Fix logic mapping để đảm bảo đối tượng trả về chứa đúng các key `score`, `highScore` khớp với `LeaderboardEntry`.
- **`server/src/modules/submissions/submissions.service.ts`**:
  - Định kiểu trả về `Promise<Submission[]>` cho `getAllSubmissions()`.
- **NestJS DTOs & Entities (Datasets, Submissions)**:
  - Khắc phục lỗi **TS1272 Decorator Metadata** (NestJS không nhận diện được type phức tạp) bằng cách giới hạn sử dụng custom interfaces bên trong file hoặc ép sang `Record` inline.

### Tầng Client (Next.js & ML Services)
#### A. State Management trong Pages
- **Các trang Challenge (`face/page.tsx`, `fingers/page.tsx`, `gestures/page.tsx`, `body-exercise/page.tsx`)**:
  - `const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);`
- **Các trang Teach AI (`teach-*.tsx`)**:
  - `const [teacherTemplate, setTeacherTemplate] = useState<DatasetResponse | null>(null);`
- **Các trang Profile / Dashboard**:
  - Trang Profile thay `any` bằng `UserProfile | null`.
  - Trang lịch sử mẫu thử (Student History / Teacher Datasets) cập nhật `expandedSamples` thành `useState<StoredSample[] | null>`.

#### B. Component Props & Xử Lý Keypoints
- **`BodyTeachPanel.tsx` / `TeachPanel.tsx` / `DataCollector.tsx`**:
  - Xóa toàn bộ việc dùng `as any` khi lấy pose data.
  - Sửa `pose.keypoints as any` thành `pose.keypoints as { x: number; y: number }[]`.
  - Sửa `(faces[0] as any).keypoints` thành logic gọi method type-safe an toàn hơn (như sử dụng helper function hoặc interface).
  - Prop `mode` truyền vào `DataCollector` xóa bỏ ép kiểu linh tinh.

#### C. Hook & Utils
- **`useOfflineDetector.ts`**:
  - `modelRef` được định nghĩa chính xác loại model đang giữ: `useRef<Ml5DetectorInstance | null>(null)`.
- **`ml5-loader.ts`**:
  - Hàm `loadMl5` chuyển từ trả về Promise của `any` sang Promise của `Ml5Module`.
- **`tf-trainer.ts`**:
  - Biến instance `this.tf` được định kiểu `TFStatic`. Thêm các Type Guards để đảm bảo TensorFlow đã khởi tạo trước khi gọi `predictSync()` hoặc `addExample()`.
- **`body-drawing.ts`**:
  - Xử lý object map màu sắc bằng cách cast an toàn: `(opts as Record<string, string | number>)[colorKey]`.

---

## 4. Các Lỗi Liên Quan Được Giải Quyết (Side-effects Fixed)

Trong quá trình thay thế type, đợt refactor cũng đã phát hiện và vá một số lỗi logic ngầm:
1. **Lỗi Cascading Renders ở `teach-body/page.tsx`**:
   - Vấn đề: `useEffect` gọi `setState` đồng bộ ngay lập tức khi render, gây ra loop warning của React.
   - Xử lý: Áp dụng cờ `let ignore = false;`, đưa hàm fetch dữ liệu thành bất đồng bộ (async), và thêm logic dọn dẹp (cleanup function) `return () => { ignore = true; }`.
2. **Lỗi Unescaped JSX**:
   - Vấn đề: Dấu ngoặc kép `"` trong đoạn text tiếng Anh ở UI gây ra lỗi biên dịch Next.js linter.
   - Xử lý: Thay thế bằng HTML Entity `&quot;`.

---

## 5. Hướng Dẫn Maintenance (Dành Cho Các Bản Cập Nhật Tương Lai)

Để đảm bảo dự án không bị thoái hóa về `any` type sau này, đội ngũ phát triển cần tuân thủ:

### 5.1. Khi Thêm Một ML Model Mới
1. **Không dùng `any` cho output của Model**.
2. Hãy vào `client/src/types/ml5.ts` hoặc tạo file type riêng cho model đó, định nghĩa output dựa theo documentation của thư viện.
3. Cập nhật `Ml5DetectorInstance` type.

### 5.2. Khi Gọi API Mới / Thêm Field Vào Database
1. Dữ liệu response phải có interface tương ứng đặt tại `server/src/shared/types/index.ts`.
2. Interface này sẽ được copy/đồng bộ hoặc import thẳng vào Client (`client/src/types/models.ts`).
3. Nếu server trả về một object động chưa fix cấu trúc, BẮT BUỘC dùng `Record<string, unknown>`.

### 5.3. Quy Tắc Đối Với Các Thư Viện Thiếu Type Declaration
Nếu bạn cài một package từ npm mà không có `@types/xxx`, **TUYỆT ĐỐI KHÔNG** dùng `declare module 'xxx' { const content: any; export default content; }`.
Hãy tự định nghĩa các hàm/biến mà dự án đang dùng bên trong module đó với kiểu dữ liệu chính xác nhất có thể (dù chỉ là vài hàm).

---
*Báo cáo này được tự động thiết lập và lưu trữ như một reference point cho các bước chuẩn bị trước MLOps của Learn-Hub.*
