# Walkthrough: Loại bỏ `any` types & Chuẩn hóa Type Safety (Learn-Hub)

## Tổng quan

Đã thực hiện **Deep Scan** tìm kiếm toàn bộ các biến thể của `any` (`: any`, `<any[]>`, `as any`, `useRef<any>`, `Promise<any>`) trên toàn bộ codebase `client/src` và `server/src` và loại bỏ hoàn toàn **100%**. Đồng thời khắc phục các cảnh báo React/JSX linter.

## Kết quả Verification

| Target | Build Status | Grep `any` Types |
|--------|--------------|------------------|
| **Client** (Next.js 16) | ✅ **PASS** (28/28 routes) | **0** trong source code |
| **Server** (NestJS) | ✅ **PASS** (`nest build`) | **0** trong source code |

---

## Chi tiết các vị trí đã refactor

### 1. Shared Types & Type Infrastructure
- `client/src/types/models.ts`:
  - Khai báo đầy đủ `DatasetResponse`, `ModelResponse`, `SubmissionResponse`, `UserProfile`, `LeaderboardEntry`, `TeacherTemplate`, `CustomClass`, v.v.
  - Định nghĩa interface chuẩn cho CDN TensorFlow.js (`TFStatic`, `TFLayersModel`, `TFTensor`).
- `server/src/shared/types/index.ts`:
  - Khai báo các interface dùng chung trên backend: `LeaderboardEntry`, `SubmissionDataset`, `TrainingSample`, `GoogleOAuthProfile`, `CustomClass`.

### 2. Challenge & Training Pages (`client/src/app/(private)/challenge/`)
- `face/page.tsx`:
  - `leaderboard`: `useState<LeaderboardEntry[]>([])` (thay cho `any[]`)
  - `teacherTemplate`: `useState<DatasetResponse | null>(null)` (thay cho `any`)
- `body-exercise/page.tsx`:
  - `leaderboard`: `useState<LeaderboardEntry[]>([])`
- `fingers/page.tsx`:
  - `leaderboard`: `useState<LeaderboardEntry[]>([])`
- `gestures/page.tsx`:
  - `leaderboard`: `useState<LeaderboardEntry[]>([])`
- `teach/page.tsx`, `teach-gestures/page.tsx`, `teach-two-hands/page.tsx`, `teach-face/page.tsx`, `teach-body/page.tsx`:
  - `teacherTemplate`: `useState<DatasetResponse | null>(null)`
  - Sửa `useEffect` reset state bất đồng bộ tránh cascading renders.
  - Escape ký tự `"` trong JSX (`&quot;`).

### 3. Management & Profile Pages
- `profile/student/page.tsx`:
  - `currentUser`: `useState<UserProfile | null>(null)`
  - Safe null check cho `currentUser.createdAt`
- `student/history/[challengeType]/page.tsx`:
  - `expandedSamples`: `useState<StoredSample[] | null>(null)`
- `teacher/datasets/[challengeType]/page.tsx`:
  - `expandedSamples`: `useState<StoredSample[] | null>(null)`
- `teacher/templates/page.tsx`:
  - `templates`: `useState<DatasetResponse[]>([]);`

### 4. Components & UI Elements
- `Navbar.tsx`:
  - `currentUser`: `useState<UserProfile | null>(null)`
- `BodyTeachPanel.tsx`:
  - `calculateROI` keypoints cast: `pose.keypoints as { x: number; y: number }[]`
  - `DataCollector` mode prop: `mode={mode}` (xóa `as any`)
  - `teacherTemplate` prop type: `TeacherTemplate | DatasetResponse`
- `TeachPanel.tsx`:
  - `calculateROI` keypoints cast: `keypoints as { x: number; y: number }[]`
  - `DataCollector` mode prop: `mode={mode}`
  - `teacherTemplate` prop type: `TeacherTemplate | DatasetResponse`
- `DataCollector.tsx`:
  - `calculateROI` keypoints casts: `as { x: number; y: number }[]`
  - `getFaceKeypoints` thay thế `(faces[0] as any).keypoints`

### 5. Utilities & Hooks
- `useOfflineDetector.ts`:
  - `modelRef`: `useRef<Ml5DetectorInstance | null>(null)` (với `Ml5DetectorInstance = HandPoseModel | Ml5FaceMeshModel | BodyPoseModel`)
- `ml5-loader.ts`:
  - `loadMl5()`: `Promise<Ml5Module>` (thay cho `Promise<any>`)
- `audio.ts`:
  - WebKit AudioContext type helper: `(window as AudioContextWindow).webkitAudioContext`
- `body-drawing.ts`:
  - Options color lookup: `(opts as Record<string, string | number>)[colorKey]`
- `tf-trainer.ts`:
  - Non-null guards cho `this.tf` sau `init()`
  - Thêm `predictSync()` phục vụ vòng lặp `requestAnimationFrame`

### 6. Backend Server (`server/src/`)
- `progress.service.ts`:
  - `getLeaderboard()` return type: `Promise<LeaderboardEntry[]>`
  - Mapping return object chuẩn hóa `score` & `highScore`
- `submissions.service.ts`:
  - `getAllSubmissions()` return type: `Promise<Submission[]>`
- NestJS DTOs & Entities:
  - Khắc phục lỗi TS1272 Decorator Metadata bằng cách sử dụng inline `Record` types cho các thuộc tính có decorator.
