import { BookOpen, Camera, Hand, Brain, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function UserGuidePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-block p-4 rounded-full bg-white shadow-lg mb-4">
            <span className="text-6xl">📖</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 uppercase">
            Teachers & Students Guide
          </h1>
          <p className="text-xl text-gray-600 font-bold max-w-2xl mx-auto">
            Hướng Dẫn Cho Giáo Viên & Học Sinh
          </p>
        </div>

        {/* Step 1 */}
        <div className="bg-white rounded-3xl p-8 shadow-lg border-2 border-teal-100 flex flex-col md:flex-row gap-8 items-center">
          <div className="w-24 h-24 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center shrink-0">
            <Camera className="w-12 h-12" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">1. Quyền Truy Cập Camera</h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              Hệ thống yêu cầu quyền truy cập Webcam để thực hiện tính năng nhận diện. Khi có hộp thoại hiện lên trên trình duyệt, vui lòng chọn <strong>"Cho phép" (Allow)</strong>.
            </p>
            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 flex gap-3 text-yellow-800 text-sm">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <p>Nếu bạn lỡ bấm Chặn (Block), hệ thống sẽ hiển thị một <strong>Màn hình hướng dẫn khôi phục quyền</strong> (Recovery Guide) chi tiết từng bước mà không làm crash ứng dụng.</p>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-white rounded-3xl p-8 shadow-lg border-2 border-cyan-100 flex flex-col md:flex-row gap-8 items-center">
          <div className="w-24 h-24 bg-cyan-100 text-cyan-600 rounded-full flex items-center justify-center shrink-0 md:order-last">
            <Hand className="w-12 h-12" />
          </div>
          <div className="md:text-right">
            <h2 className="text-2xl font-black text-slate-800 mb-2">2. Cách Thức Thu Thập Dữ Liệu</h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              Ứng dụng thiết kế cơ chế <strong>Hold-to-Capture</strong> (Nhấn giữ để chụp). Bé chỉ cần nhấn giữ nút chụp trong vài giây là có thể thu thập đủ vài chục bức ảnh làm dữ liệu thay vì phải bấm từng cái một.
            </p>
            <div className="bg-cyan-50 p-4 rounded-xl border border-cyan-200 inline-flex gap-3 text-cyan-800 text-sm text-left">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-cyan-600" />
              <p>Thuật toán <strong>Laplacian Blur</strong> sẽ tự động kiểm tra, nếu tay di chuyển quá nhanh làm ảnh bị nhòe hoặc môi trường quá tối, hệ thống sẽ tự động loại bỏ tấm ảnh đó và cảnh báo.</p>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-white rounded-3xl p-8 shadow-lg border-2 border-blue-100 flex flex-col md:flex-row gap-8 items-center">
          <div className="w-24 h-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
            <Brain className="w-12 h-12" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">3. Mẹo Dạy AI Thông Minh Hơn</h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              Sau khi thu thập đủ dữ liệu (ít nhất 30-50 tấm cho mỗi nhãn), hãy nhấn nút <strong>"Huấn luyện"</strong>. Quá trình này diễn ra hoàn toàn trên máy của bạn.
            </p>
            <ul className="space-y-2 text-sm text-slate-600 font-medium">
              <li>• Nên giơ tay ở nhiều góc độ và khoảng cách khác nhau so với camera.</li>
              <li>• Hệ thống có chức năng <strong>OOD (Out-of-Distribution) Filter</strong>. Nghĩa là nếu bạn đưa một đồ vật lạ không nằm trong danh sách đã học, AI sẽ báo "Không nhận ra" thay vì đoán mò bậy bạ.</li>
              <li>• <strong>Giáo viên:</strong> Có thể sử dụng bảng điều khiển (Teacher Dashboard) với công cụ Confusion Matrix để phân tích chéo kết quả học tập của các bé.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
