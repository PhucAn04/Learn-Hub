# Kế hoạch Triển khai tính năng So sánh chi tiết Ảnh sai nhãn

Mục tiêu: Cung cấp giao diện trực quan cho học sinh tiểu học hiểu tại sao AI lại nhận diện sai bức ảnh của mình, bằng cách hiển thị popup so sánh trực tiếp ảnh chụp với ảnh mẫu chuẩn ngay trong khu vực "Thư viện ảnh".

## User Review Required
> [!IMPORTANT]
> Tính năng này sẽ thêm một giao diện So sánh trực quan (Side-by-side) vào Popup xem chi tiết ảnh trong Thư viện ảnh. Giao diện này sẽ hiển thị bức ảnh bé chụp cạnh bức ảnh Mẫu chuẩn (Golden dataset) mà AI đã nhầm lẫn, giúp bé hiểu rõ lý do sai nhãn. Xin xác nhận xem luồng UI này có phù hợp với học sinh tiểu học không.

## Quyết định thiết kế (Design Decisions)
- **Không khóa Thư viện ảnh trước khi Train**: Trẻ vẫn có thể click vào ảnh trong Thư viện để xem và xóa (đặc biệt hữu ích khi phát hiện ảnh mờ/tối). Tuy nhiên, **Giao diện So sánh AI nhầm lẫn** sẽ được ẩn đi và CHỈ hiện ra đối với các ảnh sai nhãn sau khi quá trình "Dạy bạn AI học" hoàn tất 100%. Đảm bảo sự tự do tương tác nhưng không làm rối luồng dạy AI.

## Proposed Changes

### client/src/components/SampleGallery.tsx
Thêm prop `isTrained: boolean` để component nhận biết trạng thái huấn luyện.
Cập nhật Modal chi tiết ảnh (Preview Modal):
- Nếu `isTrained === true` và ảnh bị `isMisclassified === true` (sai nhãn sau khi train):
  - Thay thế thông báo lỗi cũ bằng một khu vực UI nổi bật (màu đỏ/xanh).
  - Hiển thị 2 khung ảnh cạnh nhau (Side-by-side) với chữ **VS** ở giữa.
  - Khung bên trái: Ảnh bé vừa chụp (Có nhãn gốc của bé).
  - Khung bên phải: Ảnh mẫu chuẩn (`nearestMatchThumbnail`) mà AI đã lấy làm căn cứ để đoán sai.
  - Thêm câu giải thích thân thiện: "Ảnh này quá giống với mẫu của nhóm X nên AI đã đoán sai. Bé hãy XÓA đi và chụp lại góc khác nhé!".
- Cập nhật Banner cảnh báo tổng ở trên cùng của Gallery để nhấn mạnh việc "Bé hãy bấm vào ảnh đỏ để xem AI nhầm với hình nào nhé!".

### client/src/components/journey/TeachPanel.tsx
- Truyền biến trạng thái `isTrained={isTrained}` vào component `<SampleGallery />`.

### client/src/components/journey/BodyTeachPanel.tsx
- Truyền biến trạng thái `isTrained={isTrained}` vào component `<SampleGallery />`.

## Verification Plan
1. Chạy hệ thống bằng `docker-compose up -d --build nextjs`.
2. Truy cập trang thu thập dữ liệu (ví dụ: tay hoặc cơ thể).
3. Chụp vài tấm ảnh đúng và vài tấm ảnh cố tình sai nhãn (ví dụ giơ 2 ngón tay nhưng gán nhãn 1 ngón).
4. Nhấn "Dạy bạn AI học" và đợi đạt 100%.
5. Sau khi train xong, các ảnh sai sẽ bị bôi viền đỏ trong Thư viện ảnh.
6. Click vào một ảnh đỏ, kiểm tra xem Popup có hiện ra giao diện so sánh 2 ảnh (Ảnh của bé VS Ảnh mẫu chuẩn) kèm theo lời giải thích dễ hiểu hay không.
