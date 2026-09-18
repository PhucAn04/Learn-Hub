# Task List: Triển Khai Implementation Plan

> Cập nhật: 10/08/2026 23:48

## Phase 1: Nền Tảng Dữ Liệu (Backend) ✅
- [x] 1.1 Mở rộng Model Entity (version, parentModelId, evaluation JSON)
- [x] 1.2 Mở rộng Models Service (updateModelArtifacts, getModelChain)
- [x] 1.3 Mở rộng Models Controller (DTO, endpoints mới)
- [x] 1.4 Tạo Action Log Module (entity + service + controller)
- [x] 1.5 Tạo Assessment Module (entity + service + controller)
- [x] 1.6 Đăng ký modules mới trong app.module.ts

## Phase 2: Evaluation Engine (Client Logic) ✅
- [x] 2.1 Tạo confusion-matrix.ts (buildConfusionMatrix)
- [x] 2.2 Tạo model-comparison.ts (compareVersions)
- [x] 2.3 Tạo skill-assessment.ts (computeAssessment)
- [x] 2.4 Mở rộng API Client (api.ts) — methods mới
- [x] 2.5 Mở rộng Types (models.ts) — interfaces mới

## Phase 3: UI — Trải Nghiệm Học Sinh ✅
- [x] 3.1 DataHealthDashboard component
- [x] 3.2 ReportCard component (star rating, gallery ảnh, dẫn chứng cụ thể)
- [x] 3.3 useModelEvaluation hook (reusable evaluation pipeline)
- [x] 3.4 Tích hợp vào teach/page.tsx
- [x] 3.5 Tích hợp vào teach-two-hands/page.tsx
- [x] 3.6 Tích hợp vào teach-face/page.tsx
- [x] 3.7 Tích hợp vào teach-gestures/page.tsx

## Phase 4: UI — Teacher Dashboard Nâng Cao ✅
- [x] 4.1 Mở rộng teacher/page.tsx (thêm cột "Chi tiết" + link Xem)
- [x] 4.2 Student Detail Page (biểu đồ tiến trình + danh sách versions)
- [x] 4.3 Model Version Detail Page (confusion matrix + quality + diff + logs + feedback)

## Phase 5: Sửa Lỗi & Kiến Trúc Hook React 19 ✅
- [x] 5.1 Fix Multer global type declaration (`express-multer.d.ts`)
- [x] 5.2 Fix cloudinary callback signature & Error wrapping
- [x] 5.3 Fix datasets.service.ts type assertion
- [x] 5.4 Tạo usePageData hook (unified fetching, React 19 compliant)
- [x] 5.5 Tạo useAsyncFetch hook (generic async fetch, React 19 compliant)
- [x] 5.6 Refactor 5 teacher pages sang usePageData
- [x] 5.7 Derived state `activeStudent` (xóa useEffect auto-select)
- [x] 5.8 Fix React 19 `react-hooks/refs` (move ref mutation to useEffect)
- [x] 5.9 Fix React 19 `react-hooks/set-state-in-effect` (queueMicrotask)
- [x] 5.10 Fix ESLint `...deps` spread in dependency arrays (depsKey serialization)
- [x] 5.11 Remove unused useEffect import in datasets/[challengeType]/page.tsx

## Verification ✅
- [x] Backend TypeScript build ✅ (exit code 0)
- [x] Client TypeScript build ✅ (exit code 0)
- [x] Database: synchronize: true → auto-create tables on startup

---

## Phase 6: Hoàn Thiện UI Componentization & Luồng ✅

### 6A. UI Components (Đã Tách Rời)
- [x] 6A.1 Tách `ProgressChart.tsx` từ `students/[userId]/page.tsx`
- [x] 6A.2 Tách `SkillSummary.tsx` từ `students/[userId]/page.tsx`
- [x] 6A.3 Tách `ConfusionMatrixViewer.tsx` từ `models/[modelId]/page.tsx`
- [x] 6A.4 Tách `DatasetSnapshotViewer.tsx` từ `models/[modelId]/page.tsx`
- [x] 6B.1 Tạo các UI Component tái sử dụng
  - [x] `ProgressChart` (SVG based chart)
  - [x] `SkillSummary` (Biểu đồ tròn điểm tổng quát + thanh phần trăm kỹ năng)
  - [x] `ConfusionMatrixViewer` (Thanh bar cho độ chính xác từng nhãn, highlight weakestLabel)
  - [x] `DatasetSnapshotViewer` (Hiển thị điểm số Quality, Cân bằng, Mờ, Tối)
  - [x] `VersionDiff` (Cho Teacher so sánh V(n) với V(n-1))
  - [x] `VersionComparison` (Dành cho Student so sánh V(n) với V(n-1))
- [x] 6B.2 Hoàn thiện luồng Nộp bài (Feedback Loop)
  - [x] Sửa nút "Nộp Luôn" (Finalize) để tự động gọi `computeAssessment()` và lưu Entity
  - [x] Sửa nút "Sửa bài & Nộp lại" (Revise) để quay lại TeachPanel giữ nguyên trạng thái
- [x] 6C.1 `validateTeacherTemplate()` — kiểm tra chất lượng template GV trước khi publish

## Phase 7: Rà Soát Sâu & Chuẩn Hóa Type (Deep Check) ✅
- [x] 7.1 Cập nhật logic `handleFinalize` cho toàn bộ 4 game (`teach`, `teach-gestures`, `teach-face`, `teach-two-hands`) để đồng bộ lưu Assessment.
- [x] 7.2 Sửa lỗi `AssessmentResponse` thay thế cho `any` ở component `SkillSummary` và ép kiểu map parameters.
- [x] 7.3 Sửa lỗi Type Validation `any` trong `teacher/students/[userId]/page.tsx` và `teach/page.tsx` thông qua ép kiểu toàn diện.
- [x] 7.4 Khắc phục cảnh báo `react-hooks/set-state-in-effect` ở các store và hook tfjs thông qua `queueMicrotask` cho chuẩn React 19.
- [x] 7.5 Chạy `npx tsc --noEmit` thành công hoàn toàn (Exit code 0).
