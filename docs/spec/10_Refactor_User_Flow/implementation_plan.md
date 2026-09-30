# 📖 Kế Hoạch Triển Khai (Implementation Plan) - Plan 10

## 🎯 Mục Tiêu Cốt Lõi
Tái cấu trúc lại luồng tiếp cận của người dùng (học sinh) khi truy cập vào website:
- **Hủy bỏ** hoàn toàn thiết kế "AI Playground" tập trung do đi chệch khỏi ý tưởng ban đầu.
- **Quay về** với định hướng Sandbox gốc của dự án (`/challenge/teach`, v.v.).
- Xây dựng một luồng **"Dẫn dắt cảm xúc & Lý thuyết (Concepts)"** thân thiện với trẻ em trước khi mở khóa các Sandbox.

## 🏗️ Kiến Trúc Hệ Thống (Mới)
1. **Trang Chủ (`/page.tsx`)**
   - Đóng vai trò là mục lục câu chuyện.
   - Thể hiện 3 Chương học AI thông qua các ngữ cảnh vui nhộn:
     - Chương 1: Đếm ngón tay (Image Classification)
     - Chương 2: Ngôn ngữ ký hiệu (Gesture Recognition)
     - Chương 3: Đọc cảm xúc (Emotion Recognition)
   - Điều hướng trực tiếp người dùng sang các trang "Lớp Học AI" độc lập (Concept Pages).

2. **Các Trang Dẫn Dắt Độc Lập (`/concepts/[slug]/page.tsx`)**
   - Sử dụng **Dynamic Routing** để tái sử dụng mã nguồn.
   - Thiết kế dạng Slide ngang (Step-by-step), trình bày định nghĩa kỹ thuật AI bằng ngôn từ của trẻ thơ (Ví dụ: So sánh AI nhận diện ảnh với em bé học chữ, AI nhận diện cảm xúc với việc đắp lưới tàng hình).
   - **Slide cuối:** Chứa một Mini Quiz bắt buộc. Trẻ phải trả lời đúng thì mới hiện nút chuyển tới Sandbox tương ứng.

3. **Sandbox Nguyên Bản (`/challenge/...`)**
   - Chứa logic thu thập ảnh (Teachable Machine / ML5.js) mà dự án đã xây dựng từ đầu.
   - Trẻ chỉ có thể vào đây sau khi đã thông qua bài Quiz lý thuyết.

## 🛠️ Quy Trình Thực Hiện
1. Xóa toàn bộ code rác liên quan tới `ai-playground`.
2. Thiết kế UI trang chủ.
3. Tạo Dynamic Route `/concepts/[slug]`.
4. Ráp Data (Slide content & Quiz) vào Route mới.
5. Cân chỉnh UI, Animations và Nội dung text cho mềm mại.
