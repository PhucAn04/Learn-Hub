import { StoredSample } from './knn-classifier';

// ── Palette màu cho các vùng class ──
export const CLASS_COLORS = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#06b6d4', // cyan
  '#a855f7', // purple
];

export interface ClassCenter {
  cx: number;
  cy: number;
  color: string;
}

export interface ScatterPoint {
  sampleId: string;
  x: number;
  y: number;
  classId: string;
  color: string;
}

/**
 * Seeded random dựa trên string hash.
 * Dùng để jitter mỗi chấm tại vị trí ổn định giữa các lần render.
 */
function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash = hash & hash; // Convert to 32bit int
  }
  // Normalize to 0-1
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
}

/**
 * Tính vị trí trung tâm cho mỗi class trên canvas.
 * - 1 class: giữa canvas
 * - 2 classes: trái / phải
 * - 3 classes: tam giác
 * - 4+ classes: phân bố đều trên vòng tròn
 */
export function computeClassCenters(
  classIds: string[],
  canvasWidth: number,
  canvasHeight: number
): Record<string, ClassCenter> {
  const result: Record<string, ClassCenter> = {};
  const n = classIds.length;

  if (n === 0) return result;

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  // Radius of the circle where centers are placed (leave margin for jitter)
  const radius = Math.min(canvasWidth, canvasHeight) * 0.20;

  if (n === 1) {
    result[classIds[0]] = { cx: centerX, cy: centerY, color: CLASS_COLORS[0] };
  } else {
    // Place on a circle, starting from top (-90°)
    for (let i = 0; i < n; i++) {
      const angle = (-Math.PI / 2) + (2 * Math.PI * i) / n;
      result[classIds[i]] = {
        cx: centerX + radius * Math.cos(angle),
        cy: centerY + radius * Math.sin(angle),
        color: CLASS_COLORS[i % CLASS_COLORS.length],
      };
    }
  }

  return result;
}

/**
 * Gán tọa độ 2D cho mỗi sample trên biểu đồ.
 * Mỗi sample đặt gần trung tâm class, jitter bằng hash(sample.id).
 * Bán kính jitter tỷ lệ sqrt(count) → vùng lớn khi nhiều ảnh.
 */
export function computeScatterPoints(
  samples: StoredSample[],
  classIds: string[],
  classCenters: Record<string, ClassCenter>,
  canvasWidth: number,
  classes?: { id: string; label: string }[]
): ScatterPoint[] {
  // Helper resolving classId for a sample
  const getClassId = (s: StoredSample): string => {
    if (s.sourceId && classIds.includes(s.sourceId)) return s.sourceId;
    if (classIds.includes(s.label)) return s.label;
    if (classes) {
      const match = classes.find(c => c.label === s.label || c.id === s.label);
      if (match && classIds.includes(match.id)) return match.id;
    }
    return classIds[0] || 'unknown';
  };

  // Count samples per class for jitter radius
  const counts: Record<string, number> = {};
  classIds.forEach(id => counts[id] = 0);
  samples.forEach(s => {
    const cid = getClassId(s);
    counts[cid] = (counts[cid] || 0) + 1;
  });

  // Base jitter radius scales with canvas size
  const baseRadius = canvasWidth * 0.09;

  // Track index within each class for spiral-like distribution
  const classIndex: Record<string, number> = {};
  classIds.forEach(id => classIndex[id] = 0);

  return samples.map(s => {
    const classId = getClassId(s);
    const center = classCenters[classId];

    if (!center) {
      return { sampleId: s.id || '', x: 0, y: 0, classId, color: CLASS_COLORS[0] };
    }

    const count = counts[classId] || 1;
    // Jitter radius grows with sqrt(count) to make bigger clusters for more data
    const jitterRadius = baseRadius * Math.sqrt(Math.max(count, 1)) * 0.4;

    const sampleId = s.id || `${classId}_${classIndex[classId]}`;
    const idx = classIndex[classId]++;

    // Use golden angle spiral for even distribution within cluster
    const goldenAngle = 2.399963; // radians ≈ 137.508°
    const angle = idx * goldenAngle;
    const r = jitterRadius * Math.sqrt((idx + 0.5) / Math.max(count, 1));

    // Add small seeded random perturbation so points don't line up perfectly
    const randOffset = seededRandom(sampleId) * baseRadius * 0.15;
    const randAngle = seededRandom(sampleId + '_a') * Math.PI * 2;

    const x = center.cx + r * Math.cos(angle) + randOffset * Math.cos(randAngle);
    const y = center.cy + r * Math.sin(angle) + randOffset * Math.sin(randAngle);

    return {
      sampleId,
      x,
      y,
      classId,
      color: center.color,
    };
  });
}
