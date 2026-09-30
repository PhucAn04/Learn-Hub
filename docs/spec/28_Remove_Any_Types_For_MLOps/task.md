# Task: Loại bỏ `any` types trong toàn bộ project

- [x] Phân tích toàn bộ project tìm `any` types (kể cả `<any[]>`, `as any`, `useRef<any>`)
- [x] Tạo shared types (`client/src/types/models.ts`, `server/src/shared/types/index.ts`)
- [x] Refactor server DTOs, Entities, Services, Progress & Submissions services
- [x] Refactor client API layer, TF.js pipelines, UI components & Hooks
- [x] Thay thế `leaderboard` states `useState<any[]>` -> `useState<LeaderboardEntry[]>` (face, body-exercise, fingers, gestures)
- [x] Thay thế `teacherTemplate` states `useState<any>` -> `useState<DatasetResponse | null>` across all teach pages
- [x] Thay thế `currentUser` states `useState<any>` -> `useState<UserProfile | null>` in Navbar & Student Profile
- [x] Thay thế `expandedSamples` states `useState<any[]>` -> `useState<StoredSample[]>` in history & teacher datasets pages
- [x] Thay thế `templates` state `useState<any[]>` -> `useState<DatasetResponse[]>` in teacher templates page
- [x] Sửa `calculateROI` & `DataCollector` type assertions `as any` -> `as { x: number; y: number }[]`
- [x] Sửa `useOfflineDetector` `useRef<any>` -> `useRef<Ml5DetectorInstance | null>`
- [x] Sửa `ml5-loader` `Promise<any>` -> `Promise<Ml5Module>`
- [x] Sửa `audio.ts` `(window as any).webkitAudioContext` -> `AudioContextWindow`
- [x] Sửa `body-drawing.ts` `(opts as any)[colorKey]` -> `(opts as Record<string, string | number>)`
- [x] **Client build: ✅ PASS** (28/28 static pages generated)
- [x] **Server build: ✅ PASS** (nest build clean)
- [x] **Strict Grep: 0 remaining `any` types in client/src & server/src**
