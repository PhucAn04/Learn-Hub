# Learn-Hub v2 — Task List

## Foundation Layer
- [x] Update `types/ml5.ts` — Add detect(), BodyPose types
- [x] Create `lib/body-exercises.ts` — 5 bài tập thể dục definitions
- [x] Create `lib/body-drawing.ts` — Vẽ skeleton cơ thể
- [x] Create `lib/body-pose-classifier.ts` — Phân loại tư thế + normalize

## Hook Layer
- [x] Create `hooks/useMl5BodyPose.ts` — Body pose detection hook
- [x] Create `hooks/useOfflineDetector.ts` — ml5 detect trên ảnh đơn lẻ
- [x] Create `hooks/useImageUpload.ts` — Upload và xử lý ảnh
- [x] Create `hooks/useVideoExtractor.ts` — Xử lý trích xuất frame từ Video

## Lib Updates
- [x] Update `lib/knn-classifier.ts` — Add detailed classification + evaluation + balance analysis

## Component Layer
- [x] Create `components/journey/DataBalanceWarning.tsx` — Cảnh báo mất cân bằng
- [x] Create `components/journey/ScoreExplainer.tsx` — Giải thích điểm số chi tiết
- [x] Create `components/journey/DataCollector.tsx` — Thu dữ liệu (camera + upload ảnh + video)

## Refactoring Teach Pages
- [x] Refactor `teach/page.tsx`
- [x] Refactor `teach-gestures/page.tsx`
- [x] Refactor `teach-two-hands/page.tsx`
- [x] Refactor `teach-face/page.tsx`

## Server Changes (Teacher Templates)
- [x] Update `datasets.entity.ts` — Add isTemplate, teacherNotes, isPublished, dataSourceType
- [x] Update `datasets.service.ts` — Add template methods
- [x] Update `datasets.controller.ts` — Add template endpoints
- [x] Update `create-dataset.dto.ts` — Add new fields
- [x] Update `api.ts` (Client) — Add new API capabilities

## Teacher Features
- [x] Teacher Training Interface (`teacher/training/page.tsx`)
- [x] Teacher Templates List Interface (`teacher/templates/page.tsx`)
- [x] Upload Video / Video processing
