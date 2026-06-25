import { HandKeypoint } from '@/types/ml5';

export function drawHandSkeleton(
  ctx: CanvasRenderingContext2D,
  kps: HandKeypoint[],
  videoWidth: number,
  videoHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  options: {
    lineColor?: string;
    jointColor1?: string; // For keypoints that are multiples of 4
    jointColor2?: string; // For other keypoints
    lineWidth?: number;
    jointRadius?: number;
  } = {}
) {
  const {
    lineColor = '#60a5fa',
    jointColor1 = '#3b82f6',
    jointColor2 = '#60a5fa',
    lineWidth = 4,
    jointRadius = 6,
  } = options;

  const sx = canvasWidth / videoWidth;
  const sy = canvasHeight / videoHeight;

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';

  const fingersPaths = [
    [0, 1, 2, 3, 4],       // thumb
    [0, 5, 6, 7, 8],       // index
    [0, 9, 10, 11, 12],    // middle
    [0, 13, 14, 15, 16],   // ring
    [0, 17, 18, 19, 20],   // pinky
  ];

  fingersPaths.forEach(path => {
    ctx.beginPath();
    ctx.moveTo(kps[path[0]].x * sx, kps[path[0]].y * sy);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(kps[path[i]].x * sx, kps[path[i]].y * sy);
    }
    ctx.stroke();
  });

  kps.forEach((kp, idx) => {
    ctx.fillStyle = idx % 4 === 0 ? jointColor1 : jointColor2;
    ctx.beginPath();
    ctx.arc(kp.x * sx, kp.y * sy, jointRadius, 0, Math.PI * 2);
    ctx.fill();
  });
}
