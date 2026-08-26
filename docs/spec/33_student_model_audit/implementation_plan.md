# Gửi minh chứng chất lượng mô hình & dữ liệu của bé cho Giáo viên

## Bối cảnh

Khi bé nộp bài (V1, V2, V3), Giáo viên cần thấy **minh chứng cụ thể** tại sao mô hình AI tốt hay tệ. Trước đây, hệ thống chỉ dùng KNN đơn giản và "vote-based" dẫn đến việc đánh giá độ tự tin (Confidence) thường bị ảo (luôn 100% dù đoán sai).
Để khắc phục, kiến trúc phân tích đã được đại tu bằng **2 mạng Neural Network đối trọng nhau**, giúp Giáo viên có cái nhìn chuẩn xác, minh bạch nhất về chất lượng mô hình cũng như dữ liệu bé đã cung cấp.

## Architecture: "Two-NN Evaluation Pipeline"

Thay vì dùng chung một mô hình, hệ thống sẽ spawn ra **2 mạng Neural Networks riêng biệt** trong quá trình đánh giá:

### 1. Khung 1: Đánh giá Model AI của bé (Mô Hình Tự Tin)
- **Mô hình (Student's NN)**: Được huấn luyện **CHỈ BẰNG đúng dataset của bé** (giữ nguyên gốc).
- **Mục tiêu**: Đánh giá độ thông minh và độ tự tin của model bé vừa dạy.
- **Quy trình Test**:
  - Nếu **có template Giáo viên**: Lấy ảnh của Giáo viên đưa vào thử thách model của bé.
  - Nếu **không có template Giáo viên**: 
    1. **Thi khảo sát (Validation)**: Đưa 68 mẫu chuẩn Kaggle (TEACHER_REFERENCE_DATASET) vào model của bé.
    2. Nếu model đoán đúng >= 60% (Pass), hệ thống sẽ lấy **chính bộ ảnh của bé** để tự check chéo (Self-validation). UI sẽ hiển thị xem model tự tin bao nhiêu % với những bức ảnh nó vừa được dạy.
    3. Nếu model đoán đúng < 60% (Fail), hệ thống sẽ trải 68 mẫu Kaggle ra UI để Giáo viên thấy model của bé bị hổng kiến thức ở đâu, tại sao lại thất bại với bộ chuẩn.

### 2. Khung 2: Đánh giá Chất lượng Dữ liệu của bé (Kiểm Định Ảnh Học Sinh)
- **Mô hình (Teacher's NN)**: Được huấn luyện bằng **Teacher Samples** (nếu có) hoặc bằng **68 mẫu chuẩn Kaggle** (nếu không có). Đây đóng vai trò là "Giám Khảo Ảo".
- **Mục tiêu**: Validate từng bức ảnh học sinh xem bé có gán nhãn đúng hay không, và ảnh có mờ/tối không.
- **Quy trình Test**:
  - Lấy từng tấm ảnh học sinh chụp đưa qua **Teacher's NN**.
  - **Độ chuẩn (Confidence)**: Lấy trực tiếp điểm Softmax của Teacher's NN dựa trên *Nhãn bé đã gán*.
    - VD: Ảnh bé gán nhãn "1 Ngón Tay ☝️", nhưng Teacher's NN phán quyết 100% nó là "2 Ngón Tay ✌️", thì phiếu bầu cho "1 Ngón Tay ☝️" sẽ là **0%** => Độ chuẩn: 0%.
  - **Penalties**: Nếu ảnh của bé bị mờ (blurry) hoặc tối (dark), hệ thống trừ thêm 30% Độ chuẩn làm hình phạt, kìm ở mức min là 0%.

## Chi Tiết Thay Đổi (Changes)

### client/src/hooks/useModelEvaluation.ts
- Thay đổi unEvaluation để khởi tạo 2 instance của TfTrainer.
- evalTrainer: Huấn luyện nội bộ bằng samples (Student NN).
- 	eacherEvalTrainer: Huấn luyện nội bộ bằng 	eacherSamples hoặc TEACHER_REFERENCE_DATASET (Teacher NN).
- Áp dụng logic chia nhánh Validation Pass/Fail (threshold = 60%) cho evalImages của Khung 1.
- Truyền dự đoán của Teacher NN thay thế cho KNN confidence trong studentImageAudit.

### client/src/components/teacher/ConfusionMatrixViewer.tsx & client/src/components/teacher/StudentImageAuditViewer.tsx
- Bổ sung icon Eye (Con mắt) từ thư viện lucide-react khi người dùng hover qua từng ảnh chụp.
- Hỗ trợ click phóng to ảnh (zoom modal) để xem chi tiết ảnh cùng caption AI đoán: ... | Tự tin: ...%.

## Verification Plan
1. Xem Khung 1 khi không có Teacher Samples: Kiểm tra hiển thị ảnh của bé (nếu model tốt) hoặc 68 ảnh chuẩn (nếu model tệ).
2. Kiểm tra tính năng phóng to (con mắt): Rê chuột vào ảnh trong Khung 1 và Khung 2, click để phóng to.
3. Xem Khung 2 Độ chuẩn: Đảm bảo khi AI đoán sai nhãn bé gán, Độ chuẩn sẽ sập về 0% (hoặc cực kỳ thấp), không bao giờ hiển thị "100%" giả ảo nữa.
