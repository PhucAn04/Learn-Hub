import { Layers, Cpu, Bot, FileCheck, BrainCircuit } from 'lucide-react';

export default function TechStackPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-sky-50 py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-block p-4 rounded-full bg-white shadow-lg mb-4">
            <span className="text-6xl">🤖</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 uppercase">
            Artificial Intelligence Core
          </h1>
          <p className="text-xl text-gray-600 font-bold max-w-2xl mx-auto">
            Lõi Trí Tuệ Nhân Tạo (AI Core)
          </p>
        </div>

        {/* AI & Machine Learning */}
        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-xl border-4 border-yellow-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-50 rounded-bl-full -z-10" />
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-yellow-100 rounded-2xl flex items-center justify-center">
              <Bot className="w-8 h-8 text-yellow-600" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-800">Kiến Trúc Học Máy Tại Trình Duyệt</h2>
              <p className="text-slate-500 font-medium mt-1">Browser-based Machine Learning Frameworks</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-yellow-600" />
                Mô hình có sẵn (Pre-trained Models)
              </h3>
              <ul className="space-y-3">
                <li className="bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                  <strong className="text-yellow-800 block">HandPose & FaceMesh</strong>
                  <span className="text-sm text-yellow-700">Theo dõi 21 điểm khớp tay và 478 điểm trên khuôn mặt.</span>
                </li>
                <li className="bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                  <strong className="text-yellow-800 block">BlazePose</strong>
                  <span className="text-sm text-yellow-700">Nhận diện tư thế cơ thể toàn diện từ luồng video.</span>
                </li>
                <li className="bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                  <strong className="text-yellow-800 block">MobileNet v2 (Feature Extraction)</strong>
                  <span className="text-sm text-yellow-700">Rút trích đặc trưng ảnh chuyên sâu để phân loại đối tượng.</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-yellow-600" />
                Huấn Luyện (Training)
              </h3>
              <ul className="space-y-3">
                <li className="bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                  <strong className="text-yellow-800 block">TensorFlow.js & ml5.js</strong>
                  <span className="text-sm text-yellow-700">Chạy toàn bộ quá trình thu thập, huấn luyện (KNN, MLP) và suy luận mô hình ngay tại máy người dùng.</span>
                </li>
                <li className="bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                  <strong className="text-yellow-800 block">OOD Outlier Filter</strong>
                  <span className="text-sm text-yellow-700">Bộ lọc thông minh giúp tự động từ chối kết quả nếu vật thể không nằm trong tập dữ liệu huấn luyện.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Dataset Standards Section */}
        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-xl border-4 border-indigo-100 relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-50 rounded-tr-full -z-10" />
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center">
              <FileCheck className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-800">Trích Xuất Từ Dataset Chuẩn Mực</h2>
              <p className="text-slate-500 font-medium mt-1">Xây dựng hệ thống học tập dựa trên dữ liệu thực tế</p>
            </div>
          </div>
          
          <p className="text-slate-600 leading-relaxed mb-4">
            Hệ thống được hình thành thông qua quá trình thu thập và xử lý các tập dữ liệu ảnh và file CSV (Dataset) chuẩn mực. Từ các tập dữ liệu gốc này, hệ thống tiến hành quá trình trích xuất để lấy ra tọa độ của các điểm mốc (landmarks) hoặc rút trích các vector đặc trưng (features) quan trọng nhất của hình ảnh.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Các vector và tọa độ sau khi trích xuất sẽ được phân tích, tối ưu hóa và lưu trữ làm các bộ tiêu chuẩn (Golden Dataset). Khi học sinh tương tác thực tế với camera, mô hình học máy trên trình duyệt sẽ sử dụng các bộ dữ liệu chuẩn mực này làm cơ sở đối chiếu, từ đó đánh giá và phân loại kết quả một cách chính xác và nhanh chóng nhất.
          </p>
        </div>

      </div>
    </div>
  );
}
