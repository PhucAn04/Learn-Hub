# Kế hoạch triển khai: Kịch bản Đánh giá & Phản hồi cho Học sinh (AI Feedback)

## Bối cảnh và Mục tiêu
Học sinh hiện tại đã có không gian "AI Playground" để thoải mái thu thập dữ liệu, điều chỉnh thanh trượt **K (Số bạn hỏi ý kiến)** và **Độ khắt khe (Bức tường lọc)**. 
Tuy nhiên, cần có một bước kiểm tra (Validation) tự động khi bé bấm **"DẠY BẠN AI HỌC"**. Hệ thống sẽ so sánh dữ liệu của bé với bộ dữ liệu chuẩn của Giáo viên (Teacher Template) để đưa ra các lời khuyên sư phạm, giúp bé hiểu tại sao AI học kém hoặc nhận diện sai.

## Các vấn đề cần người dùng (USER) xác nhận

> [!IMPORTANT]
> **1. Quy trình Nộp Bài:** Sau khi bé xem xong các đánh giá lỗi (nếu có), bé có thể sửa lại dữ liệu rồi bấm lại. Nếu dữ liệu đã tốt (hoặc bé vẫn muốn nộp), hệ thống mới hiện form "Lưu kết quả" (Nộp bài). Bạn có đồng ý với luồng này không?
> **2. Nút bấm:** Nút hiện tại ở trang TeachPanel là "Hoàn Thành & Nộp Bài". Sẽ được đổi tên lại thành "DẠY BẠN AI HỌC 🚀" cho đúng với mong muốn của bạn.

## Chi tiết Kế hoạch Triển khai (Proposed Changes)

### 1. Phân tích lỗi dữ liệu (Data Validation Logic)
Tạo một component mới `AIFeedbackModal.tsx` hiển thị đè lên (modal) hoặc thay thế màn hình chính khi bấm "DẠY BẠN AI HỌC".
Component này sẽ nhận `studentSamples` (dữ liệu bé chụp), `teacherTemplate` (dữ liệu chuẩn của giáo viên), `kValue`, và `threshold`.
Hệ thống sẽ chạy 3 bài kiểm tra:

- **Bài 1: Sự cân bằng dữ liệu (Data Imbalance):**
  - Đếm số lượng ảnh của từng nhãn (ví dụ: Nhãn 1 có 20 ảnh, Nhãn 2 có 2 ảnh).
  - Cảnh báo: *"Bạn AI đang bị 'thiên vị'! Bạn cho AI xem quá nhiều ảnh của Nhãn 1, nhưng lại quên mất Nhãn 2 rồi."*

- **Bài 2: Tính chính xác của Nhãn (Label Correctness):**
  - Thuật toán: Sử dụng thuật toán KNN (với K và Threshold của bé) để so sánh từng tấm ảnh của bé chụp với **bộ dữ liệu của Giáo viên**.
  - Nếu ảnh bé gắn nhãn là "1 Ngón tay", nhưng khi so với ảnh của Giáo viên, AI dự đoán là "2 Ngón tay" -> AI phát hiện lỗi.
  - Cảnh báo: *"Có vẻ bạn đã vô tình chụp nhầm hành động cho nhãn này rồi! Hãy xem lại các bức ảnh dưới đây nhé."*

- **Bài 3: Trực quan hóa K và Độ khắt khe (KNN Visualizer):**
  - Khi phát hiện ảnh lỗi hoặc ảnh đúng, hiện trực quan: Tấm ảnh của bé ở giữa, xung quanh là **K** tấm ảnh giống nhất từ bộ dữ liệu của Giáo viên.
  - Hiện điểm số Độ tự tin (%) so với **Độ khắt khe** (Threshold). Nếu dưới mức khắt khe -> *"Bức tường lọc quá cao, ảnh này bị loại!"*.

### 2. Sửa đổi File

#### [NEW] `client/src/components/journey/AIFeedbackModal.tsx`
Component làm nhiệm vụ phân tích và hiển thị giao diện báo cáo (Report Card) sinh động, thân thiện với trẻ em.

#### [MODIFY] `client/src/components/journey/TeachPanel.tsx` & `BodyTeachPanel.tsx`
- Đổi tên nút thành `DẠY BẠN AI HỌC 🚀`.
- Khi click, hiển thị `AIFeedbackModal` thay vì gọi thẳng `onTrainComplete()`.
- Truyền `kValue`, `threshold`, `samples` và `teacherTemplate` vào Modal.

#### [MODIFY] `client/src/app/(private)/challenge/teach.../page.tsx` (Các trang teach của Student)
- Đảm bảo `teacherTemplate` (nếu tải về thành công từ API) được truyền đầy đủ xuống `TeachPanel` dưới dạng prop.

## Verification Plan (Kế hoạch Kiểm tra)
1. **Kiểm tra cân bằng:** Thử chụp 10 ảnh tay phải, 1 ảnh tay trái. Bấm "DẠY BẠN AI HỌC" -> Kiểm tra xem cảnh báo thiếu cân bằng có xuất hiện không.
2. **Kiểm tra sai nhãn:** Cố tình giơ 2 ngón tay nhưng thu thập vào nhãn "1 Ngón tay". Bấm kiểm tra -> Hệ thống phải trích xuất đúng tấm ảnh sai và so sánh nó với ảnh 2 ngón tay của giáo viên.
3. **Luồng UI:** Sau khi vượt qua bài kiểm tra hoặc bỏ qua cảnh báo, học sinh vẫn có thể lưu bộ dữ liệu thành công.
