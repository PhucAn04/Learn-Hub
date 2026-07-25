export type HandKeypoint = {
  x: number;
  y: number;
};

export type HandResult = {
  keypoints?: HandKeypoint[];
};

export type HandPoseModel = {
  detect?: (input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement) => Promise<HandResult[]>;
  detectStart: (video: HTMLVideoElement, callback: (results: HandResult[]) => void) => void;
  detectStop?: () => void;
};

export type FaceKeypoint = {
  x: number;
  y: number;
  z?: number;
};

export type FaceMeshPoint = FaceKeypoint | [number, number, number?];

export type FaceMeshResult =
  | FaceMeshPoint[]
  | {
      keypoints?: FaceMeshPoint[];
      scaledMesh?: FaceMeshPoint[];
      faceMesh?: FaceMeshPoint[];
      faceLandmarks?: FaceMeshPoint[];
      mesh?: FaceMeshPoint[];
    };

export type Ml5FaceMeshModel = {
  detect?: (input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement) => Promise<FaceMeshResult[]>;
  detectStart: (video: HTMLVideoElement, callback: (results: FaceMeshResult[]) => void) => void;
  detectStop?: () => void;
};

// ── Body Pose Types ──────────────────────────────────────────────────────────

export type BodyKeypoint = {
  x: number;
  y: number;
  confidence?: number;
  name?: string;
};

export type BodyPoseResult = {
  keypoints?: BodyKeypoint[];
};

export type BodyPoseModel = {
  detect?: (input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement) => Promise<BodyPoseResult[]>;
  detectStart: (video: HTMLVideoElement, callback: (results: BodyPoseResult[]) => void) => void;
  detectStop?: () => void;
};

// ── Ml5 Module ───────────────────────────────────────────────────────────────

export type Ml5Module = {
  handPose: (
    options: { maxHands: number; flipHorizontal: boolean; runtime: string; modelType: string },
    callback: () => void,
  ) => HandPoseModel;
  faceMesh: (
    options: { maxFaces: number; flipHorizontal: boolean; runtime?: string },
    callback: () => void,
  ) => Ml5FaceMeshModel;
  bodyPose: (
    modelName?: string,
    options?: any,
    callback?: () => void,
  ) => BodyPoseModel;
};

export type GestureType = 'like' | 'fist' | 'peace' | 'open';

export type SmileMetrics = {
  isSmiling: boolean;
  progress: number;
};

export type FaceFilter = 'sunglasses' | 'crown' | 'clownNose';
