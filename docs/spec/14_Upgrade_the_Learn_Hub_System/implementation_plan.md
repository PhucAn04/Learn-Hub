# Kế Hoạch Hoàn Thiện & Nâng Cấp Hệ Thống Learn-Hub (Tập trung vào Chất lượng Dữ liệu & Đánh giá)

Dựa trên phản hồi của bạn, định hướng phát triển sẽ kết hợp chặt chẽ giữa **Trải nghiệm thực hành của bé** và **Khả năng giám sát/đánh giá của Giáo viên**. Trọng tâm là giúp bé hiểu rõ *tại sao AI lại thông minh (hoặc ngốc nghếch)* dựa trên chính dữ liệu bé đã dạy, đồng thời cung cấp công cụ chẩn đoán lỗi cho giáo viên.

Dưới đây là kế hoạch chi tiết chia thành 3 phần chính:

---

## 1. Hệ thống Phân tích & Cảnh báo Chất lượng Hình ảnh (Real-time Image Quality Assessment)
*Mục tiêu: Dạy bé khái niệm "Dữ liệu tốt thì AI mới thông minh" bằng cách cảnh báo khi bé chụp ảnh lỗi.*

- **Kiểm tra độ sáng (Brightness Check):** Xử lý hình ảnh từ WebRTC/Canvas ngay trên Frontend (hoặc qua Backend) để tính toán độ sáng trung bình. 
  - Cảnh báo: *"Hình như phòng hơi tối! Bé bật thêm đèn nhé!"* (Thiếu sáng).
  - Cảnh báo: *"Chói quá bé ơi, AI bị lóa mắt rồi!"* (Quá sáng/Cháy sáng).
- **Kiểm tra độ nét/mờ (Blur Detection):** Tính toán phương sai của thuật toán Laplacian để xác định ảnh có bị rung tay hoặc camera bị mờ hay không.
  - Cảnh báo: *"Ảnh bị mờ rồi, bé giữ yên tay một chút nha!"*
- **Quy trình thu thập (Capture Flow):** Hệ thống sẽ hiện cảnh báo ngay lúc bé chụp ảnh, nhưng **vẫn cho phép lưu** (hoặc lưu vào một thư mục 'Cần chú ý') thay vì chặn hoàn toàn. Điều này để làm bằng chứng cho giáo viên thấy bé đã làm sai ở đâu. Các ảnh lỗi sẽ được tự động gắn cờ (Flagged: `blur`, `dark`, `bright`).

## 2. Báo Cáo "Nghiệm Thu" Dành Cho Bé (Child's AI Training Report)
*Mục tiêu: Trả lời câu hỏi "Thực hành xong bé học được gì?".*

- **Giao diện "Thử Thách AI Của Bé":** Sau khi bé hoàn thành việc chụp ảnh và hệ thống huấn luyện xong, tạo một màn hình để bé test trực tiếp con AI mình vừa tạo.
- **Giải thích Lỗi sai đơn giản (Explainable AI cho trẻ em):**
  - Nếu AI nhận diện sai, hệ thống sẽ đưa ra nguyên nhân giải thích dựa trên dữ liệu.
  - *Ví dụ:* "AI nhận diện nhầm hành động 'Kéo' thành 'Búa' vì trong tập dữ liệu 'Búa' có 5 bức ảnh bị mờ hoặc tối! Lần sau bé chụp rõ hơn nhé!"
- **Chứng nhận hoàn thành (Certificate):** Cấp một thẻ chứng nhận (có thể tải về/in ra) ghi rõ: "Bé đã dạy AI thành công phân biệt 3 cảm xúc với độ chính xác 85%".

## 3. Công cụ Giám sát & Phân tích Dành Cho Giáo Viên (Teacher's Analytics Dashboard)
*Mục tiêu: Cung cấp bức tranh toàn cảnh để giáo viên biết học sinh hiểu bài đến đâu và sai ở bước nào để can thiệp kịp thời.*

- **Màn hình Danh sách Lớp học:** Liệt kê các học sinh và trạng thái hoàn thành các Thử thách (Challenges).
- **Trình xem Dữ liệu (Dataset Inspector):** 
  - Giáo viên click vào một học sinh sẽ thấy toàn bộ hình ảnh học sinh đó đã nộp.
  - Hệ thống tự động **Filter (Lọc)** và **Highlight (Làm nổi bật)** các bức ảnh lỗi (bị mờ, tối, chói) dựa trên các cờ (flag) từ Bước 1.
  - Giáo viên sẽ biết ngay lý do mô hình của học sinh A bị điểm thấp là do thu thập data cẩu thả.
- **Biểu đồ nhầm lẫn (Confusion Matrix đơn giản hóa):** Hiển thị trực quan cho giáo viên thấy AI của học sinh thường xuyên bị nhầm lẫn giữa nhãn nào với nhãn nào (VD: Hay nhầm 'Buồn' với 'Tức giận' do bé làm biểu cảm chưa rõ). Từ đó giáo viên có dữ liệu thực tế để gọi học sinh lên hướng dẫn lại bên ngoài.

---

## Lộ trình Thực hiện (Implementation Steps)

### Giai đoạn 1: Nền tảng Phân tích Ảnh
- Cập nhật schema Database để thêm trường metadata cho hình ảnh (độ sáng, độ mờ, cờ lỗi).
- Cài đặt thuật toán phân tích chất lượng ảnh (Image Quality Metrics) bằng Javascript (tại Client) hoặc bằng Python/Node.js (tại Server).

### Giai đoạn 2: Cập nhật Trải nghiệm Bé
- Tích hợp cảnh báo thời gian thực lên màn hình thu thập dữ liệu (Camera).
- Xây dựng trang Báo cáo sau huấn luyện (Post-training Report) giải thích lỗi sai cho bé.

### Giai đoạn 3: Dashboard Giáo Viên
- Xây dựng màn hình Teacher Dashboard trong Next.js.
- Tạo API thống kê và truy xuất hình ảnh bị lỗi của từng học sinh.

> [!IMPORTANT]
> ## User Review Required
> Đây là bản kế hoạch đi sát vào nhu cầu kiểm soát chất lượng dữ liệu và đánh giá hiệu quả học tập. 
> 
> Bạn có muốn chốt kế hoạch này để chúng ta bắt tay vào **Giai đoạn 1 (Xây dựng thuật toán và DB cho tính năng kiểm tra ảnh mờ/tối/chói)** luôn không? Hay bạn cần điều chỉnh chi tiết nào nữa?
