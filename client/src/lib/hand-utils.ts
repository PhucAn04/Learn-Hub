import { HandKeypoint } from '@/types/ml5';

export function distance(p1: HandKeypoint, p2: HandKeypoint): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

export function jointAngle(a: HandKeypoint, b: HandKeypoint, c: HandKeypoint): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (mag === 0) return 0;
  const cosine = Math.max(-1, Math.min(1, dot / mag));
  return Math.acos(cosine) * (180 / Math.PI);
}

export function getFingerStates(kps: HandKeypoint[]) {
  const fingerExtended = (tip: number, dip: number, pip: number, mcp: number) => {
    const pipAngle = jointAngle(kps[mcp], kps[pip], kps[dip]);
    const dipAngle = jointAngle(kps[pip], kps[dip], kps[tip]);
    return pipAngle > 145 && dipAngle > 140;
  };

  return {
    thumb: jointAngle(kps[2], kps[3], kps[4]) > 145
      && distance(kps[4], kps[9]) > distance(kps[3], kps[9]) * 1.05,
    index: fingerExtended(8, 7, 6, 5),
    middle: fingerExtended(12, 11, 10, 9),
    ring: fingerExtended(16, 15, 14, 13),
    pinky: fingerExtended(20, 19, 18, 17),
  };
}

export function calculateFingers(kps: HandKeypoint[]): number {
  const states = getFingerStates(kps);
  return [states.thumb, states.index, states.middle, states.ring, states.pinky].filter(Boolean).length;
}

export function recognizeGesture(kps: HandKeypoint[]): 'like' | 'fist' | 'peace' | 'open' | 'unknown' {
  const {
    thumb: thumbExtended,
    index: indexExtended,
    middle: middleExtended,
    ring: ringExtended,
    pinky: pinkyExtended,
  } = getFingerStates(kps);

  // Open Hand: all 5 extended.
  if (indexExtended && middleExtended && ringExtended && pinkyExtended && thumbExtended) {
    return 'open';
  }

  // Fist: all 5 folded.
  if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended && !thumbExtended) {
    return 'fist';
  }

  // Peace: index and middle extended, ring and pinky folded.
  if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
    return 'peace';
  }

  // Thumbs Up: only thumb extended, all other fingers folded.
  if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return 'like';
  }

  return 'unknown';
}
