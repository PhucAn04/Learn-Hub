# Kế Hoạch Loại Bỏ `any` Type Khỏi Dự Án (Chuẩn Bị Cho MLOps)

Dự án hiện tại đang sử dụng kiểu `any` ở nhiều nơi quan trọng, đặc biệt trong các tác vụ Machine Learning, API, và Database. Việc loại bỏ `any` là bước tiên quyết trước khi biến đổi dự án thành nền tảng MLOps.

## User Review Required

> [!WARNING]
> Những thay đổi này có tác động rộng khắp mã nguồn, liên quan đến cả Client và Server. Bạn hãy review kỹ trước khi tôi tiến hành sửa code nhé. (Đừng lo, tôi sẽ tự động thực hiện sau khi bạn duyệt).

## Đề Xuất Các Thay Đổi

### Shared Types & Models

Tôi sẽ tạo các file định nghĩa Type/Interface chuẩn mực cho Dữ liệu huấn luyện, mô hình, v.v.

#### [NEW] `client/src/types/models.ts`
Chứa các interface chung cho việc Training:
- `Landmark`: Cấu trúc cho một điểm { x, y, z? }.
- `TrainingSample`: Mẫu dữ liệu huấn luyện (dùng thay cho `any`).
- `TeacherTemplate`: Cấu trúc mẫu chuẩn của giáo viên.

### Tầng Server (NestJS)

- Các Entity, DTO đang dùng `any` hoặc `any[]` sẽ được sửa lại bằng `class-validator` và `class-transformer` để đảm bảo API an toàn.

#### [MODIFY] `server/src/modules/datasets/dto/create-dataset.dto.ts`
- Sửa `samples: any[]` -> `samples: TrainingSampleDto[]`.
- Sửa `customClasses?: any[]` -> `customClasses?: CustomClassDto[]`.

#### [MODIFY] `server/src/modules/datasets/entities/dataset.entity.ts`
- Sửa `classSummary: any` -> `classSummary: Record<string, number>`.
- Sửa `customClasses?: any[]` -> `customClasses?: CustomClass[]`.

#### [MODIFY] `server/src/modules/submissions/dto/create-submission.dto.ts`
- Sửa `dataset?: any` -> `dataset?: DatasetConfigDto`.

#### [MODIFY] `server/src/modules/submissions/entities/submission.entity.ts`
- Sửa `dataset: any` -> `dataset: Record<string, unknown> | DatasetConfig`.

#### [MODIFY] `server/src/modules/auth/auth.service.ts` & `server/src/modules/auth/strategies/google.strategy.ts`
- Sửa `profile: any` -> `profile: GoogleProfile`.

#### [MODIFY] `server/src/modules/integrations/google-drive.service.ts`
- Sửa `oauth2Client: any` -> `oauth2Client: OAuth2Client` (từ thư viện `google-auth-library` hoặc `any` nếu chưa cài, nhưng sẽ wrap bằng interface). Tôi sẽ install `@types/googleapis` nếu cần.

#### [MODIFY] `server/src/modules/users/users.service.ts`
- Sửa `update: any` -> `update: Partial<User>`.

### Tầng Client (Next.js & ML)

- Các component và lib đang lạm dụng `any` sẽ được định kiểu chặt chẽ.

#### [MODIFY] `client/src/lib/api.ts`
- Sửa các tham số `dataset: any`, `samples: any[]`, `customClasses?: any[]` bằng các Type vừa tạo ở trên.
- Sửa `request<{ user: any; ... }>` -> `request<{ user: UserProfile; ... }>`.

#### [MODIFY] `client/src/types/ml5.ts`
- Bổ sung type cho `options?: any` thành `options?: Record<string, unknown>`.

#### [MODIFY] `client/src/lib/tf-trainer.ts` & `client/src/lib/tf-loader.ts`
- Việc import TensorFlow đang qua CDN (`any`). Tôi sẽ định nghĩa interface cơ bản `TFLayersModel` và `TFStatic` để thay thế `any` cho `model` và `tf`.

#### [MODIFY] `client/src/components/SamplePreviewModal.tsx`
- Sửa `sample: any` -> `sample: Partial<StoredSample>`.

#### [MODIFY] `client/src/components/journey/AIFeedbackModal.tsx`
- Sửa `teacherTemplate?: any` -> `teacherTemplate?: TeacherTemplate`.
- Sửa `correctnessIssues: any[]` -> `correctnessIssues: CorrectnessIssue[]`.
- Sửa `matchingNearest: any[]` -> `matchingNearest: StoredSample[]`.
- Sửa `knn.nearest.filter((n: any)` -> `(n: NearestNeighbor)`.

#### [MODIFY] `client/src/components/journey/BodyTeachPanel.tsx` & `client/src/components/journey/TeachPanel.tsx`
- Sửa `teacherTemplate?: any` -> `teacherTemplate?: TeacherTemplate`.
- Sửa `getVideoThumbAndCanvas = useCallback((hands?: any[], faces?: any[])` -> `(hands?: HandResult[], faces?: FaceMeshResult[])`.

#### [MODIFY] Các file pages (như `fingers/page.tsx`, `teach-body/page.tsx`, v.v.)
- Sửa `let loadedSamples: any[] = [];` -> `let loadedSamples: StoredSample[] = [];`.
- Sửa `sample: any` trong vòng lặp `map` -> `sample: StoredSample`.

## Verification Plan
1. **Automated Check**: Chạy `npm run build` trên thư mục `client` và `npm run build` trên `server` để đảm bảo không còn lỗi type mismatch.
2. **Manual Check**: Trình duyệt UI báo cáo không có lỗi biên dịch.
