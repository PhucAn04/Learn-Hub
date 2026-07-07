const fs = require('fs');
const path = require('path');

const CSV_FILE = path.join(__dirname, '../dataset/emotion_landmark_dataset/emotion_landmark_dataset.csv');
const TARGET_TS_FILE = path.join(__dirname, '../client/src/lib/golden-face-dataset.ts');
const NUM_SAMPLES = 20;

async function processCSV() {
  const fileStream = fs.createReadStream(CSV_FILE);

  const samplesByClass = [];
  const seenVideos = new Set();

  let isFirstLine = true;
  let linesRead = 0;
  let leftover = '';

  await new Promise((resolve, reject) => {
    fileStream.on('data', (chunk) => {
      let data = leftover + chunk.toString();
      let lines = data.split('\n');
      leftover = lines.pop() || '';

      for (const line of lines) {
        if (isFirstLine) {
          isFirstLine = false;
          continue;
        }
        
        linesRead++;
        if (linesRead % 50000 === 0) {
          console.log(`Read ${linesRead} lines...`);
        }

        if (samplesByClass.length >= NUM_SAMPLES) {
          fileStream.destroy();
          resolve();
          return;
        }

        if (!line.includes('Neutral')) continue;

        const firstComma = line.indexOf(',');
        const videoFilename = line.substring(0, firstComma);
        
        if (seenVideos.has(videoFilename)) continue;
        
        const cols = line.split(',');
        if (cols.length < 1437) continue;
        if (cols[2] !== 'Neutral') continue;

        seenVideos.add(videoFilename);

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

        samplesByClass.push(features);
        console.log(`Added Neutral sample from ${videoFilename}. Total: ${samplesByClass.length}`);
      }
    });

    fileStream.on('end', resolve);
    fileStream.on('error', reject);
  });

  if (samplesByClass.length === 0) {
    console.log('No Neutral samples found!');
    return;
  }

  console.log(`Appending ${samplesByClass.length} Neutral samples to TS file...`);
  let existingContent = fs.readFileSync(TARGET_TS_FILE, 'utf8');

  let newObjectsStr = '';
  for (const feat of samplesByClass) {
    newObjectsStr += `  // --- TU DONG THEM TU emotion_landmark_dataset.csv (Neutral) ---\n`;
    newObjectsStr += `  {\n    expectedLabel: 'class_4',\n    features: [\n`;
    for (let i = 0; i < feat.length; i += 8) {
      newObjectsStr += `      ${feat.slice(i, i + 8).join(', ')},\n`;
    }
    newObjectsStr += `    ]\n  },\n`;
  }

  const closingBracketIndex = existingContent.lastIndexOf('];');
  if (closingBracketIndex !== -1) {
    const updatedContent = existingContent.substring(0, closingBracketIndex) + newObjectsStr + '];\n';
    fs.writeFileSync(TARGET_TS_FILE, updatedContent);
    console.log(`Success! Appended ${samplesByClass.length} Neutral samples.`);
  } else {
    console.error("Could not find closing bracket '];' in the TS file!");
  }
}

processCSV().catch(console.error);
