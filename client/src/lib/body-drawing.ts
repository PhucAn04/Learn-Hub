import { BodyKeypoint } from '@/types/ml5';

export interface BodyDrawOptions {
  headColor?: string;
  torsoColor?: string;
  armColor?: string;
  legColor?: string;
  lineWidth?: number;
  jointRadius?: number;
  minConfidence?: number;
}

const DEFAULT_OPTIONS: BodyDrawOptions = {
  headColor: '#fbbf24', // yellow
  torsoColor: '#34d399', // emerald
  armColor: '#60a5fa', // blue
  legColor: '#c084fc', // purple
  lineWidth: 3,
  jointRadius: 4,
  minConfidence: 0.1, // MoveNet confidence threshold
};

// Connections for drawing skeleton (MoveNet / PoseNet structure)
const SKELETON_CONNECTIONS = [
  // Face / Head
  ['nose', 'left_eye', 'headColor'],
  ['nose', 'right_eye', 'headColor'],
  ['left_eye', 'left_ear', 'headColor'],
  ['right_eye', 'right_ear', 'headColor'],
  
  // Torso
  ['left_shoulder', 'right_shoulder', 'torsoColor'],
  ['left_shoulder', 'left_hip', 'torsoColor'],
  ['right_shoulder', 'right_hip', 'torsoColor'],
  ['left_hip', 'right_hip', 'torsoColor'],
  
  // Arms
  ['left_shoulder', 'left_elbow', 'armColor'],
  ['left_elbow', 'left_wrist', 'armColor'],
  ['right_shoulder', 'right_elbow', 'armColor'],
  ['right_elbow', 'right_wrist', 'armColor'],
  
  // Legs
  ['left_hip', 'left_knee', 'legColor'],
  ['left_knee', 'left_ankle', 'legColor'],
  ['right_hip', 'right_knee', 'legColor'],
  ['right_knee', 'right_ankle', 'legColor'],
  
  // BlazePose Hand extensions
  ['left_wrist', 'left_thumb', 'armColor'],
  ['left_wrist', 'left_index', 'armColor'],
  ['left_wrist', 'left_pinky', 'armColor'],
  ['left_index', 'left_pinky', 'armColor'],
  
  ['right_wrist', 'right_thumb', 'armColor'],
  ['right_wrist', 'right_index', 'armColor'],
  ['right_wrist', 'right_pinky', 'armColor'],
  ['right_index', 'right_pinky', 'armColor'],

  // BlazePose Foot extensions
  ['left_ankle', 'left_heel', 'legColor'],
  ['left_heel', 'left_foot_index', 'legColor'],
  ['left_ankle', 'left_foot_index', 'legColor'],

  ['right_ankle', 'right_heel', 'legColor'],
  ['right_heel', 'right_foot_index', 'legColor'],
  ['right_ankle', 'right_foot_index', 'legColor'],
];

export function drawBodySkeleton(
  ctx: CanvasRenderingContext2D,
  keypoints: BodyKeypoint[],
  videoWidth: number,
  videoHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  options?: BodyDrawOptions
) {
  if (!keypoints || keypoints.length === 0) return;

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const scaleX = canvasWidth / videoWidth;
  const scaleY = canvasHeight / videoHeight;

  // Create a map for quick lookup by name
  const kpMap = new Map<string, BodyKeypoint>();
  keypoints.forEach((kp) => {
    if (kp.name) kpMap.set(kp.name, kp);
  });

  ctx.save();

  // 1. Draw connections (lines)
  ctx.lineWidth = opts.lineWidth!;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  SKELETON_CONNECTIONS.forEach(([partA, partB, colorKey]) => {
    const kpA = kpMap.get(partA);
    const kpB = kpMap.get(partB);

    if (
      kpA && kpB &&
      (kpA.confidence === undefined || kpA.confidence > opts.minConfidence!) &&
      (kpB.confidence === undefined || kpB.confidence > opts.minConfidence!)
    ) {
      ctx.strokeStyle = (opts as any)[colorKey] || '#ffffff';
      ctx.beginPath();
      ctx.moveTo(kpA.x * scaleX, kpA.y * scaleY);
      ctx.lineTo(kpB.x * scaleX, kpB.y * scaleY);
      ctx.stroke();
    }
  });

  // 2. Draw joints (points)
  keypoints.forEach((kp) => {
    if (kp.confidence !== undefined && kp.confidence < opts.minConfidence!) return;

    let color = '#ffffff';
    if (['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear'].includes(kp.name || '')) {
      color = opts.headColor!;
    } else if (['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'].includes(kp.name || '')) {
      color = opts.torsoColor!;
    } else if (['left_elbow', 'right_elbow', 'left_wrist', 'right_wrist'].includes(kp.name || '')) {
      color = opts.armColor!;
    } else if (['left_knee', 'right_knee', 'left_ankle', 'right_ankle'].includes(kp.name || '')) {
      color = opts.legColor!;
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(kp.x * scaleX, kp.y * scaleY, opts.jointRadius!, 0, 2 * Math.PI);
    ctx.fill();
    
    // Add inner dot for detail
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(kp.x * scaleX, kp.y * scaleY, opts.jointRadius! / 2, 0, 2 * Math.PI);
    ctx.fill();
  });

  ctx.restore();
}
