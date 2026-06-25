import { FaceKeypoint, FaceMeshPoint, FaceMeshResult, FaceFilter, SmileMetrics } from '@/types/ml5';

export const FACE_OVAL = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10];
export const FACE_L_EYE = [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246,33];
export const FACE_R_EYE = [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398,362];
export const FACE_LIPS = [61,146,91,181,84,17,314,405,321,375,291,308,324,318,402,317,14,87,178,88,95,185,40,39,37,0,267,269,270,409,291];
export const FACE_NOSE = [168,4,5,195,197,6,1,19,2];

export function drawPolyline(
  ctx: CanvasRenderingContext2D,
  indices: number[],
  kps: FaceKeypoint[],
) {
  ctx.beginPath();
  let started = false;
  for (const i of indices) {
    const kp = kps[i];
    if (!kp) continue;
    if (!started) {
      ctx.moveTo(kp.x, kp.y);
      started = true;
    } else {
      ctx.lineTo(kp.x, kp.y);
    }
  }
  ctx.stroke();
}

export function toFaceKeypoint(point: FaceMeshPoint): FaceKeypoint | null {
  if (Array.isArray(point)) {
    const [x, y, z] = point;
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y, z } : null;
  }
  return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null;
}

export function getFaceKeypoints(face: FaceMeshResult): FaceKeypoint[] {
  const raw = Array.isArray(face)
    ? face
    : face.keypoints || face.scaledMesh || face.faceMesh || face.faceLandmarks || face.mesh || [];

  return raw
    .map(toFaceKeypoint)
    .filter((point): point is FaceKeypoint => Boolean(point));
}

export function normalizeFaceKeypoints(
  kpsRaw: FaceKeypoint[],
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): FaceKeypoint[] {
  const rawPoints = kpsRaw.map(toFaceKeypoint).filter((point): point is FaceKeypoint => Boolean(point));
  const vw = video.videoWidth || video.width || 1;
  const vh = video.videoHeight || video.height || 1;
  const cw = canvas.width || vw;
  const ch = canvas.height || vh;
  const maxX = rawPoints.reduce((max, kp) => Math.max(max, kp.x), 0);
  const maxY = rawPoints.reduce((max, kp) => Math.max(max, kp.y), 0);
  const sourceW = maxX <= 1.5
    ? 1
    : maxX <= vw * 1.1
      ? vw
      : maxX <= (video.width || 1) * 1.1
        ? video.width || 1
        : maxX;
  const sourceH = maxY <= 1.5
    ? 1
    : maxY <= vh * 1.1
      ? vh
      : maxY <= (video.height || 1) * 1.1
        ? video.height || 1
        : maxY;

  return rawPoints.map((kp) => ({
    x: (kp.x / sourceW) * cw,
    y: (kp.y / sourceH) * ch,
    z: kp.z,
  }));
}

export function distance(a: FaceKeypoint, b: FaceKeypoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function getSmileMetricsFromFaceMesh(kps: FaceKeypoint[]): SmileMetrics {
  const leftMouth = kps[61];
  const rightMouth = kps[291];
  const topLip = kps[13];
  const bottomLip = kps[14];
  const faceLeft = kps[234] || kps[127] || kps[33];
  const faceRight = kps[454] || kps[356] || kps[263];

  if (!leftMouth || !rightMouth || !topLip || !bottomLip || !faceLeft || !faceRight) {
    return { isSmiling: false, progress: 0 };
  }

  const faceWidth = Math.max(distance(faceLeft, faceRight), 1);
  const mouthCornerRatio = distance(leftMouth, rightMouth) / faceWidth;
  const lipOpenRatio = distance(topLip, bottomLip) / faceWidth;

  const progress = Math.min(100, Math.max(0, Math.round(((mouthCornerRatio - 0.28) / 0.14) * 100)));
  const isSmiling = progress >= 100 && lipOpenRatio < 0.16;

  return {
    progress,
    isSmiling,
  };
}

export function drawFaceStickers(
  ctx: CanvasRenderingContext2D,
  kps: FaceKeypoint[],
  filters: FaceFilter[],
) {
  const nose = kps[4] || kps[1];
  const forehead = kps[10] || kps[9];
  const leftEye = kps[159] || kps[33];
  const rightEye = kps[386] || kps[263];
  const faceWidth = leftEye && rightEye
    ? Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y)
    : 80;

  if (filters.includes('sunglasses') && nose && forehead && leftEye && rightEye) {
    const eyeCenterX = (leftEye.x + rightEye.x) / 2;
    const eyeCenterY = (leftEye.y + rightEye.y) / 2;
    const glassWidth = faceWidth * 2.2;

    ctx.font = `${Math.round(glassWidth * 0.7)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🕶️', eyeCenterX, eyeCenterY);
  }

  if (filters.includes('crown') && nose && forehead) {
    const headTopX = forehead.x;
    const headTopY = forehead.y - faceWidth * 0.6;
    const crownSize = faceWidth * 1.8;

    ctx.font = `${Math.round(crownSize * 0.6)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('👑', headTopX, headTopY);
  }

  if (filters.includes('clownNose') && nose) {
    const noseX = nose.x;
    const noseY = nose.y;
    const noseSize = faceWidth * 0.6;

    ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
    ctx.beginPath();
    ctx.arc(noseX, noseY, noseSize / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(noseX - noseSize * 0.15, noseY - noseSize * 0.15, noseSize * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
}
