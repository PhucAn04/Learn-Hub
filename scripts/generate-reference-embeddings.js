/**
 * Scripts: Generate MobileNet Reference Embeddings & Centroids
 *
 * Trích xuất vector đặc trưng 1280 chiều từ MobileNet v2 cho các mẫu ảnh
 * trong 5 bộ dataset kiểm thử (Cats & Dogs, Fruit, Pest, PlantVillage, Rock-Paper-Scissors).
 * Phục vụ các kịch bản chuẩn:
 *   1. "Bác sĩ Nông nghiệp" (healthy_leaf, diseased_leaf, beetle)
 *   2. "Thế giới Động vật" (dog, cat, beetle)
 *   3. "Oẳn Tù Tì" (rock, paper, scissors)
 *   4. "Vườn Trái Cây" (apple, banana, orange)
 *
 * Sử dụng HTTP server stream ảnh trực tiếp tránh nghẽn bộ nhớ base64.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const sampleDirs = {
  // Cats & Dogs
  dog: 'dataset/Cats_And_Dogs_Mini_Dataset/dogs_set',
  cat: 'dataset/Cats_And_Dogs_Mini_Dataset/cats_set',
  // Rock Paper Scissors
  rock: 'dataset/Rock_Paper_Scissors_Images/rock',
  paper: 'dataset/Rock_Paper_Scissors_Images/paper',
  scissors: 'dataset/Rock_Paper_Scissors_Images/scissors',
  // Plant Village
  healthy_leaf: 'dataset/Plant_Village/train/Tomato___healthy',
  diseased_leaf: 'dataset/Plant_Village/train/Tomato___Early_blight',
  // Fruit Classification (10 classes)
  apple: 'dataset/Fruit_Classification_10_Class/train/Apple',
  banana: 'dataset/Fruit_Classification_10_Class/train/Banana',
  orange: 'dataset/Fruit_Classification_10_Class/train/orange',
  avocado: 'dataset/Fruit_Classification_10_Class/train/avocado',
  cherry: 'dataset/Fruit_Classification_10_Class/train/cherry',
  kiwi: 'dataset/Fruit_Classification_10_Class/train/kiwi',
  mango: 'dataset/Fruit_Classification_10_Class/train/mango',
  pineapple: 'dataset/Fruit_Classification_10_Class/train/pinenapple',
  strawberries: 'dataset/Fruit_Classification_10_Class/train/strawberries',
  watermelon: 'dataset/Fruit_Classification_10_Class/train/watermelon',
  // Pest Dataset (9 classes)
  beetle: 'dataset/Pest_Dataset/train/beetle',
  grasshopper: 'dataset/Pest_Dataset/train/grasshopper',
  armyworm: 'dataset/Pest_Dataset/train/armyworm',
  aphids: 'dataset/Pest_Dataset/train/aphids',
  bollworm: 'dataset/Pest_Dataset/train/bollworm',
  mites: 'dataset/Pest_Dataset/train/mites',
  mosquito: 'dataset/Pest_Dataset/train/mosquito',
  sawfly: 'dataset/Pest_Dataset/train/sawfly',
  stem_borer: 'dataset/Pest_Dataset/train/stem_borer',
};

// 1. Quét danh sách file ảnh cục bộ (25 ảnh/lớp, ưu tiên file gốc không trùng 'Copy')
const classFiles = {};
const scriptsJsonPath = path.join(__dirname, 'reference_centroids.json');
let existingCentroids = {};
if (fs.existsSync(scriptsJsonPath)) {
  try {
    existingCentroids = JSON.parse(fs.readFileSync(scriptsJsonPath, 'utf8'));
  } catch (e) {}
}

const FORCE_ALL = process.argv.includes('--force');

Object.entries(sampleDirs).forEach(([cls, relDir]) => {
  if (!FORCE_ALL && existingCentroids[cls] && Array.isArray(existingCentroids[cls]) && existingCentroids[cls].length === 1280) {
    console.log(`[Samples] ${cls}: Đã có sẵn centroid trong reference_centroids.json (bỏ qua).`);
    return;
  }
  const fullDir = path.join(PROJECT_ROOT, relDir);
  if (fs.existsSync(fullDir)) {
    const all = fs.readdirSync(fullDir).filter((f) => /\.(jpe?g|png)$/i.test(f));
    const nonCopy = all.filter((f) => !f.includes('Copy'));
    const chosen = (nonCopy.length >= 25 ? nonCopy : all).slice(0, 25);
    classFiles[cls] = chosen.map((f) => path.join(fullDir, f));
    console.log(`[Samples] ${cls}: ${classFiles[cls].length} ảnh cần trích xuất`);
  }
});

if (Object.keys(classFiles).length === 0) {
  console.log('[Info] Tất cả các lớp đã có sẵn centroid đầy đủ. Không cần trích xuất thêm.');
  const clientJsonPath = path.join(PROJECT_ROOT, 'client', 'src', 'lib', 'reference_centroids.json');
  saveCompactJson(clientJsonPath, existingCentroids);
  process.exit(0);
}

// 2. HTML Runner gọn nhẹ
const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js"></script>
</head>
<body>
  <div id="status">Khởi tạo...</div>
  <script>
    const MOBILENET_URL = 'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/feature_vector/3/default/1';

    async function run() {
      const status = document.getElementById('status');
      status.innerText = 'Đang tải MobileNet v2 từ TFHub...';
      const model = await tf.loadGraphModel(MOBILENET_URL, { fromTFHub: true });

      const manifest = await (await fetch('/manifest')).json();
      const centroids = {};

      for (const [cls, count] of Object.entries(manifest)) {
        status.innerText = 'Đang trích xuất: ' + cls + ' (0/' + count + ')...';
        await fetch('/log?msg=' + encodeURIComponent('Bắt đầu lớp: ' + cls + ' (' + count + ' ảnh)'));
        const vectors = [];

        for (let i = 0; i < count; i++) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = '/image?cls=' + cls + '&idx=' + i;
          const loaded = await new Promise((resolve) => {
            img.onload = () => resolve(true);
            img.onerror = () => {
              fetch('/log?msg=' + encodeURIComponent('Cảnh báo lỗi ảnh: ' + cls + ' #' + i));
              resolve(false);
            };
          });

          if (!loaded) continue;

          try {
            const vec = tf.tidy(() => {
              let tensor = tf.browser.fromPixels(img);
              tensor = tf.image.resizeBilinear(tensor, [224, 224]);
              const normalized = tensor.toFloat().div(255.0);
              const batched = normalized.expandDims(0);
              const feat = model.predict(batched);
              const raw = Array.from(feat.dataSync());
              const norm = Math.sqrt(raw.reduce((sum, v) => sum + v * v, 0)) || 1;
              return raw.map(v => v / norm);
            });

            vectors.push(vec);
          } catch (err) {
            fetch('/log?msg=' + encodeURIComponent('Lỗi tensor ảnh: ' + cls + ' #' + i + ': ' + err.message));
          }
        }

        if (vectors.length === 0) {
          await fetch('/log?msg=' + encodeURIComponent('Cảnh báo: Không có vector nào cho lớp ' + cls));
          continue;
        }

        const dim = vectors[0].length;
        const mean = new Array(dim).fill(0);
        for (const v of vectors) {
          for (let d = 0; d < dim; d++) mean[d] += v[d];
        }
        for (let d = 0; d < dim; d++) mean[d] /= vectors.length;

        let norm = 0;
        for (let d = 0; d < dim; d++) norm += mean[d] * mean[d];
        norm = Math.sqrt(norm) || 1;
        for (let d = 0; d < dim; d++) mean[d] = Number((mean[d] / norm).toFixed(6));

        centroids[cls] = mean;
        await fetch('/log?msg=' + encodeURIComponent('Hoàn tất lớp: ' + cls + ' (từ ' + vectors.length + ' ảnh)'));
      }

      await fetch('/done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(centroids)
      });
    }

    run().catch(e => {
      fetch('/error', { method: 'POST', body: e.stack || e.message });
    });
  </script>
</body>
</html>`;

// 3. Hàm lưu JSON 1 dòng/lớp
function saveCompactJson(filePath, data) {
  const lines = ['{'];
  const keys = Object.keys(data);
  keys.forEach((k, idx) => {
    const comma = idx < keys.length - 1 ? ',' : '';
    lines.push(`  ${JSON.stringify(k)}: ${JSON.stringify(data[k])}${comma}`);
  });
  lines.push('}');
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
}

// 4. Khởi chạy HTTP Server & Headless Browser
const PORT = 3388;
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);

  if (parsedUrl.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } else if (parsedUrl.pathname === '/manifest') {
    const manifest = {};
    Object.entries(classFiles).forEach(([k, list]) => {
      manifest[k] = list.length;
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(manifest));
  } else if (parsedUrl.pathname === '/log') {
    console.log('[Browser]', parsedUrl.searchParams.get('msg'));
    res.writeHead(200);
    res.end('OK');
  } else if (parsedUrl.pathname === '/image') {
    const cls = parsedUrl.searchParams.get('cls');
    const idx = parseInt(parsedUrl.searchParams.get('idx') || '0', 10);
    const filePath = classFiles[cls]?.[idx];

    if (filePath && fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  } else if (parsedUrl.pathname === '/done' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      res.writeHead(200);
      res.end('OK');
      const newCentroids = JSON.parse(body);
      const mergedCentroids = { ...existingCentroids, ...newCentroids };

      const scriptsJsonPath = path.join(__dirname, 'reference_centroids.json');
      const clientJsonPath = path.join(PROJECT_ROOT, 'client', 'src', 'lib', 'reference_centroids.json');

      saveCompactJson(scriptsJsonPath, mergedCentroids);
      saveCompactJson(clientJsonPath, mergedCentroids);

      console.log(`[Success] Saved ${Object.keys(mergedCentroids).length} centroids to:\n  - ${scriptsJsonPath}\n  - ${clientJsonPath}`);
      server.close();
      process.exit(0);
    });
  } else if (parsedUrl.pathname === '/error') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      console.error('[Error in browser]:', body);
      res.writeHead(500);
      res.end('ERR');
      server.close();
      process.exit(1);
    });
  }
});

server.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpProfile = path.join(process.env.TEMP || 'C:\\Temp', 'edge_gen_' + Date.now());
  const cmd = `"${edgePath}" --headless=new --disable-gpu --user-data-dir="${tmpProfile}" "http://localhost:${PORT}"`;
  exec(cmd, (err) => {
    if (err) console.error('Edge launch error:', err.message);
  });
});
