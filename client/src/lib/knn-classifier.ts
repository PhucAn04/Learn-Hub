export interface HandKeypoint {
  x: number;
  y: number;
  z?: number;
}

export interface SampleQualityMeta {
  brightness: number;    // 0-255, trung bình cường độ xám
  blurScore: number;     // Laplacian variance, càng thấp càng mờ
  isDark: boolean;       // brightness < 60
  isBright: boolean;     // brightness > 200
  isBlurry: boolean;     // blurScore < ngưỡng
}

export interface StoredSample {
  id?: string;        // Unique identifier for the sample
  label: string;
  features: number[]; // e.g., 42 for hands, 936 for face
  sourceId?: string;  // Track which UI class generated this (for compound classes)
  sourceType?: 'gesture' | 'object'; // origin/type of the sample
  thumbnail?: string; // base64 image data for preview (with skeleton)
  rawThumbnail?: string; // base64 image data for preview (without skeleton)
  isValid?: boolean;  // whether the sample was validated as correct by AI
  isQuestionable?: boolean; // sample accepted in Explorer Mode despite AI suspecting wrong label
  questionableReason?: string; // why AI thinks this sample might be wrong
  invalidReason?: string; // specific reason for invalidation (e.g. wrong finger count)
  quality?: SampleQualityMeta; // Image quality metadata (brightness, blur)
  aiFeedback?: {      // Feedback set by AI evaluation after training
    isMisclassified: boolean;
    predictedLabel: string;
    nearestMatchThumbnail?: string;
  };
}

/**
 * Normalize hand keypoints (21 landmarks) to be scale and translation invariant.
 * 1. Translate wrist (index 0) to (0, 0)
 * 2. Find max distance from wrist to any keypoint
 * 3. Scale all keypoints by dividing by max distance
 */
export function normalizeHandKeypoints(keypoints: HandKeypoint[]): number[] {
  if (!keypoints || keypoints.length < 21) {
    return new Array(42).fill(0);
  }

  const wrist = keypoints[0];
  const translated = keypoints.map(kp => ({
    x: kp.x - wrist.x,
    y: kp.y - wrist.y
  }));

  // Find max distance from wrist
  let maxDist = 0.0001;
  translated.forEach(kp => {
    const dist = Math.sqrt(kp.x * kp.x + kp.y * kp.y);
    if (dist > maxDist) maxDist = dist;
  });

  // Scale and flatten into a 42-element array
  const features: number[] = [];
  translated.forEach(kp => {
    features.push(kp.x / maxDist);
    features.push(kp.y / maxDist);
  });

  return features;
}

/**
 * Count how many non-thumb fingers are extended (Index, Middle, Ring, Pinky)
 */
export function countExtendedFingers(keypoints: HandKeypoint[]): number {
  if (!keypoints || keypoints.length < 21) return 0;
  const wrist = keypoints[0];
  const fingerIndices = [
    { tip: 8, pip: 6 },   // Index finger
    { tip: 12, pip: 10 }, // Middle finger
    { tip: 16, pip: 14 }, // Ring finger
    { tip: 20, pip: 18 }, // Pinky finger
  ];
  let count = 0;
  for (const { tip, pip } of fingerIndices) {
    const tipDist = Math.sqrt((keypoints[tip].x - wrist.x) ** 2 + (keypoints[tip].y - wrist.y) ** 2);
    const pipDist = Math.sqrt((keypoints[pip].x - wrist.x) ** 2 + (keypoints[pip].y - wrist.y) ** 2);
    if (tipDist > pipDist * 1.05) {
      count++;
    }
  }
  return count;
}

/**
 * Normalize face keypoints (468 landmarks) to be scale and translation invariant.
 * 1. Translate nose tip (index 1) to (0, 0)
 * 2. Find max distance from nose tip to any keypoint
 * 3. Scale all keypoints by dividing by max distance
 */
export function normalizeFaceFeatures(keypoints: { x: number, y: number }[]): number[] {
  if (!keypoints || keypoints.length < 468) {
    return new Array(936).fill(0);
  }

  const noseTip = keypoints[1];
  const translated = keypoints.map(kp => ({
    x: kp.x - noseTip.x,
    y: kp.y - noseTip.y
  }));

  // Find max distance from nose tip
  let maxDist = 0.0001;
  translated.forEach(kp => {
    const dist = Math.sqrt(kp.x * kp.x + kp.y * kp.y);
    if (dist > maxDist) maxDist = dist;
  });

  // Scale and flatten into a 936-element array
  const features: number[] = [];
  translated.forEach(kp => {
    features.push(kp.x / maxDist);
    features.push(kp.y / maxDist);
  });

  return features;
}

/**
 * Predict the class of a new hand pose using K-Nearest Neighbors
 */
export function classifyKNN(
  newFeatures: number[],
  samples: StoredSample[],
  k: number = 3
): { label: string; confidence: number; maxCount: number; actualK: number; minDistance: number } {
  if (!samples || samples.length === 0) {
    return { label: 'Chưa có dữ liệu', confidence: 0, maxCount: 0, actualK: 0, minDistance: Infinity };
  }

  // Calculate Euclidean distance to all samples
  const distances = samples.map(sample => {
    let sumSq = 0;
    for (let i = 0; i < newFeatures.length; i++) {
      const diff = sample.features[i] - newFeatures[i];
      sumSq += diff * diff;
    }
    return {
      label: sample.label,
      distance: Math.sqrt(sumSq)
    };
  });

  // Sort by distance ascending
  distances.sort((a, b) => a.distance - b.distance);
  const minDistance = distances.length > 0 ? distances[0].distance : Infinity;

  // Take top K
  const actualK = Math.min(k, distances.length);
  const nearest = distances.slice(0, actualK);

  // Count frequencies
  const counts: Record<string, number> = {};
  nearest.forEach(n => {
    counts[n.label] = (counts[n.label] || 0) + 1;
  });

  // Find majority label
  let bestLabel = 'unknown';
  let maxCount = 0;
  for (const label in counts) {
    if (counts[label] > maxCount) {
      maxCount = counts[label];
      bestLabel = label;
    }
  }

  const confidence = Math.round((maxCount / actualK) * 100);

  return {
    label: bestLabel,
    confidence,
    maxCount,
    actualK,
    minDistance
  };
}

/**
 * Detailed KNN Classification for ScoreExplainer
 * Returns the distances to the nearest neighbors and the exact vote counts
 */
export function classifyKNNDetailed(
  newFeatures: number[],
  samples: StoredSample[],
  k: number = 3
) {
  if (!samples || samples.length === 0) {
    return { label: 'Chưa có dữ liệu', confidence: 0, nearest: [], counts: {} };
  }

  const distances = samples.map(sample => {
    let sumSq = 0;
    for (let i = 0; i < newFeatures.length; i++) {
      const diff = sample.features[i] - newFeatures[i];
      sumSq += diff * diff;
    }
    return {
      label: sample.label,
      distance: Math.sqrt(sumSq),
      thumbnail: sample.thumbnail,
      sourceId: sample.sourceId,
      id: sample.id
    };
  });

  distances.sort((a, b) => a.distance - b.distance);

  const actualK = Math.min(k, distances.length);
  const nearest = distances.slice(0, actualK);

  const counts: Record<string, number> = {};
  nearest.forEach(n => {
    counts[n.label] = (counts[n.label] || 0) + 1;
  });

  let bestLabel = 'unknown';
  let maxCount = 0;
  for (const label in counts) {
    if (counts[label] > maxCount) {
      maxCount = counts[label];
      bestLabel = label;
    }
  }

  const confidence = Math.round((maxCount / actualK) * 100);

  // Calculate average distance of the winning label's neighbors
  const winningNeighbors = nearest.filter(n => n.label === bestLabel);
  const avgDistance = winningNeighbors.length > 0
    ? winningNeighbors.reduce((sum, n) => sum + n.distance, 0) / winningNeighbors.length
    : 0;

  return {
    label: bestLabel,
    confidence,
    nearest,
    counts,
    avgDistance
  };
}

/**
 * Evaluate a training set against a golden test dataset
 */
export function evaluateAgainstGolden(
  trainingSamples: StoredSample[],
  goldenDataset: { features: number[]; expectedLabel: string }[],
  k: number = 3,
  confidenceThreshold: number = 0
) {
  const results = goldenDataset.map((testSample, index) => {
    const prediction = classifyKNNDetailed(testSample.features, trainingSamples, k);
    const isCorrect = prediction.label === testSample.expectedLabel && prediction.confidence >= confidenceThreshold;
    
    return {
      id: `test-${index}`,
      expectedLabel: testSample.expectedLabel,
      predictedLabel: prediction.label,
      isCorrect,
      confidence: prediction.confidence,
      avgDistance: prediction.avgDistance,
      nearest: prediction.nearest
    };
  });

  const correctCount = results.filter(r => r.isCorrect).length;
  const accuracy = Math.round((correctCount / goldenDataset.length) * 100);

  return {
    results,
    accuracy,
    correctCount,
    totalCount: goldenDataset.length
  };
}

/**
 * Analyze data balance to warn users if one class has significantly more samples than others
 */
export function analyzeDataBalance(samples: StoredSample[]) {
  const counts: Record<string, number> = {};
  samples.forEach(s => {
    counts[s.label] = (counts[s.label] || 0) + 1;
  });

  const labels = Object.keys(counts);
  if (labels.length < 2) {
    return { isImbalanced: false, counts, maxRatio: 1, message: 'Cần ít nhất 2 nhãn để phân tích' };
  }

  let max = 0;
  let min = Infinity;
  let maxLabel = '';
  let minLabel = '';

  for (const [label, count] of Object.entries(counts)) {
    if (count > max) { max = count; maxLabel = label; }
    if (count < min) { min = count; minLabel = label; }
  }

  const maxRatio = min > 0 ? max / min : Infinity;
  const isImbalanced = maxRatio >= 2.0 && max >= 10; // Only warn if ratio is >= 2 and we have a decent amount of samples

  let message = '';
  if (isImbalanced) {
    message = `⚠️ Nhãn "${maxLabel}" có ${max} ảnh nhưng nhãn "${minLabel}" chỉ có ${min} ảnh. AI có thể thiên vị nhãn có nhiều ảnh hơn!`;
  }

  return {
    isImbalanced,
    counts,
    maxRatio,
    message,
    maxLabel,
    minLabel
  };
}

/**
 * KNN Classification returning K-nearest sample IDs for scatter plot highlight.
 * Used by KnnScatterPlot to draw lines from prediction point to K nearest neighbors.
 */
export function classifyKNNWithVotes(
  newFeatures: number[],
  samples: StoredSample[],
  k: number = 3
): {
  label: string;
  confidence: number;
  kNearestIds: string[];
  voteCounts: Record<string, number>;
  maxCount: number;
  actualK: number;
  minDistance: number;
} {
  if (!samples || samples.length === 0) {
    return { label: 'Chưa có dữ liệu', confidence: 0, kNearestIds: [], voteCounts: {}, maxCount: 0, actualK: 0, minDistance: Infinity };
  }

  // Calculate Euclidean distance to all samples
  const distances = samples.map(sample => {
    let sumSq = 0;
    for (let i = 0; i < newFeatures.length; i++) {
      const diff = sample.features[i] - newFeatures[i];
      sumSq += diff * diff;
    }
    return {
      id: sample.id || '',
      label: sample.label,
      distance: Math.sqrt(sumSq)
    };
  });

  // Sort by distance ascending
  distances.sort((a, b) => a.distance - b.distance);
  const minDistance = distances.length > 0 ? distances[0].distance : Infinity;

  // Take top K
  const actualK = Math.min(k, distances.length);
  const nearest = distances.slice(0, actualK);

  // Collect IDs of K nearest samples
  const kNearestIds = nearest.map(n => n.id);

  // Count votes per class
  const voteCounts: Record<string, number> = {};
  nearest.forEach(n => {
    voteCounts[n.label] = (voteCounts[n.label] || 0) + 1;
  });

  // Find majority label
  let bestLabel = 'unknown';
  let maxCount = 0;
  for (const label in voteCounts) {
    if (voteCounts[label] > maxCount) {
      maxCount = voteCounts[label];
      bestLabel = label;
    }
  }

  const confidence = Math.round((maxCount / actualK) * 100);

  return {
    label: bestLabel,
    confidence,
    kNearestIds,
    voteCounts,
    maxCount,
    actualK,
    minDistance
  };
}

/**
 * Resolves a raw prediction label (from KNN classifier or Teacher Template)
 * to the matching class from the provided challenge classes.
 * 
 * Supports:
 * 1. Exact ID match (e.g. 'class_1' === 'class_1')
 * 2. Exact Label match (e.g. 'Thích (Thumbs Up)' === 'Thích (Thumbs Up)')
 * 3. Two-hands mode mapping (class_3 represents 1 finger, class_4 represents 2 fingers)
 * 4. Normalized & case-insensitive prefix / substring matching (e.g. 'Thích' <-> 'Thích (Thumbs Up)')
 * 5. String prefix fallback
 */
export function resolveClassMatch<T extends { id: string; label: string }>(
  rawLabel: string,
  classes: T[]
): T | undefined {
  if (!rawLabel || !classes || classes.length === 0) return undefined;

  // 1. Exact ID match
  const byId = classes.find(c => c.id === rawLabel);
  if (byId) return byId;

  // 2. Exact Label match
  const byLabel = classes.find(c => c.label === rawLabel);
  if (byLabel) return byLabel;

  // 3. Two-hands mode cross-mapping:
  // class_3 ('2 Bàn Tay, 1 Ngón Tay') corresponds to single-hand 1 finger ('class_1', '1 Ngón Tay ☝️', '1 Ngón Tay')
  // class_4 ('2 Bàn Tay, 2 Ngón Tay') corresponds to single-hand 2 fingers ('class_2', '2 Ngón Tay ✌️', '2 Ngón Tay')
  const isTwoHands = classes.some(c => c.id === 'class_3' || c.id === 'class_4');
  if (isTwoHands) {
    const isOneFinger = rawLabel === 'class_1' || rawLabel.includes('1 Ngón') || rawLabel.includes('☝️');
    const isTwoFingers = rawLabel === 'class_2' || rawLabel.includes('2 Ngón') || rawLabel.includes('✌️');
    if (isOneFinger) {
      const cls3 = classes.find(c => c.id === 'class_3');
      if (cls3) return cls3;
    }
    if (isTwoFingers) {
      const cls4 = classes.find(c => c.id === 'class_4');
      if (cls4) return cls4;
    }
  }

  // 4. Normalized substring / prefix match
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '');
  const normRaw = normalize(rawLabel);
  if (normRaw.length >= 2) {
    const byNorm = classes.find(c => {
      const normC = normalize(c.label);
      return normC.startsWith(normRaw) || normRaw.startsWith(normC) || normC.includes(normRaw) || normRaw.includes(normC);
    });
    if (byNorm) return byNorm;
  }

  // 5. String prefix fallback
  return classes.find(c => rawLabel.startsWith(c.label) || c.label.startsWith(rawLabel));
}
