# 🎓 Kế Hoạch Phát Triển Learn-Hub v2: Thu Dữ Liệu Đa Phương Thức + Giải Thích Điểm Số + Body Pose

## Tổng Quan

Kế hoạch toàn diện bao trùm **2 hướng phát triển** cho "Học Viện AI Nhí":

- **Hướng 1**: Nâng cấp thu dữ liệu (upload ảnh/video, quay video) → Teacher Training Mode → Template Dataset → Bài tập thể dục khung xương
- **Hướng 2**: Bảng Điều Khiển AI Tương Tác (chỉnh K, Ngưỡng tự tin, biểu đồ cân bằng) ngay trong lúc thu dữ liệu → Bé tự hiểu tại sao AI cho 68% hay 38%

> [!IMPORTANT]
> Tất cả thay đổi giữ nguyên kiến trúc Client (Next.js 16) + Server (NestJS 11). ml5.js v1.0.1 (CDN) vẫn là core AI engine.

---

## Phân Tích Hiện Trạng

### Thu dữ liệu hiện tại — CHỈ CÓ 1 cách

```
Camera real-time → Hold-to-capture (300ms/frame) → Extract keypoints → Lưu features + thumbnail
```

**Hạn chế**:
- Bắt buộc phải có camera hoạt động real-time
- Không thể dùng ảnh/video có sẵn
- Teacher phải ngồi trước camera để tạo mẫu
- Không thể import dataset từ bên ngoài
- Bé không thể chụp ảnh bằng điện thoại rồi upload lên

### Cách tính Test Score hiện tại

Trong [teach/page.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(private)/challenge/teach/page.tsx#L473-L517):

```
1. Lấy GOLDEN_TEST_DATASET (10 mẫu chuẩn: 5×"1 ngón", 5×"2 ngón")
2. Chạy KNN (k=3) với dữ liệu bé chụp làm training set
3. Đếm mẫu golden đoán đúng → % accuracy
4. Trừ phạt 2%/ảnh thiếu dưới ngưỡng 10/nhãn
```

**Vấn đề**: Bé chỉ thấy `68%` mà không hiểu tại sao. Cần cho bé tự chỉnh thông số (K, ngưỡng) ngay khi thu dữ liệu để hiểu từng chi tiết.

---

## User Review Required

> [!IMPORTANT]
> **Upload video**: Khi upload video hoặc quay video, hệ thống sẽ tự trích xuất frames (mỗi 300-500ms), chạy ml5 handPose/faceMesh/bodyPose trên từng frame để lấy keypoints. Bé sẽ thấy preview các frame được trích xuất và chọn xóa frame xấu. Bạn có đồng ý cách tiếp cận này?

> [!WARNING]
> **Xử lý video offline**: ml5.js cần chạy detect trên từng frame video. Với video 10 giây (30fps = 300 frames), việc detect sẽ mất ~30-60 giây. Cần hiển thị progress bar rõ ràng để bé không tưởng app bị treo.

> [!IMPORTANT]
> **Kích thước file upload**: Ảnh base64 rất nặng. Đề xuất: nén ảnh client-side trước khi extract features (resize xuống 640×480). Video không lưu nguyên bản — chỉ lưu frames đã trích xuất. Bạn đồng ý?

---

## Open Questions

> [!IMPORTANT]
> 1. **Upload từ điện thoại**: Bé có thể chụp ảnh trên điện thoại rồi upload trên máy tính? (Cần hỗ trợ `accept="image/*;capture=camera"` trên mobile)
> 2. **Giới hạn upload**: Tối đa bao nhiêu ảnh/video mỗi lần upload? Đề xuất: 50 ảnh hoặc 1 video 30 giây
> 3. **Định dạng video**: Hỗ trợ MP4 + WebM? Hay chỉ cần WebM (browser native recording)?

---

## Proposed Changes — 5 Phase

---

### Phase 1: Nâng Cấp Hệ Thống Thu Dữ Liệu Đa Phương Thức 🔴 (Ưu tiên cao nhất)

> Biến hệ thống thu dữ liệu từ "chỉ camera real-time" thành "3 phương thức linh hoạt" cho cả Student và Teacher.

#### Tổng quan 3 phương thức thu dữ liệu mới

```
┌─────────────────────────────────────────────────────────┐
│                  DataCollector Component                 │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ 📸 Camera │  │ 🖼️ Upload Ảnh│  │ 🎬 Upload/Quay Video│ │
│  │ Real-time │  │ File Picker  │  │  Record + Upload  │  │
│  │ (hiện có) │  │ + Drag-Drop  │  │  + Frame Extract  │  │
│  └─────┬─────┘  └──────┬───────┘  └────────┬──────────┘  │
│        │               │                   │             │
│        └───────────────┼───────────────────┘             │
│                        ▼                                 │
│              ml5 detect() trên mỗi frame                 │
│                        ▼                                 │
│              Extract keypoints + thumbnail               │
│                        ▼                                 │
│              StoredSample[] (cùng format)                 │
│                        ▼                                 │
│              Validation + Gallery Preview                 │
└─────────────────────────────────────────────────────────┘
```

**Điểm quan trọng**: Dù thu bằng cách nào, output đều là `StoredSample[]` (features + thumbnail + label + isValid) — giữ nguyên toàn bộ pipeline training/testing/scoring phía sau.

---

#### [NEW] [DataCollector.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/components/journey/DataCollector.tsx)

Component tổng hợp thay thế nút "GIỮ ĐỂ CHỤP 📸" hiện tại. UI dạng tab selector:

```
┌─────────────────────────────────────────────┐
│  [ 📸 Camera ]  [ 🖼️ Tải Ảnh ]  [ 🎬 Video ]  │
│─────────────────────────────────────────────│
│                                             │
│   (Nội dung thay đổi theo tab đang chọn)    │
│                                             │
└─────────────────────────────────────────────┘
```

**Props**:
```typescript
interface DataCollectorProps {
  mode: 'hand-1' | 'hand-2' | 'gesture' | 'emotion' | 'body-pose';
  activeClassId: string;
  activeClassLabel: string;
  classes: { id: string; label: string; emoji: string }[];
  // AI model refs (tùy mode)
  handsRef?: RefObject<HandResult[]>;
  allFacesRef?: RefObject<FaceKeypoint[][]>;
  posesRef?: RefObject<BodyPoseResult[]>;
  videoRef: RefObject<HTMLVideoElement | null>;
  modelStatus: 'loading' | 'ready' | 'error';
  // Callbacks
  onSamplesCollected: (newSamples: StoredSample[]) => void;
  // Optional
  goldenDataset?: GoldenTestSample[];
}
```

**Tab 1 — 📸 Camera Real-time** (giữ nguyên logic hiện tại):
- Nút "GIỮ ĐỂ CHỤP 📸" (hold-to-capture, 300ms/frame)
- Live skeleton overlay trên camera
- Validation real-time (finger count, golden distance)

**Tab 2 — 🖼️ Tải Ảnh Lên**:
- File picker: `<input type="file" accept="image/*" multiple />`
- Drag-and-drop zone với visual feedback
- Mobile support: `accept="image/*;capture=camera"` (mở camera native)
- Flow xử lý:
  ```
  1. Bé chọn ảnh (1 hoặc nhiều ảnh)
  2. Mỗi ảnh load vào <canvas> ẩn
  3. Chạy ml5.handPose.detect(canvas) / ml5.faceMesh.detect(canvas) / ml5.bodyPose.detect(canvas)
  4. Extract keypoints → normalize → tạo StoredSample
  5. Hiện preview gallery, đánh dấu ảnh nào detect thành công / thất bại
  6. Ảnh không detect được (không thấy tay/mặt/người): hiện cảnh báo "AI không thấy tay trong ảnh này! 🤔"
  7. Bé có thể xóa ảnh xấu trước khi confirm thêm vào dataset
  ```

**Tab 3 — 🎬 Video** (2 sub-mode):

**Sub-mode 3a: Quay Video Trực Tiếp**:
- Dùng `MediaRecorder` API ghi video từ camera stream hiện có
- Chất lượng video: **1280x720 HD**, codec VP8/VP9, bitrate **2.5 Mbps** (đảm bảo độ sắc nét cao cho ML model).
- Thời lượng: **Tối đa 60 giây**. Tự động hiển thị timer và dừng ghi khi hết 60 giây.
- Sau khi dừng → tự động chạy Frame Extraction.

**Sub-mode 3b: Upload Video Từ File**:
- File picker: `<input type="file" accept="video/mp4,video/webm,video/quicktime" />`
- Giới hạn thời lượng: **Tối đa 1 phút** (sẽ chỉ trích xuất khung hình trong 60s đầu tiên).

**Frame Extraction Pipeline** (chung cho cả 3a và 3b):
```
1. Load video vào <video> element ẩn (hoặc Blob URL)
2. Extract với tốc độ 2 fps (2 khung hình/giây), tối đa 120 khung hình (60 giây)
3. Draw frame vào <canvas> ẩn với độ phân giải HD 1280x720 (tự động resize giữ aspect ratio)
4. Tạo thumbnail chất lượng cao: crop giữa 240x240, nén JPEG quality 0.85
5. Chạy ml5.detect(canvas) cho từng frame
6. Hiện progress bar: "Đang phân tích video... 15/120 mẫu"
7. Cảnh báo tự động nếu có khung hình không nhận diện được (ví dụ: bị mờ/khuất)
8. Upload Cloudinary hỗ trợ lưu toàn bộ video (.webm/mp4) và frame (images) song song
```

**Progress UI cho video processing**:
```
┌──────────────────────────────────────────┐
│  🧠 AI Đang Phân Tích Video...           │
│                                          │
│  ████████████░░░░░░░░  60% (36/60 frames)│
│                                          │
│  ✅ Phát hiện tay: 30 frames             │
│  ⚠️ Không thấy tay: 6 frames            │
│  ⏳ Đang xử lý...                        │
└──────────────────────────────────────────┘
```

#### [NEW] [useMediaRecorder.ts](file:///d:/HOCTAP/Learn-Hub/client/src/hooks/useMediaRecorder.ts)

Hook quay video từ camera stream:

```typescript
export function useMediaRecorder(videoRef: RefObject<HTMLVideoElement | null>) {
  // Returns:
  return {
    isRecording: boolean,
    recordingDuration: number,     // giây
    startRecording: () => void,
    stopRecording: () => Promise<Blob>,
    recordedVideoUrl: string | null,
  };
}
```

- Ghi video dạng WebM (codec VP8/VP9)
- Giới hạn 30 giây (tự động dừng)
- Timer hiển thị real-time
- Output: Blob video để chạy frame extraction

#### [NEW] [useFrameExtractor.ts](file:///d:/HOCTAP/Learn-Hub/client/src/hooks/useFrameExtractor.ts)

Hook trích xuất frames từ video:

```typescript
export function useFrameExtractor() {
  return {
    isExtracting: boolean,
    progress: { current: number; total: number },
    extractedFrames: ExtractedFrame[],  // { imageData, timestamp, thumbnail }
    extractFrames: (videoSrc: string | Blob, intervalMs?: number) => Promise<ExtractedFrame[]>,
    cancel: () => void,
  };
}
```

- Seek video element đến từng timestamp
- Draw frame vào canvas → lấy imageData
- Tạo thumbnail (240×240 JPEG)
- Cancelable (bé có thể hủy giữa chừng)
- Memory-efficient: process từng frame, không load hết

#### [NEW] [useImageUpload.ts](file:///d:/HOCTAP/Learn-Hub/client/src/hooks/useImageUpload.ts)

Hook upload và xử lý ảnh:

```typescript
export function useImageUpload() {
  return {
    isProcessing: boolean,
    progress: { current: number; total: number },
    processImages: (files: FileList) => Promise<ProcessedImage[]>,
    // ProcessedImage: { originalFile, resizedCanvas, thumbnail }
  };
}
```

- Resize ảnh về 640×480 (giữ ratio) trước khi detect
- Xử lý EXIF orientation (ảnh từ điện thoại thường bị xoay)
- Batch processing với progress callback
- Hỗ trợ: JPEG, PNG, WebP

#### [NEW] [useOfflineDetector.ts](file:///d:/HOCTAP/Learn-Hub/client/src/hooks/useOfflineDetector.ts)

Hook chạy ml5 detect trên ảnh/frame (không phải real-time video):

```typescript
export function useOfflineDetector(mode: 'hand' | 'face' | 'body') {
  return {
    isReady: boolean,
    detect: (canvas: HTMLCanvasElement) => Promise<DetectResult>,
    // DetectResult: { keypoints, confidence, rawResult }
  };
}
```

- Load ml5 model (handPose/faceMesh/bodyPose) dạng "single detect" (không phải detectStart continuous)
- Dùng `model.detect(canvas)` thay vì `model.detectStart(video, callback)`
- Quan trọng: ml5 v1.0.1 hỗ trợ cả `detect()` (single frame) và `detectStart()` (continuous)
- Giữ model instance để reuse cho nhiều frames

#### [MODIFY] [TeachPanel.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/components/journey/TeachPanel.tsx)

**Thay đổi chính**: Tách phần capture ra khỏi TeachPanel, thay bằng `DataCollector`:

- Bỏ nút "GIỮ ĐỂ CHỤP 📸" cũ trong TeachPanel
- Thay bằng `<DataCollector>` component mới
- Giữ nguyên: class selector, gallery, train button, prediction loop
- TeachPanel trở thành "orchestrator" — DataCollector lo phần thu dữ liệu

#### [MODIFY] Tất cả trang teach (teach, teach-gestures, teach-face, teach-two-hands)

- Tích hợp DataCollector vào flow hiện tại
- Teacher page cũng dùng cùng DataCollector (nhưng có thêm nút "Lưu Template")

#### [MODIFY] [ml5.ts (types)](file:///d:/HOCTAP/Learn-Hub/client/src/types/ml5.ts)

Thêm types cho single-frame detect và bodyPose:

```typescript
// Thêm detect() method (single frame)
export type HandPoseModel = {
  detect?: (input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement) 
           => Promise<HandResult[]>;
  detectStart: (...) => void;
  detectStop?: () => void;
};

// Thêm BodyPose types
export type BodyKeypoint = {
  x: number; y: number; confidence?: number; name?: string;
};

export type BodyPoseResult = {
  keypoints?: BodyKeypoint[];
};

export type BodyPoseModel = {
  detect?: (input: HTMLVideoElement | HTMLCanvasElement) => Promise<BodyPoseResult[]>;
  detectStart: (video: HTMLVideoElement, callback: (results: BodyPoseResult[]) => void) => void;
  detectStop?: () => void;
};

// Cập nhật Ml5Module
export type Ml5Module = {
  handPose: (...) => HandPoseModel;
  faceMesh: (...) => Ml5FaceMeshModel;
  bodyPose: (options: {...}, callback: () => void) => BodyPoseModel;  // NEW
};
```

---

### Phase 2: Bảng Điều Khiển AI Tương Tác — Hiểu Ngay Khi Thu Dữ Liệu 🔴

> Cho bé **tự tay chỉnh thông số AI** (K, Ngưỡng tự tin) ngay trong lúc thu thập dữ liệu, để bé hiểu ngay lập tức tại sao AI cho kết quả 68% hay 38%. Không phải "giải phẫu" sau khi hoàn thành, mà là **khám phá trực tiếp trong quá trình học**.

#### Ý tưởng cốt lõi

```
┌─────────────────────────────────────────────────────────────────┐
│  Bé đang thu thập dữ liệu (Camera / Upload / Video)            │
│                                                                 │
│  ┌──────────────────────┐   ┌──────────────────────────────┐    │
│  │  📸 DataCollector     │   │  🧪 Bảng Điều Khiển AI       │    │
│  │  (Thu ảnh / video)    │   │                              │    │
│  │  Bé chụp thêm ảnh    │   │  Thanh trượt K: [==3==]      │    │
│  │  → Score cập nhật     │   │  Thanh trượt Ngưỡng: [=0%=]  │    │
│  │     NGAY LẬP TỨC     │   │  Biểu đồ cân bằng dữ liệu   │    │
│  │                      │   │  Bảng 10 câu test chi tiết    │    │
│  │                      │   │  Điểm: 68% → chỉnh K → 72%!  │    │
│  └──────────────────────┘   └──────────────────────────────┘    │
│                                                                 │
│  → Bé thấy: Chụp thêm 5 ảnh ngón 2 → score tăng từ 68→84%!    │
│  → Bé hiểu: Chỉnh K=1 → score 90% nhưng AI dễ sai. K=5 → ổn  │
│  → Bé hiểu: Ngưỡng tự tin 50% thì AI "liều lĩnh hơn"          │
└─────────────────────────────────────────────────────────────────┘
```

**Khác biệt so với cách làm thông thường:**
- ❌ Cách thông thường: Thu xong → Train xong → Hiện modal "Giải phẫu điểm số" → Bé đọc → Nộp bài
- ✅ Cách Learn-Hub: Bé thu dữ liệu + đồng thời thấy bảng điều khiển cập nhật theo thời gian thực → Bé chủ động thêm/xóa ảnh và chỉnh thông số → Bé tự khám phá tại sao score thay đổi

#### [NEW] [ScoreExplainer.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/components/journey/ScoreExplainer.tsx)

Component **bảng điều khiển AI tương tác** — hiển thị song song cùng DataCollector:

- **Điểm Test Score real-time**: Mỗi khi bé thêm/xóa ảnh, score tự tính lại ngay
- **Thanh trượt K (KNN)**: Chỉnh K=1→7, score tính lại real-time
  - Giải thích cho bé: "K=1: AI chỉ hỏi 1 bạn gần nhất → nhanh nhưng dễ sai. K=5: AI hỏi ý kiến 5 bạn → chậm hơn nhưng chắc chắn hơn"
  - Bé kéo thử và thấy score thay đổi → hiểu được ý nghĩa của K
- **Thanh trượt Confidence Threshold**: 0%→100%
  - AI chỉ chấm "đúng" khi confidence ≥ threshold
  - Bé hiểu: ngưỡng thấp → AI "liều" → đoán nhiều hơn nhưng cũng sai nhiều hơn
- **Bảng kết quả từng mẫu test**: 10 mẫu golden dạng card:
  - 🏷️ Nhãn đúng (expected) | 🤖 AI đoán | ✅/❌ | 📏 Khoảng cách KNN | 🎯 Confidence
  - Bé bấm mở rộng từng câu để xem chi tiết: "AI đoán sai vì 2 trong 3 hàng xóm gần nhất là nhãn khác"

#### [NEW] [DataBalanceWarning.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/components/journey/DataBalanceWarning.tsx)

Component cảnh báo mất cân bằng — hiện ngay trên giao diện thu dữ liệu:

- **Biểu đồ thanh**: nhãn 1 = 30 ảnh ████████, nhãn 2 = 10 ảnh ███
- **Cảnh báo trực quan**: "Nếu bé cho AI xem 30 ảnh mèo và 10 ảnh chó, AI hay đoán nhầm chó thành mèo!"
- Bé thấy biểu đồ lệch → chụp thêm ảnh nhãn thiếu → biểu đồ cân bằng → score tăng → Bé HIỂU!

#### [MODIFY] [knn-classifier.ts](file:///d:/HOCTAP/Learn-Hub/client/src/lib/knn-classifier.ts)

Thêm hàm mới:
- `classifyKNNDetailed()` — trả về distances, nearest neighbors, per-class counts
- `evaluateAgainstGolden(samples, goldenDataset, k, threshold)` — kết quả từng test case
- `analyzeDataBalance(samples)` — phân tích tỷ lệ mẫu giữa các nhãn

#### [MODIFY] Tất cả trang teach

- Nới lỏng `minSamplesPerClass`: 10 → 3 (cho train, cảnh báo khi < 10)
- Cho phép mất cân bằng (cảnh báo trực quan bằng biểu đồ, không block)
- Tích hợp ScoreExplainer ngay bên cạnh DataCollector (không phải modal riêng)
- Bé thay đổi dữ liệu hoặc thông số → kết quả cập nhật tức thì

---

### Phase 3: Chế Độ Teacher Training + Template Dataset 🟡

> Teacher dạy AI trước (bằng camera, upload ảnh, hoặc upload video), tạo bộ dữ liệu mẫu.

#### [NEW] [teacher/training/page.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(private)/teacher/training/page.tsx)

Teacher Training Mode — giao diện tương tự teach pages nhưng có thêm:
- **DataCollector** đầy đủ 3 phương thức (camera + upload ảnh + video)
- Nút "Lưu Làm Dữ Liệu Mẫu" (template)
- Ghi chú hướng dẫn cho bé
- Preview ScoreExplainer của dataset mình tạo
- Hỗ trợ tất cả mode: hand, gesture, emotion, body-pose

#### [NEW] [teacher/templates/page.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(private)/teacher/templates/page.tsx)

Quản lý Template Datasets — danh sách, preview, xuất bản.

#### [NEW] [TemplateViewer.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/components/journey/TemplateViewer.tsx)

Student xem mẫu Teacher — gallery, so sánh side-by-side, score.

#### Server Changes

##### [MODIFY] [datasets.entity.ts](file:///d:/HOCTAP/Learn-Hub/server/src/modules/datasets/datasets.entity.ts)

```typescript
@Column({ default: false })
isTemplate: boolean;

@Column({ type: 'text', nullable: true })
teacherNotes: string;

@Column({ default: false })
isPublished: boolean;

@Column({ type: 'varchar', nullable: true })
dataSourceType: string;  // 'camera' | 'image-upload' | 'video-upload' | 'video-record'
```

##### [MODIFY] [datasets.service.ts](file:///d:/HOCTAP/Learn-Hub/server/src/modules/datasets/datasets.service.ts) + [datasets.controller.ts](file:///d:/HOCTAP/Learn-Hub/server/src/modules/datasets/datasets.controller.ts)

Thêm endpoints template:

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | `/datasets/template` | JWT | teacher | Tạo template |
| PATCH | `/datasets/:id/publish` | JWT | teacher | Xuất bản |
| GET | `/datasets/templates/:challengeType` | JWT | Any | Lấy templates |

##### [MODIFY] [CreateDatasetDto](file:///d:/HOCTAP/Learn-Hub/server/src/modules/datasets/create-dataset.dto.ts)

Thêm fields: `isTemplate`, `teacherNotes`, `dataSourceType`

---

### Phase 4: 5 Bài Tập Thể Dục — Body Pose Detection 🟡

> ml5.bodyPose() (MoveNet) cho khung xương cơ thể. DataCollector hỗ trợ sẵn mode body-pose.

#### [NEW] [useMl5BodyPose.ts](file:///d:/HOCTAP/Learn-Hub/client/src/hooks/useMl5BodyPose.ts)

Hook tương tự useMl5Handpose nhưng dùng `ml5.bodyPose()`:

```typescript
export function useMl5BodyPose(
  videoRef: RefObject<HTMLVideoElement | null>,
  cameraActive: boolean,
  options: { maxPoses?: number }
) → { posesRef, modelStatus }
```

#### [NEW] [body-drawing.ts](file:///d:/HOCTAP/Learn-Hub/client/src/lib/body-drawing.ts)

Vẽ skeleton cơ thể — màu theo nhóm (đầu, tay, thân, chân).

#### [NEW] [body-pose-classifier.ts](file:///d:/HOCTAP/Learn-Hub/client/src/lib/body-pose-classifier.ts)

- `normalizeBodyKeypoints()` — chuẩn hóa (hip center = origin)
- `calculateJointAngles()` — tính góc khớp
- `validateBodyPose()` — validate dựa trên góc

#### [NEW] [body-exercises.ts](file:///d:/HOCTAP/Learn-Hub/client/src/lib/body-exercises.ts)

Định nghĩa 5 bài tập:

| # | Tên | Emoji | Số Tư Thế |
|---|-----|-------|-----------|
| 1 | Vươn Thở | 🧘 | 2 (V-arms up, Cross down) |
| 2 | Tay | 💪 | 2 (Shoulder level, Arms up) |
| 3 | Lườn | 🤸 | 3 (Center, Lean left, Lean right) |
| 4 | Bụng | 🏋️ | 3 (V-arms, Touch toes, Stand) |
| 5 | Chân | 🦿 | 4 (Wide stance, Squat left, Stand, Squat right) |

#### [NEW] [challenge/teach-body/page.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(private)/challenge/teach-body/page.tsx)

Trang dạy AI bài tập thể dục — dùng DataCollector (camera/upload/video).

#### [NEW] [challenge/body-exercise/page.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(private)/challenge/body-exercise/page.tsx)

Trang "chơi" — AI theo dõi bé tập, đếm lần đúng, gamification.

#### [NEW] [BodyTeachPanel.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/components/journey/BodyTeachPanel.tsx)

Panel reusable cho body pose teaching.

---

### Phase 5: Tích Hợp Journey Flow + UI/UX 🟢

#### [MODIFY] [journey-store.ts](file:///d:/HOCTAP/Learn-Hub/client/src/lib/journey-store.ts)

Thêm state body exercise.

#### [MODIFY] [home/page.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(private)/home/page.tsx)

Thêm Chapter 4: "Bé Tập Thể Dục Cùng AI" 🤸

#### [MODIFY] [concepts/[slug]/page.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(public)/concepts/[slug]/page.tsx)

Thêm slug `body-exercises`.

#### [MODIFY] [api.ts](file:///d:/HOCTAP/Learn-Hub/client/src/lib/api.ts)

Thêm template API methods.

---

## Tóm Tắt File Changes

### New Files (~20 files)

| File | Phase | Purpose |
|------|-------|---------|
| `components/journey/DataCollector.tsx` | 1 | Component thu dữ liệu 3 phương thức |
| `hooks/useMediaRecorder.ts` | 1 | Quay video từ camera |
| `hooks/useFrameExtractor.ts` | 1 | Trích xuất frames từ video |
| `hooks/useImageUpload.ts` | 1 | Upload và xử lý ảnh |
| `hooks/useOfflineDetector.ts` | 1 | ml5 detect trên ảnh/frame đơn lẻ |
| `components/journey/ScoreExplainer.tsx` | 2 | Giải thích điểm số chi tiết |
| `components/journey/DataBalanceWarning.tsx` | 2 | Cảnh báo mất cân bằng |
| `app/teacher/training/page.tsx` | 3 | Teacher training mode |
| `app/teacher/templates/page.tsx` | 3 | Quản lý templates |
| `components/journey/TemplateViewer.tsx` | 3 | Student xem mẫu Teacher |
| `hooks/useMl5BodyPose.ts` | 4 | Body pose detection |
| `lib/body-drawing.ts` | 4 | Vẽ skeleton cơ thể |
| `lib/body-pose-classifier.ts` | 4 | Phân loại tư thế |
| `lib/body-exercises.ts` | 4 | Định nghĩa 5 bài tập |
| `app/challenge/teach-body/page.tsx` | 4 | Dạy AI bài tập thể dục |
| `app/challenge/body-exercise/page.tsx` | 4 | Chơi bài tập với AI |
| `components/journey/BodyTeachPanel.tsx` | 4 | Panel body pose teaching |
| `app/concepts/body-exercises/page.tsx` | 5 | Concept slides |

### Modified Files (~12 files)

| File | Phase | Changes |
|------|-------|---------|
| `components/journey/TeachPanel.tsx` | 1,2 | Tách capture → DataCollector, nới lỏng constraints |
| `types/ml5.ts` | 1,4 | Thêm detect(), BodyPose types |
| `app/challenge/teach/page.tsx` | 1,2 | DataCollector + ScoreExplainer |
| `app/challenge/teach-gestures/page.tsx` | 1,2 | DataCollector + ScoreExplainer |
| `app/challenge/teach-face/page.tsx` | 1,2 | DataCollector + ScoreExplainer |
| `app/challenge/teach-two-hands/page.tsx` | 1,2 | DataCollector + ScoreExplainer |
| `lib/knn-classifier.ts` | 2 | Thêm detailed classification |
| `app/teacher/page.tsx` | 3 | Link đến training/templates |
| `lib/journey-store.ts` | 5 | Thêm body exercise state |
| `app/(private)/home/page.tsx` | 5 | Chapter 4 |
| `app/(public)/concepts/[slug]/page.tsx` | 5 | Slug body-exercises |
| `lib/api.ts` | 3,5 | Template API |
| Server: `datasets.*` | 3 | Template support + dataSourceType |

---

## Thứ Tự Triển Khai

| Phase | Ưu tiên | Trạng thái | Phụ thuộc |
|-------|---------|------------|-----------|
| **Phase 1**: DataCollector | ✅ Hoàn thành | Done | Không |
| **Phase 2**: Bảng Điều Khiển AI Tương Tác | ✅ Hoàn thành | Done | Phase 1 |
| **Phase 3**: Teacher Templates | ✅ Hoàn thành | Done | Phase 1 |
| **Phase 4**: Body Exercises (nền tảng) | ✅ Hoàn thành | Done | Phase 1 |
| **Phase 5**: Journey Integration | 🟢 Cuối | Chưa | Phase 3+4 |
| **Phase 6**: Google OAuth + Google Drive | 🟡 Mới | Chưa | Phase 3 |

> [!TIP]
> Phase 1-4 đã hoàn thành. Phase 5 và 6 có thể triển khai song song.

---

### Phase 6: Đăng Nhập Google + Lưu Media Lên Google Drive 🟡 (Mới)

> Cho phép người dùng đăng nhập bằng tài khoản Google, và tự động lưu ảnh/video huấn luyện lên Google Drive cá nhân.

#### 6.1 Google OAuth Login

##### Server Changes

###### [NEW] `google.strategy.ts` (`server/src/modules/auth/strategies/google.strategy.ts`)

Passport strategy cho Google OAuth2:

```typescript
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['email', 'profile', 'https://www.googleapis.com/auth/drive.file'],
    });
  }
}
```

- Scope `drive.file`: app chỉ quản lý file do chính nó tạo trên Drive
- Cần cài: `npm install passport-google-oauth20 @types/passport-google-oauth20`

###### [MODIFY] `auth.controller.ts`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/google` | Redirect đến Google OAuth consent screen |
| GET | `/auth/google/callback` | Google callback → tạo/cập nhật user → trả JWT |

###### [MODIFY] `user.entity.ts`

```typescript
@Column({ nullable: true }) googleId: string;
@Column({ nullable: true }) googleAccessToken: string;
@Column({ nullable: true }) googleRefreshToken: string;
@Column({ nullable: true }) avatarUrl: string;
```

###### [NEW] `.env` variables

```
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
```

##### Client Changes

###### [MODIFY] `login/page.tsx` + `register/page.tsx`

- Thêm nút "Đăng nhập bằng Google" với Google brand icon
- Click → redirect đến `GET /auth/google`

#### 6.2 Lưu Ảnh & Video Lên Google Drive

##### Server: [NEW] `google-drive.service.ts`

```typescript
@Injectable()
export class GoogleDriveService {
  async ensureAppFolder(accessToken: string): Promise<string>;
  async uploadImage(accessToken: string, data: Buffer, name: string): Promise<string>;
  async uploadVideo(accessToken: string, data: Buffer, name: string): Promise<string>;
  async refreshToken(refreshToken: string): Promise<string>;
}
```

- Cài: `npm install googleapis`
- Tạo folder `Learn-Hub/datasets/{challengeType}/` trên Drive cá nhân
- Trả về shareable Google Drive URL

##### Client: [NEW] `hooks/useGoogleDrive.ts`

```typescript
export function useGoogleDrive() {
  return {
    isConnected: boolean,
    uploadMedia: (file, folder) => Promise<string>,
    disconnect: () => void,
  };
}
```

> [!IMPORTANT]
> Cần tạo project trên Google Cloud Console: bật OAuth2 API + Drive API, tạo consent screen, tạo Client ID.

---

## Verification Plan

### Automated Tests
```bash
cd server && npm run test
cd client && npm run build
```

### Manual Verification

**Phase 1:** Camera capture, Upload ảnh (detect thành công/thất bại), Quay video 60s, Upload video MP4 HD
**Phase 2:** Bảng Điều Khiển AI tương tác ngay khi thu dữ liệu: K slider, confidence threshold, biểu đồ cân bằng cập nhật real-time
**Phase 3:** Teacher tạo template → Xuất bản → Student xem qua TemplateViewer
**Phase 4:** Body skeleton trên camera → Thu mẫu → Train → Test
**Phase 6:** Google OAuth login → Upload ảnh/video → Verify trên Google Drive cá nhân


---

## Verification Plan

### Automated Tests
```bash
cd server && npm run test
cd client && npm run build
```

### Manual Verification

**Phase 1:**
1. Camera capture: Giữ nút → chụp → verify samples tạo đúng
2. Upload ảnh: Chọn 5 ảnh tay → verify ml5 detect + extract features thành công
3. Upload ảnh xấu (ảnh phong cảnh): Verify cảnh báo "Không thấy tay"
4. Quay video 10s → verify frame extraction + progress bar
5. Upload video MP4 → verify extraction
6. Mobile: Mở trên điện thoại → verify file picker mở camera native

**Phase 2:**
7. Train với 30 ảnh nhãn 1 + 10 ảnh nhãn 2 → ScoreExplainer hiện cảnh báo mất cân bằng
8. Chỉnh K slider → score thay đổi real-time
9. Train với 3 ảnh/nhãn → confirm được train + warning

**Phase 3:**
10. Login Teacher → Tạo template (upload ảnh) → Xuất bản → Login Student → Xem template

**Phase 4:**
11. Mở teach-body → Camera body skeleton hiển thị → Thu mẫu → Train → Test
