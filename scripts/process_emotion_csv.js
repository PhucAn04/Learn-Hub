const fs = require('fs');
const readline = require('readline');
const path = require('path');

const CSV_FILE = path.join(__dirname, '../dataset/emotion_landmark_dataset/emotion_landmark_dataset.csv');
const TARGET_TS_FILE = path.join(__dirname, '../client/src/lib/golden-face-dataset.ts');
const NUM_SAMPLES_PER_CLASS = 20;

const CLASS_MAP = {
  'Happy': 'class_1',
  'Sad': 'class_2'
};

async function processCSV() {
  const fileStream = fs.createReadStream(CSV_FILE);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const samplesByClass = {
    'class_1': [],
    'class_2': []
  };

  const seenVideosByClass = {
    'class_1': new Set(),
    'class_2': new Set()
  };

  let isFirstLine = true;
  let linesRead = 0;

  for await (const line of rl) {
    if (isFirstLine) {
      isFirstLine = false;
      continue;
    }
    
    linesRead++;
    if (linesRead % 10000 === 0) {
      console.log(`Read ${linesRead} lines...`);
    }

    let classId = null;
    let emotionStr = null;
    if (line.includes('Happy')) { classId = 'class_1'; emotionStr = 'Happy'; }
    else if (line.includes('Sad')) { classId = 'class_2'; emotionStr = 'Sad'; }

    if (!classId) continue;

    if (samplesByClass[classId].length >= NUM_SAMPLES_PER_CLASS) {
      if (samplesByClass['class_1'].length >= NUM_SAMPLES_PER_CLASS &&
          samplesByClass['class_2'].length >= NUM_SAMPLES_PER_CLASS) {
        console.log('Got enough samples for Happy and Sad. Stopping early.');
        break;
      }
      continue;
    }

    const firstComma = line.indexOf(',');
    const videoFilename = line.substring(0, firstComma);
    
    if (seenVideosByClass[classId].has(videoFilename)) {
      continue;
    }
    
    const cols = line.split(',');
    if (cols.length < 1437) continue;

    seenVideosByClass[classId].add(videoFilename);

    const points = [];
    for (let i = 0; i < 468; i++) {
      const xIndex = 3 + i * 3;
      const yIndex = 4 + i * 3;
      points.push({
        x: parseFloat(cols[xIndex]),
        y: parseFloat(cols[yIndex])
      });
    }

    const noseTip = points[1];
    const translated = points.map(p => ({
      x: p.x - noseTip.x,
      y: p.y - noseTip.y
    }));
    
    let maxDist = 0.0001;
    for (const p of translated) {
      const dist = Math.sqrt(p.x * p.x + p.y * p.y);
      if (dist > maxDist) maxDist = dist;
    }
    
    const features = [];
    for (const p of translated) {
      features.push(Number((p.x / maxDist).toFixed(4)));
      features.push(Number((p.y / maxDist).toFixed(4)));
    }

    samplesByClass[classId].push(features);
    console.log(`Added sample for ${classId} from ${videoFilename}. Total: ${samplesByClass[classId].length}`);
  }

  const finalDataset = [];
  for (const [classId, featuresList] of Object.entries(samplesByClass)) {
    for (const feat of featuresList) {
      finalDataset.push({ expectedLabel: classId, features: feat });
    }
  }

  console.log('Appending to existing TS file...');
  let existingContent = fs.readFileSync(TARGET_TS_FILE, 'utf8');

  let newObjectsStr = '';
  for (const group of finalDataset) {
    newObjectsStr += `  // --- TU DONG THEM TU emotion_landmark_dataset.csv ---\n`;
    newObjectsStr += `  {\n    expectedLabel: '${group.expectedLabel}',\n    features: [\n`;
    const feat = group.features;
    for (let i = 0; i < feat.length; i += 8) {
      newObjectsStr += `      ${feat.slice(i, i + 8).join(', ')},\n`;
    }
    newObjectsStr += `    ]\n  },\n`;
  }

  // Find the closing bracket of the array and insert the new objects right before it
  const closingBracketIndex = existingContent.lastIndexOf('];');
  if (closingBracketIndex !== -1) {
    const updatedContent = existingContent.substring(0, closingBracketIndex) + newObjectsStr + '];\n';
    fs.writeFileSync(TARGET_TS_FILE, updatedContent);
    console.log(`Success! Appended ${finalDataset.length} samples to ${TARGET_TS_FILE}`);
  } else {
    console.error("Could not find closing bracket '];' in the TS file!");
  }
}

processCSV().catch(console.error);
