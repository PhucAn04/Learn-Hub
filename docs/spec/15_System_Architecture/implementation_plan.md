# Kế hoạch Triển khai Dự án Learn-Hub (Học Viện AI Nhí)

Dựa trên mục tiêu xây dựng một môi trường học tập tương tác giúp trẻ em khám phá Trí tuệ nhân tạo (AI), dưới đây là kế hoạch chi tiết từ cơ sở lý thuyết, phân tích hệ thống đến lộ trình kiểm thử, đánh giá.

## 1. Nghiên cứu tài liệu và cơ sở lý thuyết

*   **Mục tiêu**: Xây dựng nền tảng học máy trực quan (Visual Machine Learning) giúp học sinh tiếp cận và hiểu các khái niệm AI một cách sinh động thông qua tương tác thực tế mà không đòi hỏi kỹ năng lập trình phức tạp.
*   **Công nghệ lõi**: 
    *   Sử dụng **TensorFlow.js** và thư viện bọc **ml5.js** trên frontend.
    *   Sử dụng 2 bộ dataset có sẵn và bộ Golden Dataset trong hệ thống để đánh giá độ chính xác của cử chỉ và khuôn mặt, không cần tích hợp thêm mô hình tùy chỉnh (custom model) bên ngoài.
    *   Thực thi các thuật toán Trí tuệ nhân tạo (Computer Vision, Classification) trực tiếp trên trình duyệt thông qua WebRTC. Điều này giúp xử lý hình ảnh tức thời (real-time) và giảm tải cho server.
*   **Phương pháp tiếp cận**: Trẻ em sẽ đóng vai trò là "Người Thầy" dạy cho "Bạn AI" học thông qua quy trình: **Thu thập dữ liệu** ➔ **Huấn luyện** ➔ **Sử dụng & Đánh giá**.

## 2. Phân tích và Thiết kế hệ thống

### 2.1. Kiến trúc tổng thể & Tích hợp Cloud Storage

*   **Frontend (Next.js 16)**: Chịu trách nhiệm render UI, quản lý luồng tương tác và giao diện sinh động, gọi MediaDevices API lấy stream từ webcam và xử lý mô hình AI.
*   **Backend (NestJS 11 + PostgreSQL)**: Xử lý logic nghiệp vụ, quản lý tài khoản, phân quyền, lưu trữ thông tin tiến trình học tập của học sinh.
*   **Cloud Storage (Cloudinary)**: Tích hợp module upload qua NestJS. Hình ảnh do trẻ thu thập (bộ dữ liệu do trẻ tạo ra) sẽ được upload lên Cloudinary dưới dạng URL nội bộ (Private URL), phân quyền nghiêm ngặt để đảm bảo tuyệt đối sự riêng tư và bảo mật, chỉ có giáo viên phụ trách mới được quyền truy cập và xem lại.

### 2.2. Thiết kế Kịch bản tương tác (User Flow) & UI/UX

#### Phân hệ Học sinh: Khám phá AI qua những câu chuyện
Học sinh sẽ được dẫn dắt làm quen với AI thông qua những câu chuyện và từ ngữ sinh động, gần gũi.
*   **Tăng cường Lý thuyết & Dẫn nhập qua Câu chuyện**: 
    *   *Phân loại ảnh đơn giản (Image Classification)*: Kể các câu chuyện gần gũi như phân loại Chó và Mèo, qua đó giải thích các dạng phân loại hình ảnh cơ bản.
    *   *Nhận diện cử chỉ (Gesture Recognition)*: Khám phá **"Ngôn Ngữ Ký Hiệu Bí Mật"** (Thích, Quyết Tâm, Chiến Thắng, Chào Bạn). Lồng ghép giải thích cặn kẽ khung xương tay là gì, cách máy tính vẽ ra khung xương tay đó, và làm thế nào máy tính có thể nhận diện được cử chỉ dựa trên khung xương.
    *   *Nhận diện cảm xúc (Emotion Recognition)*: Hóa thân thành **"Thám Tử Đọc Cảm Xúc"**. Hệ thống sẽ giải thích về các biểu cảm trên khuôn mặt người, cách máy tính vẽ hệ tọa độ (landmarks) lên khuôn mặt, và phương thức máy nhận diện cảm xúc (vui, buồn, ngạc nhiên...) thông qua sự thay đổi của các tọa độ đó.
    *   *Lợi ích*: Từ các kiến thức lý thuyết nền tảng này, bé sẽ hiểu sâu hơn về sự tương tác người - máy, và vai trò của con người trong việc cung cấp dữ liệu giúp máy tính học hỏi trước khi bước vào thực hành.
*   **Quá trình Dạy "Bạn AI" (User Flow chính)**:
    1.  **Đọc truyện & Hiểu nhiệm vụ**: Bé đọc câu chuyện ngắn, hiểu rằng mình cần "chụp ảnh" để làm tài liệu học tập cho bạn AI.
    2.  **Thu thập dữ liệu**: Sử dụng camera chụp lại các biểu cảm hoặc cử chỉ. Hệ thống sẽ **tự động hiển thị nét vẽ khung xương tay, nét vẽ khung mặt (landmarks)** trực tiếp trên (1) ảnh bé đang chụp và (2) bộ dữ liệu bé đã nộp. Giao diện trực quan sẽ báo cho bé biết khi nào đã đủ số lượng ảnh cần thiết.
    3.  **Huấn luyện (Train)**: Bé bấm nút "Dạy bạn AI học" và quan sát quá trình AI "tiêu hóa" kiến thức.
    4.  **Sử dụng & Đánh giá (Test & Evaluate)**: Sau khi huấn luyện xong, bé có thể sử dụng lại chính "bạn AI" mà mình vừa dạy để đánh giá lại bộ dữ liệu. Giao diện sẽ hiển thị kết quả học tập, thông báo cho bé biết độ chính xác (accuracy) của bạn AI là bao nhiêu. Nếu AI đoán sai nhiều, hệ thống sẽ khuyến khích bé thu thập thêm ảnh đa dạng hơn để "dạy lại".
    5.  **Chơi Game Giải Trí (Mini-games)**: Đặc biệt, sau khi bé dạy bạn AI học xong và đạt độ chính xác tốt, hệ thống sẽ mở khóa các game giải trí nhỏ (mini-games). Các game này sử dụng chính mô hình học máy mà bé vừa huấn luyện, giúp bé trải nghiệm thành quả học tập của mình một cách trực quan và đầy hứng khởi.

#### Phân hệ Giáo viên / Phụ huynh: Theo dõi và Đánh giá
Cung cấp một bảng điều khiển (Dashboard) trực quan giúp giáo viên đồng hành sát sao cùng quá trình học của bé.
*   **Quản lý bộ dữ liệu**: Giáo viên có thể truy cập, xem xét các bộ dữ liệu hình ảnh mà từng học sinh đã thu thập để huấn luyện AI. Hệ thống cũng (3) **hiển thị nét vẽ khung xương tay, nét vẽ khung mặt** trên các bộ dữ liệu này giúp giáo viên dễ dàng đánh giá tính chuẩn xác của dữ liệu.
*   **Đánh giá quá trình**: Theo dõi kết quả từng đợt huấn luyện của học sinh. 
*   **Báo cáo thành tích**: 
    *   Hiển thị rõ ràng học sinh nào đã hoàn thành bài tập.
    *   Đánh giá mức độ hiểu của học sinh thông qua chất lượng bộ dữ liệu và thông số **độ chính xác (accuracy)** của mô hình mà học sinh đó đã train.

## 3. Lộ trình triển khai, Kiểm thử và Đánh giá (Verification Plan)

### Giai đoạn 1: Xây dựng Giao diện Truyện kể & Thu thập dữ liệu
*   Thiết kế giao diện cho các câu chuyện ("Đếm Ngón Tay", "Ngôn Ngữ Ký Hiệu Bí Mật", "Thám Tử Đọc Cảm Xúc").
*   Tích hợp tính năng sử dụng WebRTC thu thập hình ảnh từ Camera và upload an toàn lên Cloudinary.
*   **Kiểm thử**: Đảm bảo luồng đọc truyện trơn tru, tính năng camera chụp ảnh ổn định, bảo mật Private URL của Cloudinary hoạt động chính xác.

### Giai đoạn 2: Tích hợp AI & Quy trình Đánh giá của Học sinh
*   Áp dụng ml5.js để thực hiện quá trình huấn luyện mô hình dựa trên ảnh bé tự chụp.
*   Xây dựng UI cho phép học sinh sử dụng lại mô hình để test dữ liệu và hiển thị chỉ số độ chính xác (accuracy) bằng ngôn từ thân thiện.
*   **Kiểm thử**: Đảm bảo quá trình huấn luyện hoạt động tức thời (real-time), chỉ số accuracy được tính toán chính xác và hiển thị phù hợp với lứa tuổi của trẻ.

### Giai đoạn 3: Phân hệ Quản lý dành cho Giáo viên
*   Xây dựng API Backend (NestJS) trả về dữ liệu thống kê, báo cáo độ chính xác của các mô hình do học sinh tự làm.
*   Xây dựng giao diện Dashboard cho giáo viên xem lại hình ảnh bài tập và toàn bộ kết quả huấn luyện của từng bé.
*   **Đánh giá tổng thể**: Kiểm tra chéo phân quyền (học sinh không thể xem dữ liệu của nhau, chỉ giáo viên mới có quyền truy cập tổng quan) và thực hiện đánh giá trải nghiệm thực tế (UAT) với giáo viên.
