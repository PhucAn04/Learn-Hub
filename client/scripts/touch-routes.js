const fs = require('fs');
const path = require('path');

function touchFiles(dir, matchPattern) {
  const files = fs.readdirSync(dir);
  let count = 0;
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      count += touchFiles(fullPath, matchPattern);
    } else if (matchPattern.test(file)) {
      const now = new Date();
      fs.utimesSync(fullPath, now, now);
      count++;
    }
  }
  return count;
}

const appDir = path.join(__dirname, '../src/app');
try {
  console.log('🔄 Đang kích hoạt lại các routes...');
  const count = touchFiles(appDir, /^(page|layout)\.tsx?$/);
  console.log(`✅ Đã làm mới (touch) thành công ${count} files (page/layout) trong src/app.`);
  console.log(`👉 Next.js dev server đã nhận diện lại các route. Vui lòng F5 lại trang web!`);
} catch (error) {
  console.error('❌ Lỗi khi làm mới file:', error);
}
