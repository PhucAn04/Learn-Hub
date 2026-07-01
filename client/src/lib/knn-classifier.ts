export interface HandKeypoint {
  x: number;
  y: number;
  z?: number;
}

export interface StoredSample {
  label: string;
  features: number[]; // e.g., 42 for hands, 936 for face
  sourceId?: string;  // Track which UI class generated this (for compound classes)
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
): { label: string; confidence: number } {
  if (!samples || samples.length === 0) {
    return { label: 'Chưa có dữ liệu', confidence: 0 };
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
    confidence
  };
}
