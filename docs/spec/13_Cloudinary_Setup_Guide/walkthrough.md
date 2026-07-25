# Walkthrough - Hệ Thống Quản Lý Bộ Dữ Liệu & Mô Hình AI

## Tổng quan
Đã triển khai thành công hệ thống quản lý bộ dữ liệu và mô hình AI với các tính năng: tách bảng Dataset/Model, lưu file JSON trên server, nút xóa toàn bộ dữ liệu, lịch sử học sinh, và giao diện giáo viên xem timeline + nhận xét.

---

## Các file đã thay đổi

### Backend (Server) — 10 files

#### Modules mới
| File | Mô tả |
|------|-------|
| [dataset.entity.ts](file:///d:/HOCTAP/Learn-Hub/server/src/modules/datasets/entities/dataset.entity.ts) | Entity bảng `datasets` — lưu userId, challengeType, đường dẫn file JSON, sampleCount, classSummary |
| [model.entity.ts](file:///d:/HOCTAP/Learn-Hub/server/src/modules/models/entities/model.entity.ts) | Entity bảng `models` — lưu testScore, teacherFeedback, liên kết với Dataset |
| [create-dataset.dto.ts](file:///d:/HOCTAP/Learn-Hub/server/src/modules/datasets/dto/create-dataset.dto.ts) | DTO nhận dữ liệu từ Frontend (challengeType, samples, testScore) |
| [datasets.service.ts](file:///d:/HOCTAP/Learn-Hub/server/src/modules/datasets/datasets.service.ts) | Service lưu file JSON vào `uploads/datasets/`, tạo Dataset + Model records |
| [datasets.controller.ts](file:///d:/HOCTAP/Learn-Hub/server/src/modules/datasets/datasets.controller.ts) | API: POST /datasets, GET /datasets/my, GET /datasets/by-challenge/:type, GET /datasets/:id/file |
| [datasets.module.ts](file:///d:/HOCTAP/Learn-Hub/server/src/modules/datasets/datasets.module.ts) | NestJS module đăng ký Dataset + Model entities |
| [models.service.ts](file:///d:/HOCTAP/Learn-Hub/server/src/modules/models/models.service.ts) | Service quản lý models: lấy theo dataset, lấy theo user, thêm feedback giáo viên |
| [models.controller.ts](file:///d:/HOCTAP/Learn-Hub/server/src/modules/models/models.controller.ts) | API: GET /models/my, PATCH /models/:id/feedback |
| [models.module.ts](file:///d:/HOCTAP/Learn-Hub/server/src/modules/models/models.module.ts) | NestJS module đăng ký Model entity |

#### Files cập nhật
| File | Mô tả |
|------|-------|
| [app.module.ts](file:///d:/HOCTAP/Learn-Hub/server/src/app.module.ts) | Thêm DatasetsModule + ModelsModule vào imports |

### Frontend (Client) — 7 files

#### Files mới
| File | Mô tả |
|------|-------|
| [student/history/[challengeType]/page.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(private)/student/history/[challengeType]/page.tsx) | Dashboard lịch sử học sinh: timeline bộ dữ liệu, điểm số, xu hướng tiến bộ, nhận xét giáo viên, xem ảnh mẫu |
| [teacher/datasets/[challengeType]/page.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(private)/teacher/datasets/[challengeType]/page.tsx) | Dashboard giáo viên: danh sách học sinh, timeline nộp bài, xem ảnh mẫu, gửi nhận xét |

#### Files cập nhật
| File | Thay đổi |
|------|----------|
| [api.ts](file:///d:/HOCTAP/Learn-Hub/client/src/lib/api.ts) | Thêm 6 API methods mới: createDataset, getMyDatasets, getDatasetsByChallenge, getDatasetFile, getMyModels, addTeacherFeedback |
| [teach-face/page.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(private)/challenge/teach-face/page.tsx) | + Nút "Xóa toàn bộ dữ liệu" + Link xem lịch sử + Gọi API dataset mới khi nộp bài |
| [teach/page.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(private)/challenge/teach/page.tsx) | + Nút "Xóa toàn bộ dữ liệu" + Link xem lịch sử + Gọi API dataset mới khi nộp bài |
| [teach-gestures/page.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(private)/challenge/teach-gestures/page.tsx) | + Nút "Xóa toàn bộ dữ liệu" + Link xem lịch sử + Gọi API dataset mới khi nộp bài |
| [teacher/page.tsx](file:///d:/HOCTAP/Learn-Hub/client/src/app/(private)/teacher/page.tsx) | + Navigation cards để vào xem bộ dữ liệu theo từng loại bài tập |

---

## Kiến trúc lưu trữ

```
Database (PostgreSQL)          Ổ cứng Server
┌──────────────┐               ┌──────────────────────────┐
│ datasets     │               │ server/uploads/datasets/ │
│ ─────────    │   dataFileUrl │ ─────────────────────    │
│ id           │──────────────▶│ abc123.json              │
│ userId       │               │ def456.json              │
│ challengeType│               │ ...                      │
│ sampleCount  │               └──────────────────────────┘
│ classSummary │
│ createdAt    │
└──────────────┘
       │
       │ OneToMany
       ▼
┌──────────────┐
│ models       │
│ ─────────    │
│ id           │
│ datasetId    │
│ testScore    │
│ teacherFdbk  │
│ createdAt    │
└──────────────┘
```

## Verification
- ✅ Server build: `npx nest build` — thành công (0 errors)
- ✅ Client build: `npx next build` — thành công (19 routes, 0 errors)

## Bước tiếp theo (Cloudinary)
Khi anh/chị sẵn sàng tích hợp Cloudinary:
1. Cài `cloudinary` trong server hoặc dùng unsigned upload từ frontend
2. Thay đổi thumbnail từ Base64 → URL Cloudinary trong luồng thu thập dữ liệu
3. Cập nhật DatasetGallery component để load ảnh từ CDN Cloudinary
