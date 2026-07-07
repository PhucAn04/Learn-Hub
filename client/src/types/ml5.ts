export type HandKeypoint = {
  x: number;
  y: number;
};

export type HandResult = {
  keypoints?: HandKeypoint[];
};

export type HandPoseModel = {
  detect?: (video: HTMLVideoElement) => Promise<HandResult[]>;
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
  detectStart: (video: HTMLVideoElement, callback: (results: FaceMeshResult[]) => void) => void;
  detectStop?: () => void;
};

export type Ml5Module = {
  handPose: (
    options: { maxHands: number; flipHorizontal: boolean; runtime: string; modelType: string },
    callback: () => void,
  ) => HandPoseModel;
  faceMesh: (
    options: { maxFaces: number; flipHorizontal: boolean; runtime?: string },
    callback: () => void,
  ) => Ml5FaceMeshModel;
};

export type GestureType = 'like' | 'fist' | 'peace' | 'open';

export type SmileMetrics = {
  isSmiling: boolean;
  progress: number;
};

export type FaceFilter = 'sunglasses' | 'crown' | 'clownNose';
