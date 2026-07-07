const fs = require('fs');
const readline = require('readline');
const path = require('path');

// MAP THE EMOTIONS YOU WANT TO CLASSES
const TARGET_CLASSES = {
  'happy': 'class_1',
  'sad': 'class_2',
  'surprise': 'class_3'
};

const INPUT_CSV = path.join(__dirname, 'face_landmarks.csv');
const OUTPUT_TS = path.join(__dirname, '..', 'client', 'src', 'lib', 'golden-face-dataset.ts');

function selectRepresentativeSamples(featuresList, numSamples = 20) {
  // Simple random sampling for now (or taking the first N)
  // In a real K-medoids you'd do distance matrix, but this is fast and dependency-free.
  const shuffled = [...featuresList].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, numSamples);
}

async function processDataset() {
  if (!fs.existsSync(INPUT_CSV)) {
    console.error(`Please download a face landmarks CSV and save it as ${INPUT_CSV}`);
    return;
  }

  const fileStream = fs.createReadStream(INPUT_CSV);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let isHeader = true;
  const featuresByClass = {};
  for (const key of Object.keys(TARGET_CLASSES)) featuresByClass[key] = [];

  for await (const line of rl) {
    if (isHeader) { isHeader = false; continue; }
    
    // Assuming CSV format: label, x1, y1, z1, x2, y2, z2...
    const parts = line.split(',');
    const label = parts[0].toLowerCase().trim();
    
    if (TARGET_CLASSES[label]) {
      // Extract only x, y for the first 468 points (ignoring z)
      // Or if the dataset is exactly 936 values of x,y, just map them
      const coords = parts.slice(1).map(Number);
      featuresByClass[label].push(coords);
    }
  }

  const selectedSamples = [];
  for (const [label, classId] of Object.entries(TARGET_CLASSES)) {
    const samples = featuresByClass[label];
    console.log(`${label}: Found ${samples.length} samples. Selecting 20...`);
    const selected = selectRepresentativeSamples(samples, 20);
    selectedSamples.push({ classId, label, selected });
  }

  let tsContent = `// TỰ ĐỘNG TẠO BỞI NODE.JS (Thay thế Python)\n`;
  tsContent += `import { StoredSample } from './knn-classifier';\n\n`;
  tsContent += `export const GOLDEN_FACE_DATASET: Array<{ expectedLabel: string; features: number[] }> = [\n`;

  for (const group of selectedSamples) {
    tsContent += `  // --- ${group.label} (${group.classId}) ---\n`;
    for (const feat of group.selected) {
      tsContent += `  {\n    expectedLabel: '${group.classId}',\n    features: [\n`;
      // Break into chunks of 8 for readability
      for (let i = 0; i < feat.length; i += 8) {
        tsContent += `      ${feat.slice(i, i + 8).join(', ')},\n`;
      }
      tsContent += `    ]\n  },\n`;
    }
  }
  tsContent += `];\n`;

  fs.writeFileSync(OUTPUT_TS, tsContent);
  console.log(`Success! Saved to ${OUTPUT_TS}`);
}

processDataset();
