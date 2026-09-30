# Bug Report: Next.js Nested Dynamic Routing 404 on Docker (Windows)

**Ngày báo cáo:** 19/08/2026
**Môi trường:** Next.js (App Router), Docker Desktop trên Windows
**Vị trí lỗi:** `app/(private)/teacher/students/[userId]/models/[modelId]/page.tsx`

---

## 1. Mô tả hiện tượng (Symptoms)
Trong quá trình phát triển ứng dụng Learn-Hub, có một lỗi 404 dai dẳng xuất hiện khi người dùng truy cập vào trang chi tiết mô hình của học sinh, ví dụ: 
`http://localhost:3000/teacher/students/{userId}/models/{modelId}`

- Lỗi này xuất hiện không nhất quán: đôi khi tải được (HTTP 200), nhưng sau khi khởi động lại container bằng `docker-compose up -d --build`, toàn bộ đường dẫn này lập tức trả về `404 This page could not be found.`
- Mặc dù thư mục `[modelId]` và tệp `page.tsx` bên trong vẫn tồn tại hợp lệ trên hệ thống file, Next.js hoàn toàn bỏ qua chúng.

## 2. Phân tích nguyên nhân gốc rễ (Root Cause)
Ban đầu, giả thuyết được đặt ra là do cơ chế lưu cache `.next` của Next.js bị xung đột (file locking) với Volume của Docker trên Windows.

Tuy nhiên, sau khi dọn sạch hoàn toàn bộ nhớ cache bằng cơ chế Anonymous Volume (`- /app/.next`) và khởi động lại lạnh (cold restart), lỗi 404 vẫn tiếp diễn. 

Nguyên nhân thực sự nằm ở **lỗi quét thư mục (File-system watching & Indexing bug) của trình biên dịch Webpack/Turbopack trong Next.js khi chạy qua Docker Volume trên Windows**:
- Khi một thư mục định tuyến động lồng nhau ở mức độ sâu (nested dynamic routing) như `[modelId]` **chỉ chứa duy nhất một tệp `page.tsx`**, trình theo dõi tệp (file watcher) của Next.js thỉnh thoảng sẽ đánh giá sai và "bỏ lỡ" (miss) việc quét thư mục này trong quá trình khởi tạo server.
- Hệ quả là cây định tuyến (Router Tree) trong bộ nhớ của Next.js không hề chứa endpoint `[modelId]`. Bất kỳ request nào gửi đến nhánh này đều rơi vào trang fallback `not-found.tsx` mặc định, dẫn đến lỗi 404 "mù tạm thời".

## 3. Cách khắc phục (Resolution)
Để giải quyết vĩnh viễn vấn đề này mà không cần chờ bản vá từ Vercel/Next.js, một thủ thuật ép buộc (force-index) đã được áp dụng.

**Giải pháp:**
Tạo thêm một tệp `layout.tsx` giả (dummy) đặt song song với `page.tsx` bên trong thư mục `[modelId]`.

```tsx
// File: client/src/app/(private)/teacher/students/[userId]/models/[modelId]/layout.tsx

export default function Layout({ children }: { children: React.ReactNode }) { 
  return <>{children}</>; 
}
```

**Tại sao cách này hoạt động?**
Sự xuất hiện của tệp `layout.tsx` đóng vai trò như một mỏ neo (anchor). Cấu trúc thư mục giờ đây trở nên phức tạp hơn một chút (có cả layout và page), buộc module quét thư mục của Next.js phải ưu tiên đọc và đăng ký toàn bộ thư mục `[modelId]` vào Router Tree ngay từ lúc khởi động. Bệnh "mù tạm thời" (404) do đó được chữa khỏi tận gốc.

## 4. Kết luận & Khuyến nghị
- Khi gặp lỗi 404 khó hiểu với các thư mục Dynamic Route (đặc biệt là route lồng nhau `[a]/[b]`) trong môi trường Docker, hãy nghĩ ngay đến lỗi File Watcher.
- Nên luôn luôn sử dụng một tệp `layout.tsx` bao bọc (dù là rỗng) cho các thư mục động ở cấp độ sâu để đảm bảo tính ổn định của Router Tree.
- Giữ lại cấu hình Anonymous Volume cho `/app/.next` trong `docker-compose.yml` để phòng tránh các lỗi liên quan đến Permission/File Locking trên Windows.
