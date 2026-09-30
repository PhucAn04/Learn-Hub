const fs = require('fs');
const path = require('path');
const tf = require('@tensorflow/tfjs-node');
const faceLandmarksDetection = require('@tensorflow-models/face-landmarks-detection');

const DATASET_DIR = path.join(__dirname, '..', '..', 'dataset', 'FER-2013');
const OUTPUT_FILE = path.join(__dirname, '..', '..', 'client', 'src', 'lib', 'golden-face-dataset.ts');

const EMOTIONS = ['happy', 'sad', 'surprise'];
const SAMPLES_PER_EMOTION = 20;

async function run() {
  console.log('Loading model...');
  const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
  const detectorConfig = {
    runtime: 'tfjs',
    refineLandmarks: true
  };
  const detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
  console.log('Model loaded successfully.');

  const results = {};

  for (const emotion of EMOTIONS) {
    const dirPath = path.join(DATASET_DIR, emotion);
    if (!fs.existsSync(dirPath)) {
      console.warn(`Directory not found: ${dirPath}. Skipping ${emotion}.`);
      continue;
    }

    const files = fs.readdirSync(dirPath).filter(file => file.endsWith('.jpg') || file.endsWith('.png'));
    if (files.length === 0) {
      console.warn(`No images found in ${dirPath}.`);
      continue;
    }

    console.log(`Processing ${emotion}... Found ${files.length} images.`);
    results[emotion] = [];

    // Shuffle and pick
    files.sort(() => 0.5 - Math.random());
    let processedCount = 0;

    for (const file of files) {
      if (processedCount >= SAMPLES_PER_EMOTION) break;

      const filePath = path.join(dirPath, file);
      try {
        const imageBuffer = fs.readFileSync(filePath);
        // decodeImage expects Uint8Array
        const tensor = tf.node.decodeImage(new Uint8Array(imageBuffer));
        
        const faces = await detector.estimateFaces(tensor);
        if (faces.length > 0) {
          const keypoints = faces[0].keypoints;
          // Normalize coordinates (Nose tip is 1)
          const noseTip = keypoints[1];
          let maxDist = 0;
          
          const normalized = keypoints.map(kp => {
            const dx = kp.x - noseTip.x;
            const dy = kp.y - noseTip.y;
            const dz = (kp.z || 0) - (noseTip.z || 0);
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (dist > maxDist) maxDist = dist;
            return { x: dx, y: dy, z: dz };
          });

          // Flatten and divide by maxDist
          const flatArray = [];
          normalized.forEach(kp => {
            flatArray.push(Number((kp.x / maxDist).toFixed(4)));
            flatArray.push(Number((kp.y / maxDist).toFixed(4)));
            flatArray.push(Number((kp.z / maxDist).toFixed(4)));
          });

          results[emotion].push(flatArray);
          processedCount++;
        }
        tensor.dispose();
      } catch (err) {
        console.error(`Error processing ${filePath}:`, err.message);
      }
    }
    
    console.log(`Finished ${emotion}: Extracted ${results[emotion].length} samples.`);
  }

  // Generate output file
  let tsContent = `// Tệp dữ liệu toạ độ biểu cảm khuôn mặt chuẩn (Golden Dataset)
// Tự động trích xuất bằng @tensorflow/tfjs-node trong thư mục scripts/tfjs-extractor
// NGUON DU LIEU: FER-2013 (Facial Expression Recognition 2013) - Kaggle

export const GOLDEN_FACE_DATASET: Record<string, number[][]> = {\n`;

  for (const emotion in results) {
    tsContent += `  ${emotion}: [\n`;
    for (const arr of results[emotion]) {
      tsContent += `    [${arr.join(', ')}],\n`;
    }
    tsContent += `  ],\n`;
  }
  tsContent += `};\n`;

  fs.writeFileSync(OUTPUT_FILE, tsContent, 'utf-8');
  console.log(`Successfully wrote to ${OUTPUT_FILE}`);
}

run().catch(console.error);
