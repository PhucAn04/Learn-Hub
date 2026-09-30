const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3377;
const centroidsPath = path.resolve('client/src/lib/reference_centroids.json');
if (!fs.existsSync(centroidsPath)) {
  console.error('[Error] Không tìm thấy file reference_centroids.json');
  process.exit(1);
}

const centroids = JSON.parse(fs.readFileSync(centroidsPath, 'utf8'));
const classKeys = Object.keys(centroids);

const targetModelDir = path.resolve('client/public/models/dataset_classifier');
fs.mkdirSync(targetModelDir, { recursive: true });

console.log('================================================================');
console.log('  TENSORFLOW.JS 26-CLASS NEURAL NETWORK TRAINING PIPELINE');
console.log('================================================================');
console.log(`[1/4] Loaded ${classKeys.length} classes from reference centroids.`);

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js"></script>
</head>
<body>
  <h1>TF.js Dataset Classifier Training</h1>
  <div id="status">Initializing...</div>
  <script>
    window.onerror = function(msg, url, line, col, error) {
      const errStr = 'Window Error: ' + msg + ' (' + url + ':' + line + ':' + col + ') ' + (error ? error.stack : '');
      fetch('/error', { method: 'POST', body: errStr });
    };

    async function run() {
      try {
        const status = document.getElementById('status');
        status.innerText = 'TF.js version: ' + tf.version.tfjs;
        await fetch('/log?msg=tf_ready_' + tf.version.tfjs);
        
        const res = await fetch('/centroids');
        const centroids = await res.json();
        const classKeys = Object.keys(centroids);
        const numClasses = classKeys.length;
        const dim = 1280;
        const SAMPLES_PER_CLASS = 15;
        
        const totalSamples = numClasses * SAMPLES_PER_CLASS;
        await fetch('/log?msg=' + encodeURIComponent('Building training tensors: ' + totalSamples + ' samples across ' + numClasses + ' classes...'));
        
        // Build flat Float32Array directly for fast tensor creation
        const flatData = new Float32Array(totalSamples * dim);
        const labelsData = new Int32Array(totalSamples);
        
        let sampleIdx = 0;
        for (let c = 0; c < numClasses; c++) {
          const key = classKeys[c];
          const center = centroids[key];
          
          for (let s = 0; s < SAMPLES_PER_CLASS; s++) {
            let sumSq = 0;
            const offset = sampleIdx * dim;
            for (let d = 0; d < dim; d++) {
              const noise = s === 0 ? 0 : (Math.random() - 0.5) * 0.06;
              const val = center[d] + noise;
              flatData[offset + d] = val;
              sumSq += val * val;
            }
            // L2 normalize
            const norm = Math.sqrt(sumSq) || 1;
            for (let d = 0; d < dim; d++) {
              flatData[offset + d] /= norm;
            }
            labelsData[sampleIdx] = c;
            sampleIdx++;
          }
        }
        
        const xs = tf.tensor2d(flatData, [totalSamples, dim]);
        const ys = tf.oneHot(tf.tensor1d(labelsData, 'int32'), numClasses);
        
        await fetch('/log?msg=Constructing_Neural_Network_Architecture...');
        
        // Architecture: Dense(128, relu) -> Dropout(0.15) -> Dense(64, relu) -> Dense(26, softmax)
        const model = tf.sequential();
        model.add(tf.layers.dense({ units: 128, activation: 'relu', inputShape: [dim], kernelInitializer: 'glorotUniform' }));
        model.add(tf.layers.dropout({ rate: 0.15 }));
        model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
        model.add(tf.layers.dense({ units: numClasses, activation: 'softmax' }));
        
        model.compile({
          optimizer: tf.train.adam(0.003),
          loss: 'categoricalCrossentropy',
          metrics: ['accuracy']
        });
        
        await fetch('/log?msg=Training_Model_25_Epochs...');
        const t0 = performance.now();
        
        await model.fit(xs, ys, {
          epochs: 25,
          batchSize: 32,
          shuffle: true,
          callbacks: {
            onEpochEnd: async (epoch, logs) => {
              await tf.nextFrame();
              if ((epoch + 1) % 5 === 0 || epoch === 24) {
                const acc = Math.round((logs.acc || logs.accuracy || 0) * 1000) / 10;
                const loss = Math.round((logs.loss || 0) * 1000) / 1000;
                fetch('/log?msg=' + encodeURIComponent('Epoch ' + (epoch + 1) + '/25: loss=' + loss + ', acc=' + acc + '%')).catch(() => {});
              }
            }
          }
        });
        
        const trainDuration = Math.round(performance.now() - t0);
        await fetch('/log?msg=' + encodeURIComponent('Training completed in ' + trainDuration + 'ms'));
        
        // Verification test inside browser
        const testDog = tf.tensor2d([centroids['dog']]);
        const predDog = model.predict(testDog);
        const dogProbs = Array.from(predDog.dataSync());
        const dogTopIdx = dogProbs.indexOf(Math.max(...dogProbs));
        const dogTopClass = classKeys[dogTopIdx];
        const dogConfidence = Math.round(dogProbs[dogTopIdx] * 1000) / 10;
        await fetch('/log?msg=' + encodeURIComponent('Test Inference Dog: Predicted ' + dogTopClass + ' with ' + dogConfidence + '% confidence'));
        
        // Export model
        await fetch('/log?msg=Exporting_Model_Artifacts...');
        await model.save(tf.io.withSaveHandler(async (artifacts) => {
          // Send topology & specs first
          await fetch('/save-topology', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              modelTopology: artifacts.modelTopology,
              weightSpecs: artifacts.weightSpecs,
              classKeys: classKeys
            })
          });
          
          // Send raw binary weights
          await fetch('/save-weights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: artifacts.weightData
          });
          
          return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
        }));
        
        await fetch('/log?msg=Finished_Successfully!');
        await fetch('/finish');
      } catch (err) {
        await fetch('/error', { method: 'POST', body: (err && err.stack) || String(err) });
      }
    }
    run();
  </script>
</body>
</html>`;

let savedTopology = null;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } else if (url.pathname === '/centroids') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(centroids));
  } else if (url.pathname === '/log') {
    const msg = url.searchParams.get('msg') || '';
    console.log('[Training Log]', msg);
    res.writeHead(200);
    res.end('OK');
  } else if (url.pathname === '/error' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      console.error('\n[BROWSER RUNTIME ERROR]:', body);
      res.writeHead(200);
      res.end('ERR_LOGGED');
      server.close();
      process.exit(1);
    });
  } else if (url.pathname === '/save-topology' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        savedTopology = JSON.parse(body);
        res.writeHead(200);
        res.end('OK');
      } catch (err) {
        res.writeHead(500);
        res.end(err.message);
      }
    });
  } else if (url.pathname === '/save-weights' && req.method === 'POST') {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const weightBuffer = Buffer.concat(chunks);
        const weightsBinPath = path.join(targetModelDir, 'weights.bin');
        fs.writeFileSync(weightsBinPath, weightBuffer);
        
        if (savedTopology) {
          const modelJson = {
            modelTopology: savedTopology.modelTopology,
            weightsManifest: [
              {
                paths: ['weights.bin'],
                weights: savedTopology.weightSpecs
              }
            ],
            format: 'layers-model',
            generatedBy: 'TensorFlow.js tfjs@4.22.0',
            convertedBy: null
          };
          const modelJsonPath = path.join(targetModelDir, 'model.json');
          fs.writeFileSync(modelJsonPath, JSON.stringify(modelJson, null, 2), 'utf8');
          
          const classNamesPath = path.join(targetModelDir, 'class_names.json');
          fs.writeFileSync(classNamesPath, JSON.stringify(savedTopology.classKeys, null, 2), 'utf8');
          
          console.log(`[Success] TensorFlow.js Model Artifacts successfully saved to:`);
          console.log(`  - ${modelJsonPath} (${fs.statSync(modelJsonPath).size} bytes)`);
          console.log(`  - ${weightsBinPath} (${fs.statSync(weightsBinPath).size} bytes)`);
          console.log(`  - ${classNamesPath} (${savedTopology.classKeys.length} classes)`);
        }
        res.writeHead(200);
        res.end('OK');
      } catch (err) {
        console.error('[Error saving weights]:', err);
        res.writeHead(500);
        res.end(err.message);
      }
    });
  } else if (url.pathname === '/finish') {
    res.writeHead(200);
    res.end('OK');
    console.log('[Server] Pipeline completed gracefully.');
    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`[Server] Training server listening on http://localhost:${PORT}`);
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpProfile = path.join(process.env.TEMP || 'C:\\Temp', 'edge_train_' + Date.now());
  const cmd = `"${edgePath}" --headless=new --user-data-dir="${tmpProfile}" "http://localhost:${PORT}"`;
  exec(cmd, (err) => {
    if (err) console.error('[Edge Launch Error]:', err.message);
  });
});
