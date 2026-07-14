const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log("🧹 Bắt đầu dọn dẹp hệ thống...");

// 1. Chạy docker-compose down -v
try {
  console.log("👉 Đang chạy docker-compose down -v...");
  execSync('docker-compose down -v', { stdio: 'inherit' });
  console.log("✅ Đã dọn dẹp xong Database Docker (các volume đã bị xóa).");
} catch (e) {
  console.error("❌ Lỗi khi chạy docker-compose down -v:", e.message);
}

// 1.5 Xóa thư mục lưu trữ datasets local
try {
  console.log("👉 Đang xóa các tệp tin lưu trữ trong server/uploads/datasets...");
  const datasetsPath = path.join(__dirname, '..', 'server', 'uploads', 'datasets');
  if (fs.existsSync(datasetsPath)) {
    fs.rmSync(datasetsPath, { recursive: true, force: true });
    // Tạo lại thư mục trống
    fs.mkdirSync(datasetsPath, { recursive: true });
    console.log("✅ Đã xóa sạch thư mục datasets cục bộ.");
  } else {
    console.log("✅ Thư mục datasets cục bộ không tồn tại, bỏ qua.");
  }
} catch (e) {
  console.error("❌ Lỗi khi xóa thư mục datasets:", e.message);
}

// 2. Load biến môi trường từ client/.env.local
let cloudName, apiKey, apiSecret;

const envPath = path.join(__dirname, '..', 'client', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (!key || !values.length) return;
    const value = values.join('=').trim().replace(/['"]/g, '');
    
    if (key.trim() === 'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME') cloudName = value;
    if (key.trim() === 'CLOUDINARY_API_KEY') apiKey = value;
    if (key.trim() === 'CLOUDINARY_API_SECRET') apiSecret = value;
  });
}

if (!cloudName || !apiKey || !apiSecret) {
  console.log("\n⚠️ Bỏ qua dọn dẹp Cloudinary vì thiếu credentials.");
  console.log("💡 Để script tự động xóa ảnh trên Cloud, hãy thêm 2 dòng sau vào file client/.env.local:");
  console.log("   CLOUDINARY_API_KEY=your_api_key");
  console.log("   CLOUDINARY_API_SECRET=your_api_secret\n");
  process.exit(0);
}

console.log(`\n🧹 Đang xóa ảnh trên Cloudinary (${cloudName})...`);

const deleteCloudinaryFolder = async () => {
  try {
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    let hasMore = true;
    let nextCursor = null;
    let totalDeleted = 0;

    while (hasMore) {
      let url = `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload?prefix=learn-hub/&max_results=500`;
      if (nextCursor) url += `&next_cursor=${nextCursor}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Basic ${auth}` }
      });
      
      if (!res.ok) throw new Error(`Lỗi fetch: ${res.status} ${res.statusText}`);
      
      const data = await res.json();
      const publicIds = data.resources.map(r => r.public_id);
      
      if (publicIds.length === 0) {
        if (totalDeleted === 0) console.log("✅ Không có ảnh nào trong thư mục 'learn-hub' cần xóa.");
        break;
      }

      console.log(`🗑️ Đang xóa batch ${publicIds.length} ảnh...`);
      
      const delUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload`;
      const params = new URLSearchParams();
      publicIds.forEach(id => params.append('public_ids[]', id));
      
      const delRes = await fetch(delUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });
      
      if (!delRes.ok) throw new Error(`Lỗi xóa: ${delRes.status} ${delRes.statusText}`);
      
      const delData = await delRes.json();
      const deletedCount = delData.deleted ? Object.keys(delData.deleted).length : 0;
      totalDeleted += deletedCount;
      
      if (data.next_cursor) {
        nextCursor = data.next_cursor;
      } else {
        hasMore = false;
      }
    }
    
    if (totalDeleted > 0) {
      console.log(`✅ Đã xóa tổng cộng ${totalDeleted} ảnh trên Cloudinary thành công!`);
    }
    
  } catch (error) {
    console.error("❌ Lỗi khi xóa ảnh Cloudinary:", error);
  }
};

deleteCloudinaryFolder();
