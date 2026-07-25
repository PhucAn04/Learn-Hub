# Kế hoạch Triển khai 19: AI Companion & "Garbage In, Garbage Out" (GIGO)

Định hình lại toàn bộ triết lý giáo dục: Biến AI thành một **người bạn đồng hành tàng hình**, giao tiếp với trẻ thông qua chính các hiệu ứng giao diện (UI/UX) thuần tuý. Bé là nhân vật chính, cùng AI khám phá và tự nhận ra bài học về chất lượng dữ liệu thông qua nguyên lý nguyên nhân - kết quả.

## User Review Required

> [!IMPORTANT]
> - Chúng ta đã **loại bỏ hoàn toàn** các khái niệm "Trò chơi trừng phạt" (như nổ tung máy móc, bắn bùn) và các nhân vật linh vật (Mascot).
> - Triết lý mới: **Sự thấu cảm qua giao diện (UI Empathy)**. AI không báo lỗi, AI không hiện bảng cảnh báo che hết màn hình. AI chỉ thể hiện góc nhìn của mình cho bé thấy thông qua màu sắc, độ nét, và chuyển động của UI.

## Proposed Changes

### 1. Thu thập dữ liệu: Ambient Metadata (Thông tin ngầm)
- **`client/src/lib/knn-classifier.ts` & `DataCollector.tsx`:** 
  Vẫn giữ logic đo lường độ mờ (Blur) và độ sáng (Brightness) tại client, nhưng lưu chúng dưới dạng *metadata ngầm*. Không có Pop-up ngăn chặn nào xuất hiện khi bé chụp ảnh mờ. Bé hoàn toàn tự do khám phá.

### 2. Trải nghiệm Kiểm thử (Testing UI): Thể hiện sự "Khó hiểu" của AI
Thay vì dùng bảng điểm phần trăm, hệ thống sẽ mô phỏng trạng thái "nhận thức" của AI thông qua 3 hiệu ứng UI trực quan:

- [NEW] **Hiệu ứng Nhòe mờ (The Foggy View) - Dành cho Dữ liệu mờ/tối:** 
  Nếu tập dữ liệu huấn luyện chứa nhiều ảnh chất lượng kém, khu vực hiển thị kết quả dự đoán của AI sẽ bị phủ một lớp kính mờ (Frosted-glass effect). Một dòng text đồng hành hiện lên nhẹ nhàng: *"Góc nhìn của mình ở nhóm này hơi mờ, cậu có thấy vậy không?"*. Khi bé bổ sung ảnh rõ nét, giao diện lập tức trong suốt (Crisp) trở lại.
- [NEW] **Hiệu ứng Rung lắc (Jittery Output) - Dành cho Dữ liệu nhiễu/không nhất quán:** 
  Khi bé đưa tay lên mà AI không thể quyết định dứt khoát giữa 2 nhãn, khối giao diện chứa kết quả sẽ liên tục rung nhẹ (vibrate) và khung viền nhấp nháy giữa 2 màu. Nó tạo cảm giác vật lý rằng hệ thống đang "vật lộn" để cân bằng quyết định.
- [NEW] **Hiệu ứng Phai màu (Desaturated Zone) - Dành cho Mất cân bằng dữ liệu:** 
  Nếu nhãn A có 50 ảnh, nhãn B chỉ có 2 ảnh. Toàn bộ khu vực màn hình đại diện cho nhãn B sẽ bị phai màu (Grayscale) và trở nên mờ nhạt. AI ngầm báo hiệu: *"Mình có một điểm mù ở khu vực này, nó nhạt nhòa quá mình không nhớ rõ."* Khi bé nạp thêm ảnh, màu sắc rực rỡ sẽ bơm dần vào nhãn B.

### 3. "Aha! Moment" mượt mà (Không dùng Modal Pop-up)
Thay vì hiện bảng Pop-up dừng hẳn trò chơi, hệ thống sử dụng các "cú huých" (Nudges) nhẹ nhàng:
- [NEW] **Soft Highlighting (Đốm sáng gợi ý):** Khi kết quả dự đoán đang rung lắc hoặc bị mờ, hệ thống sẽ phát ra một vầng sáng dịu nhẹ (glowing) bao quanh những tấm ảnh "thủ phạm" (ảnh mờ/tối) ở bảng dữ liệu bên cạnh. Kèm theo một bong bóng chat nhỏ nổi lên: *"Hmm, mấy tấm ảnh này trông hơi khác với phần còn lại thì phải..."*
- [NEW] **What-If Preview (Hiệu ứng tức thời):** Tính năng "Thử che đi" cực kỳ đắt giá. Khi bé chỉ chuột (Hover) vào nút Xóa của một tấm ảnh mờ, hệ thống lập tức cho xem trước: Khối dự đoán ngừng rung lắc và kính trở nên trong suốt trở lại! Trẻ em sẽ tự hiểu ra mối quan hệ nguyên nhân - kết quả (GIGO) và tự bấm xóa ảnh đó.

## Verification Plan

### Manual Verification
1. Truy cập trang Sandbox.
2. Tạo tình huống mất cân bằng: Thu thập 30 ảnh cho Nhãn 1, 2 ảnh cho Nhãn 2 -> Xác nhận khu vực UI của Nhãn 2 bị phai màu (Desaturated).
3. Tạo tình huống nhiễu (ảnh mờ): Cố tình làm mờ camera và thu thập 10 ảnh. -> Xác nhận khu vực kết quả dự đoán bị phủ lớp kính mờ (Frosted-glass).
4. Kiểm tra What-If Preview: Di chuột (Hover) vào nút Xóa của bức ảnh mờ -> Xác nhận hiệu ứng kính mờ ở bảng kết quả biến mất ngay lập tức trước khi bấm Xóa thật.
