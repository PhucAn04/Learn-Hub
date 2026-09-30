# 📝 Task List: Chuyển đổi luồng người dùng (Plan 10)

- `[x]` **1. Dọn Dẹp (Cleanup)**
  - `[x]` Xóa sạch thư mục `/ai-playground` vì thiết kế gom chung không còn phù hợp.
  - `[x]` Gỡ bỏ các Store và Component rác (Ví dụ: `playground-store.ts`, `FullScreenCameraView.tsx`).

- `[x]` **2. Nâng cấp Trang Chủ (`/page.tsx`)**
  - `[x]` Xóa bỏ UI Quiz Modal (Popup) dạng cũ.
  - `[x]` Giữ nguyên thiết kế Story-driven nhưng viết lại nội dung:
    - Bổ sung tên thuật ngữ chuyên ngành: Image Classification, Gesture Recognition, Emotion Recognition.
    - Cập nhật đoạn dẫn dắt cho từng câu chuyện để tự nhiên và "trẻ con" hơn.
  - `[x]` Fix lỗi Emoji bị mờ (do CSS text-transparent).
  - `[x]` Phục hồi hiệu ứng `animate-bounce` và `animate-pulse` cho tag "HỌC VIỆN AI NHÍ".
  - `[x]` Cập nhật nút bấm điều hướng trỏ về Dynamic Route `/concepts/[slug]`.

- `[x]` **3. Xây dựng trang Dẫn dắt Độc lập (`/concepts/[slug]/page.tsx`)**
  - `[x]` Khởi tạo Route động (Dynamic Route) để tái sử dụng UI cho cả 3 Chương.
  - `[x]` Code lại UI khung Slide ngang (Step-by-step) với nút back/next.
  - `[x]` Khai báo Data JSON (`CONCEPTS_DATA`) cho 3 chủ đề: fingers, gestures, emotions.
    - Nội dung Slide: Giải thích kiến thức học thuật bằng từ ngữ ví von đơn giản.
  - `[x]` Tích hợp Quiz trắc nghiệm 1 câu hỏi ở Slide cuối.
  - `[x]` Fix state/event để chỉ khi bé trả lời đúng, nút "Vào Sandbox" mới hiển thị.
  - `[x]` Bọc Component với hiệu ứng âm thanh (Click, Ting Ting khi đúng).
  - `[x]` Đặt Link điều hướng chuẩn xác về hệ thống Sandbox có sẵn:
    - `/challenge/teach`
    - `/challenge/teach-gestures`
    - `/challenge/teach-face`
