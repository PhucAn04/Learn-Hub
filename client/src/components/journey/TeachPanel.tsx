'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brain, Camera, Trash2, FlaskConical, ShieldCheck } from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { useMl5Handpose } from '@/hooks/useMl5Handpose';
import { useMl5FaceMesh } from '@/hooks/useMl5FaceMesh';
import { useStabilityDetector } from '@/hooks/useStabilityDetector';
import { drawHandSkeleton } from '@/lib/hand-drawing';
import {
  FACE_OVAL,
  FACE_L_EYE,
  FACE_R_EYE,
  FACE_LIPS,
  FACE_NOSE,
  drawPolyline,
  normalizeFaceKeypoints,
  getFaceKeypoints,
  drawFaceSkeleton
} from '@/lib/face-drawing';
import {
  normalizeHandKeypoints,
  normalizeFaceFeatures,
  classifyKNN,
  classifyKNNDetailed,
  classifyKNNWithVotes,
  StoredSample,
  HandKeypoint,
} from '@/lib/knn-classifier';
import { assessQuality, calculateROI } from '@/lib/image-quality';
import KnnScatterPlot from './KnnScatterPlot';
import { GOLDEN_TEST_DATASET, GoldenTestSample } from '@/lib/golden-dataset';
import { playClickSound, playSuccessSound } from '@/lib/audio';
import CameraView from '../CameraView';
import SampleGallery from '@/components/SampleGallery';
import DataCollector from './DataCollector';
import AIFeedbackModal from './AIFeedbackModal';
import DataBalanceWarning from './DataBalanceWarning';
import AIConfidenceEnergyBars from './AIConfidenceEnergyBars';
import { TfTrainer } from '@/lib/tf-trainer';
import { TeacherTemplate, DatasetResponse } from '@/types/models';
import { HandResult, FaceMeshResult } from '@/types/ml5';
import { evaluateStudentDatasetPhase, crossCheckLiveFeatures, DatasetQualityResult } from '@/lib/teacher-validator';

// ──────────────────────────────────────────────
// Try to import optional golden datasets
// ──────────────────────────────────────────────
let GOLDEN_GESTURES_DATASET: GoldenTestSample[] = [];
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@/lib/golden-gestures-dataset');
  GOLDEN_GESTURES_DATASET = mod.GOLDEN_GESTURES_DATASET ?? [];
} catch {
  /* golden gestures dataset not available — skip golden validation for gesture mode */
}

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────
interface TeachPanelProps {
  mode: 'hand-1' | 'hand-2' | 'gesture' | 'emotion';
  classes: { id: string; label: string; emoji?: string }[];
  minSamplesPerClass?: number;
  maxVisibleSkeletons?: number;
  onTrainComplete: (
    samples: StoredSample[], 
    getModelBlobs?: () => Promise<{ jsonBlob: Blob; weightsBlob: Blob } | null>,
    accuracyScore?: number
  ) => void;
  teacherTemplate?: TeacherTemplate | DatasetResponse;
  initialSamples?: StoredSample[];
}

// ──────────────────────────────────────────────
// Finger counting heuristic (reused from teach/page.tsx)
// ──────────────────────────────────────────────
function countExtendedFingers(keypoints: HandKeypoint[]): number {
  if (!keypoints || keypoints.length < 21) return -1;

  const wrist = keypoints[0];
  let count = 0;
  
  const dist2D = (p1: HandKeypoint, p2: HandKeypoint) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

  // Bỏ qua ngón cái (thumb) vì việc phát hiện ngón cái cụp/xòe rất thiếu ổn định
  // Tạm comment logic đếm ngón cái
  /*
  const thumbTip = keypoints[4];
  const thumbIP = keypoints[3];
  const thumbMCP = keypoints[2];
  
  const thumbDistTip = dist2D(thumbTip, wrist);
  const thumbDistIP = dist2D(thumbIP, wrist);
  const thumbDistMCP = dist2D(thumbMCP, wrist);
  
  if (thumbDistTip > thumbDistIP && thumbDistIP > thumbDistMCP * 1.1) {
    count++;
  }
  */

  // Index through pinky
  const fingerIndices = [
    { tip: 8, pip: 6 },
    { tip: 12, pip: 10 },
    { tip: 16, pip: 14 },
    { tip: 20, pip: 18 },
  ];

  for (const { tip, pip } of fingerIndices) {
    const tipDist = dist2D(keypoints[tip], wrist);
    const pipDist = dist2D(keypoints[pip], wrist);
    if (tipDist > pipDist * 1.25) { // Tăng ngưỡng từ 1.05 lên 1.25 để lờ đi các ngón cong nhẹ
      count++;
    }
  }

  return count;
}

/**
 * Kiểm tra ngón cái có đang xòe ra không.
 * Dùng riêng cho trường hợp phân biệt 4 ngón vs 5 ngón.
 */
function isThumbExtended(keypoints: HandKeypoint[]): boolean {
  if (!keypoints || keypoints.length < 21) return false;
  const wrist = keypoints[0];
  const thumbTip = keypoints[4];
  const thumbIP = keypoints[3];
  const thumbMCP = keypoints[2];
  
  const dist2D = (p1: HandKeypoint, p2: HandKeypoint) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
  const thumbDistTip = dist2D(thumbTip, wrist);
  const thumbDistIP = dist2D(thumbIP, wrist);
  const thumbDistMCP = dist2D(thumbMCP, wrist);
  
  // Ngón cái xòe khi TIP xa hơn IP và IP xa hơn MCP
  return thumbDistTip > thumbDistIP && thumbDistIP > thumbDistMCP * 1.05;
}

// ──────────────────────────────────────────────
// Expression helpers (reused from teach-face/page.tsx)
// ──────────────────────────────────────────────
function getExpressionRatios(kps: { x: number; y: number }[]) {
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const faceLeft = kps[234] || kps[127];
  const faceRight = kps[454] || kps[356];
  const faceTop = kps[10];
  const chin = kps[152];
  const faceWidth = Math.max(dist(faceLeft, faceRight), 0.001);
  const faceHeight = Math.max(dist(faceTop, chin), 0.001);

  const topLip = kps[13];
  const bottomLip = kps[14];
  const leftMouth = kps[61];
  const rightMouth = kps[291];
  const mouthWidth = dist(leftMouth, rightMouth);
  const mouthOpen = dist(topLip, bottomLip);
  const mar = mouthOpen / Math.max(mouthWidth, 0.001);

  const smileRatio = mouthWidth / faceWidth;
  const mouthCenterY = (topLip.y + bottomLip.y) / 2;
  const cornerAvgY = (leftMouth.y + rightMouth.y) / 2;
  const cornerLift = (mouthCenterY - cornerAvgY) / faceHeight;

  const leftEAR =
    dist(kps[159], kps[145]) / Math.max(dist(kps[33], kps[133]), 0.001);
  const rightEAR =
    dist(kps[386], kps[374]) / Math.max(dist(kps[362], kps[263]), 0.001);
  const ear = (leftEAR + rightEAR) / 2;

  const leftBrow = kps[105];
  const rightBrow = kps[334];
  const browHeight =
    ((dist(leftBrow, kps[159]) + dist(rightBrow, kps[386])) / 2) / faceHeight;

  return { mar, smileRatio, cornerLift, ear, browHeight };
}

function detectExpression(r: ReturnType<typeof getExpressionRatios>) {
  if (r.mar > 0.22 && r.smileRatio < 0.38) return 'Ngạc nhiên 😲';
  if (r.smileRatio > 0.4 || (r.cornerLift > 0.015 && r.mar < 0.2))
    return 'Vui vẻ 😀';
  if (r.smileRatio >= 0.34 && r.cornerLift >= -0.002) return 'Bình thường 😐';
  return 'Buồn bã 😢';
}

function validateFaceExpression(
  kps: { x: number; y: number }[],
  classId: string,
) {
  const r = getExpressionRatios(kps);
  const detected = detectExpression(r);

  const map: Record<string, string> = {
    class_1: 'Vui vẻ 😀',
    class_2: 'Buồn bã 😢',
    class_3: 'Ngạc nhiên 😲',
    class_4: 'Bình thường 😐',
  };

  const expected = map[classId];
  if (expected && detected !== expected) {
    return {
      isValid: false,
      suggestion: `AI thấy bé đang "${detected}". Hãy thử biểu cảm khác nhé! 🤔`,
    };
  }
  return { isValid: true, suggestion: '' };
}

// ──────────────────────────────────────────────
// Helper: expected finger count for hand modes
// ──────────────────────────────────────────────
function getExpectedFingerCount(
  classId: string,
  mode: TeachPanelProps['mode'],
  label?: string,
): number {
  if (mode !== 'hand-1' && mode !== 'hand-2') return -1;
  if (classId === 'class_1' || classId === 'class_3') return 1;
  if (classId === 'class_2' || classId === 'class_4') return 2;
  // Nhãn động — parse từ label text
  if (label) {
    if (label.includes('3 Ngón Tay')) return 3;
    if (label.includes('4 Ngón Tay')) return 4;
    if (label.includes('5 Ngón Tay')) return 5; // positive check sẽ dùng >= 4 (thumb disabled)
  }
  return -1;
}

// Map class ID → golden label for hand modes
const CLASS_TO_GOLDEN_LABEL: Record<string, string> = {
  class_1: '1 Ngón Tay ☝️',
  class_2: '2 Ngón Tay ✌️',
  class_3: '1 Ngón Tay ☝️',
  class_4: '2 Ngón Tay ✌️',
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────
export default function TeachPanel({
  mode,
  classes,
  minSamplesPerClass = 10,
  maxVisibleSkeletons = 1,
  onTrainComplete,
  teacherTemplate,
  initialSamples,
}: TeachPanelProps) {
  const isHandMode = mode === 'hand-1' || mode === 'hand-2' || mode === 'gesture';
  const isFaceMode = mode === 'emotion';
  const isTwoHandMode = mode === 'hand-2';

  // ── State ───────────────────────────
  const [samples, setSamples] = useState<StoredSample[]>(initialSamples || []);
  const [activeClass, setActiveClass] = useState<string>(classes[0]?.id || '');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [isTrained, setIsTrained] = useState(false);
  const [isModelOutdated, setIsModelOutdated] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [validationToast, setValidationToast] = useState<string | null>(null);
  const [predictedLabel, setPredictedLabel] = useState('Chưa nhận diện... 🤔');
  const [kValue, setKValue] = useState<number>(3);
  const [threshold, setThreshold] = useState<number>(2);
  const [kNearestIds, setKNearestIds] = useState<string[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [nnConfidences, setNnConfidences] = useState<Record<string, number> | null>(null);
  const [isAnomaly, setIsAnomaly] = useState(false);
  const [isMissingData, setIsMissingData] = useState(false);
  const [anomalyMessage, setAnomalyMessage] = useState<string | undefined>(undefined);
  const [teacherHintImages, setTeacherHintImages] = useState<string[]>([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [carefulMode, setCarefulMode] = useState(false); // false = Explorer Mode (default)
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'video'>('camera');

  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const trainerRef = useRef<TfTrainer | null>(null);
  useEffect(() => {
    trainerRef.current = new TfTrainer();
  }, []);

  const datasetQuality = useMemo(() => {
    if (samples.length > 0) {
      return evaluateStudentDatasetPhase(samples, classes, 3, 10);
    }
    return null;
  }, [samples, classes]);

  // ── Camera ──────────────────────────
  const { videoRef, canvasRef, cameraActive, cameraError, retryCamera } =
    useCamera({ width: 640, height: 480 });

  // ── Models (conditionally active) ───
  const { handsRef, modelStatus: handModelStatus } = useMl5Handpose(
    videoRef,
    cameraActive && isHandMode,
    { maxHands: 2 },
  );

  const { allFacesRef, modelStatus: faceModelStatus } = useMl5FaceMesh(
    videoRef,
    cameraActive && isFaceMode,
    { maxFaces: 1 },
  );

  const modelStatus = isHandMode ? handModelStatus : faceModelStatus;

  const { isStable, motionScore } = useStabilityDetector(
    () => {
      if (isFaceMode) {
        const face = allFacesRef.current?.[0];
        const kps = face ? getFaceKeypoints(face) : null;
        return kps && kps.length > 1 ? (kps as { x: number; y: number }[]) : null;
      } else {
        const kps = handsRef.current?.[0]?.keypoints;
        return kps && kps.length > 0 ? (kps as { x: number; y: number }[]) : null;
      }
    },
    videoRef,
    modelStatus === 'ready',
    { threshold: 12 } // Tăng nhẹ threshold để tránh báo rung sai
  );

  // ── Thumbnail helper ────────────────
  const getVideoThumbAndCanvas = useCallback((hands?: HandResult[], faces?: FaceMeshResult[]) => {
    if (!videoRef.current) return { thumbnail: '', rawThumbnail: '', canvas: document.createElement('canvas'), rawCanvas: document.createElement('canvas') };

    const vW = videoRef.current.videoWidth || 640;
    const vH = videoRef.current.videoHeight || 480;
    
    const cvWidth = vW;
    const cvHeight = vH;

    const cv = document.createElement('canvas');
    cv.width = cvWidth;
    cv.height = cvHeight;
    const ctx = cv.getContext('2d');
    
    const rawCv = document.createElement('canvas');
    rawCv.width = cvWidth;
    rawCv.height = cvHeight;
    const rawCtx = rawCv.getContext('2d');
    
    let rawThumbnail = '';
    if (ctx && rawCtx && videoRef.current) {
      rawCtx.drawImage(videoRef.current, 0, 0, cvWidth, cvHeight);
      ctx.drawImage(rawCv, 0, 0); // copy raw to cv
      rawThumbnail = rawCv.toDataURL('image/jpeg', 0.8);
      
      if (hands && hands.length > 0) {
        hands.forEach((hand, idx) => {
          if (hand.keypoints && hand.keypoints.length >= 21) {
            drawHandSkeleton(ctx, hand.keypoints, vW, vH, cvWidth, cvHeight, {
              lineColor: idx === 0 ? '#6366f1' : '#ec4899',
              jointColor1: idx === 0 ? '#4f46e5' : '#db2777',
              jointColor2: idx === 0 ? '#4f46e5' : '#db2777',
              jointRadius: 2,
            });
          }
        });
      }

      if (faces && faces.length > 0) {
        faces.forEach((face) => {
          const kps = getFaceKeypoints(face);
          if (kps && kps.length >= 30) {
            drawFaceSkeleton(ctx, kps, vW, vH, cvWidth, cvHeight);
          }
        });
      }
    }
    return {
      thumbnail: cv.toDataURL('image/jpeg', 0.8),
      rawThumbnail,
      canvas: cv,
      rawCanvas: rawCv
    };
  }, [videoRef]);

  // ── Count helper ────────────────────
  const getClassSampleCount = useCallback(
    (classId: string) => {
      const classLabel =
        classes.find((c) => c.id === classId)?.label || classId;
      // Explorer Mode: count ALL samples (including questionable)
      // Careful Mode: only count valid samples
      const countableSamples = carefulMode
        ? samples.filter((s) => s.isValid !== false)
        : samples;
      return countableSamples.filter(
        (s) =>
          s.sourceId === classId ||
          (s.label === classLabel && !s.sourceId),
      ).length;
    },
    [samples, classes, carefulMode],
  );

  // ══════════════════════════════════════
  // CAPTURE
  // ══════════════════════════════════════
  const captureSample = useCallback(() => {
    if (isFaceMode) {
      // ── FACE MODE ──
      const faces = allFacesRef.current;
      if (!faces || faces.length === 0) return;

      const face = faces[0];
      const kps = getFaceKeypoints(face);
      if (!kps || kps.length < 468) return;

      const features = normalizeFaceFeatures(kps);
      const { thumbnail, rawThumbnail, canvas } = getVideoThumbAndCanvas(undefined, faces);
      const activeClassLabel =
        classes.find((c) => c.id === activeClass)?.label || activeClass;

      const validation = validateFaceExpression(kps, activeClass);
      const faceRoi = kps ? calculateROI(kps as { x: number; y: number }[], canvas.width, canvas.height, 0.1) : undefined;
      const quality = assessQuality(canvas, faceRoi);

      setSamples((prev) => {
        let msg = '';
        let isQuestionable = false;
        let questionableReason = '';

        if (!validation.isValid) {
          msg = validation.suggestion;
          isQuestionable = true;
          questionableReason = msg;
        } else if (quality.isBlurry) {
          msg = 'Ảnh hơi mờ! Bé cố gắng giữ chắc tay nhé 🔍';
          isQuestionable = true;
          questionableReason = msg;
        } else if (quality.isDark) {
          msg = 'Ảnh hơi tối! Bé tìm chỗ sáng hơn xíu nha 🌑';
          isQuestionable = true;
          questionableReason = msg;
        }

        if (msg) {
          if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
          // Explorer Mode: positive tone, Careful Mode: warning tone
          const toastMsg = carefulMode
            ? `⚠️ ${msg}`
            : `⚠️ ${msg} — Để xem AI sẽ học ra sao nhé!`;
          setValidationToast(toastMsg);
          toastTimeoutRef.current = setTimeout(
            () => setValidationToast(null),
            4000,
          );
        }

        // Explorer Mode: always valid (collect everything), Careful Mode: reject invalid
        const finalIsValid = carefulMode ? validation.isValid : true;

        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            label: activeClassLabel,
            features,
            sourceId: activeClass,
            thumbnail,
            rawThumbnail,
            isValid: finalIsValid,
            isQuestionable,
            questionableReason,
            quality,
          },
        ];
      });
    } else {
      // ── HAND MODES ──
      const hands = handsRef.current;
      if (!hands || hands.length === 0) return;

      if (isTwoHandMode && hands.length < 2) return;

      const activeClassLabel =
        classes.find((c) => c.id === activeClass)?.label || activeClass;

      // For hand-2: KNN label maps to the single-hand equivalent
      let knnLabel = activeClassLabel;
      if (isTwoHandMode) {
        // class_3 → use class_1 label, class_4 → use class_2 label
        if (activeClass === 'class_3') knnLabel = classes[0]?.label || activeClassLabel;
        if (activeClass === 'class_4') knnLabel = classes[1]?.label || activeClassLabel;
      }

      const { thumbnail, rawThumbnail, canvas, rawCanvas } = getVideoThumbAndCanvas(hands, undefined);
      const expectedFingers = getExpectedFingerCount(activeClass, mode, activeClassLabel);

      // Pick golden dataset based on mode
      let goldenDataset: GoldenTestSample[] = [];
      if (mode === 'hand-1' || mode === 'hand-2') {
        goldenDataset = GOLDEN_TEST_DATASET;
      } else if (mode === 'gesture') {
        goldenDataset = GOLDEN_GESTURES_DATASET;
      }

      const goldenLabel =
        mode === 'gesture'
          ? activeClass // gesture golden uses class_1, class_2 etc.
          : CLASS_TO_GOLDEN_LABEL[activeClass] || '';
      const goldenCurrentClass = goldenDataset.filter(
        (g) => g.expectedLabel === goldenLabel,
      );
      const goldenOtherClasses = goldenDataset.filter(
        (g) => g.expectedLabel !== goldenLabel,
      );

      setSamples((prev) => {
        const newSamples: StoredSample[] = [];
        let hasWarning = false;
        let warningMsg = '';

        const processHand = (handIndex: number) => {
          if (
            !hands[handIndex] ||
            !hands[handIndex].keypoints ||
            hands[handIndex].keypoints!.length < 21
          )
            return;

          const keypoints = hands[handIndex].keypoints!;
          const roi = calculateROI(keypoints as { x: number; y: number }[], rawCanvas.width, rawCanvas.height, 0.1);
          const quality = assessQuality(rawCanvas, roi, keypoints as { x: number; y: number }[]);

          const features = normalizeHandKeypoints(keypoints);
          let heuristicValid = true;
          let isQuestionable = false;
          let questionableReason = '';
          
          // Stability check
          if (!isStable) {
            heuristicValid = false;
            isQuestionable = true;
            hasWarning = true;
            warningMsg = `Tay đang rung! Bé giữ chắc tay nhé 📳`;
            questionableReason = warningMsg;
          } else if (quality.isBlurry || quality.isDark) {
            heuristicValid = false;
            isQuestionable = true;
            hasWarning = true;
            warningMsg = quality.isBlurry 
              ? 'Ảnh hơi mờ! Bé cố gắng giữ chắc tay nhé 🔍' 
              : 'Ảnh hơi tối! Bé tìm chỗ sáng hơn xíu nha 🌑';
            questionableReason = warningMsg;
          } else {
            const isDynamicClass = !CLASS_TO_GOLDEN_LABEL[activeClass];

            if (isDynamicClass) {
              // === NHÃN ĐỘNG: Negative Golden Check ===
              // Dùng khoảng cách (distance) thay vì confidence vì Golden chỉ có 2 class
              // → confidence luôn >= 67% cho MỌI input, không phân biệt được
              if (goldenDataset.length > 0) {
                let minDistToGolden = Infinity;
                let closestGoldenLabel = '';
                goldenDataset.forEach(g => {
                  let d = 0;
                  for (let i = 0; i < Math.min(features.length, g.features.length); i++) {
                    const diff = g.features[i] - features[i];
                    d += diff * diff;
                  }
                  const dist = Math.sqrt(d);
                  if (dist < minDistToGolden) {
                    minDistToGolden = dist;
                    closestGoldenLabel = g.expectedLabel;
                  }
                });

                const flippedFeatures = features.map((v: number, i: number) => i % 2 === 0 ? -v : v);
                let minDistFlipped = Infinity;
                let closestFlippedLabel = '';
                goldenDataset.forEach(g => {
                  let d = 0;
                  for (let i = 0; i < Math.min(flippedFeatures.length, g.features.length); i++) {
                    const diff = g.features[i] - flippedFeatures[i];
                    d += diff * diff;
                  }
                  const dist = Math.sqrt(d);
                  if (dist < minDistFlipped) {
                    minDistFlipped = dist;
                    closestFlippedLabel = g.expectedLabel;
                  }
                });

                const bestDist = Math.min(minDistToGolden, minDistFlipped);
                const bestLabel = minDistToGolden <= minDistFlipped ? closestGoldenLabel : closestFlippedLabel;

                if (bestDist < 0.35) {
                  heuristicValid = false;
                  isQuestionable = true;
                  hasWarning = true;
                  warningMsg = `Cử chỉ này trông giống "${bestLabel}" quá! Hãy giơ đủ số ngón đúng nhé 🖐️`;
                  questionableReason = warningMsg;
                }
              }

              // Positive check: skeleton đếm ngón
              if (heuristicValid && expectedFingers > 0) {
                const detectedFingers = countExtendedFingers(keypoints);
                if (detectedFingers >= 0) {
                  let isFingerCountOk: boolean;
                  
                  if (expectedFingers === 5) {
                    // 5 Ngón: cần 4 ngón (không thumb) + ngón cái xòe
                    isFingerCountOk = detectedFingers >= 4 && isThumbExtended(keypoints);
                  } else if (expectedFingers === 4) {
                    // 4 Ngón: cần đúng 4 ngón (không thumb) VÀ ngón cái KHÔNG xòe
                    // Nếu cả 4 ngón + ngón cái đều xòe → đó là 5 ngón, reject
                    isFingerCountOk = detectedFingers === 4 && !isThumbExtended(keypoints);
                  } else {
                    // 3 Ngón hoặc ít hơn: exact match
                    isFingerCountOk = detectedFingers === expectedFingers;
                  }
                  
                  if (!isFingerCountOk) {
                    heuristicValid = false;
                    isQuestionable = true;
                    hasWarning = true;
                    warningMsg = `Bạn đang giơ không đúng số ngón! Cần giơ đúng ${expectedFingers} ngón 🖐️`;
                    questionableReason = warningMsg;
                  }
                }
              }
            } else {
              // === NHÃN CỐ ĐỊNH: Logic gốc ===
              // Validation 2: Golden dataset distance
              if (
                goldenCurrentClass.length > 0 &&
                goldenOtherClasses.length > 0
              ) {
                const minDistToCorrect = goldenCurrentClass.reduce((min, g) => {
                  let d = 0;
                  for (let i = 0; i < Math.min(features.length, g.features.length); i++) {
                    const diff = g.features[i] - features[i];
                    d += diff * diff;
                  }
                  return Math.min(min, Math.sqrt(d));
                }, Infinity);

                let minDistToWrong = Infinity;
                let closestWrongLabel = '';
                goldenOtherClasses.forEach((g) => {
                  let d = 0;
                  for (
                    let i = 0;
                    i < Math.min(features.length, g.features.length);
                    i++
                  ) {
                    const diff = g.features[i] - features[i];
                    d += diff * diff;
                  }
                  const dist = Math.sqrt(d);
                  if (dist < minDistToWrong) {
                    minDistToWrong = dist;
                    if (mode === 'gesture') {
                      const cls = classes.find((c) => c.id === g.expectedLabel);
                      closestWrongLabel = cls?.label || g.expectedLabel;
                    } else {
                      closestWrongLabel = g.expectedLabel;
                    }
                  }
                });

                const distThreshold = mode === 'gesture' ? 0.7 : 0.9;
                if (minDistToWrong < minDistToCorrect * distThreshold) {
                  heuristicValid = false;
                  isQuestionable = true;
                  hasWarning = true;
                  warningMsg = `Cử chỉ này trông giống "${closestWrongLabel}" hơn! Bé thử lại nhé? 🤔`;
                  questionableReason = warningMsg;
                }
              }

              // Positive check: skeleton đếm ngón (cho cả nhãn cố định)
              if (heuristicValid && expectedFingers > 0) {
                const detectedFingers = countExtendedFingers(keypoints);
                if (detectedFingers >= 0 && detectedFingers !== expectedFingers) {
                  heuristicValid = false;
                  isQuestionable = true;
                  hasWarning = true;
                  warningMsg = `Bạn đang giơ không đúng số ngón! Cần giơ đúng ${expectedFingers} ngón 🖐️`;
                  questionableReason = warningMsg;
                }
              }
            }
          }

          // Explorer Mode: always valid (collect everything), Careful Mode: reject invalid
          const finalIsValid = carefulMode ? heuristicValid : true;

          newSamples.push({
            id: crypto.randomUUID(),
            label: isTwoHandMode ? knnLabel : activeClassLabel,
            features,
            sourceId: activeClass,
            thumbnail,
            rawThumbnail,
            isValid: finalIsValid,
            isQuestionable,
            questionableReason,
            invalidReason: finalIsValid ? undefined : warningMsg,
            quality,
          });
        };

        processHand(0);
        if (isTwoHandMode) processHand(1);

        if (hasWarning && warningMsg) {
          if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
          // Explorer Mode: positive tone, Careful Mode: warning tone
          const toastMsg = carefulMode
            ? `⚠️ ${warningMsg}`
            : `⚠️ ${warningMsg} — Để xem AI sẽ học ra sao nhé!`;
          setValidationToast(toastMsg);
          toastTimeoutRef.current = setTimeout(
            () => setValidationToast(null),
            5000,
          );
        }

        if (newSamples.length > 0) {
          setTimeout(() => setIsModelOutdated(true), 0);
          return [...prev, ...newSamples];
        }
        return prev;
      });
    }
  }, [
    isFaceMode,
    isTwoHandMode,
    mode,
    activeClass,
    classes,
    allFacesRef,
    handsRef,
    getVideoThumbAndCanvas,
    carefulMode,
  ]);

  const startCapturing = useCallback(() => {
    if (modelStatus !== 'ready') return;
    playClickSound();
    setIsCapturing(true);
    captureSample();
    captureIntervalRef.current = setInterval(captureSample, 500);
  }, [modelStatus, captureSample]);

  const stopCapturing = useCallback(() => {
    setIsCapturing(false);
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
  }, []);

  const deleteSample = useCallback((id: string) => {
    setSamples((prev) => prev.filter((s) => s.id !== id));
    setIsModelOutdated(true);
  }, []);

  const clearClassSamples = useCallback(
    (classId: string) => {
      playClickSound();
      const classLabel =
        classes.find((c) => c.id === classId)?.label || classId;
      setSamples((prev) =>
        prev.filter((s) =>
          s.sourceId ? s.sourceId !== classId : s.label !== classLabel,
        ),
      );
      setIsTrained(false);
      setIsModelOutdated(false);
    },
    [classes],
  );

  // ══════════════════════════════════════
  // TRAINING
  // ══════════════════════════════════════

  const canTrain = classes.every((cls) => {
    const count = getClassSampleCount(cls.id);
    const effective = isTwoHandMode ? Math.floor(count / 2) : count;
    return effective >= minSamplesPerClass;
  });

  const handleTrain = useCallback(async () => {
    if (!canTrain) return;
    playClickSound();
    
    setIsTraining(true);
    setTrainingProgress(0);

    try {
      if (trainerRef.current) {
        // Explorer Mode: train with ALL samples (including questionable ones)
        // Careful Mode: only train with valid samples
        const trainingSamples = carefulMode
          ? samples.filter((s) => s.isValid !== false)
          : samples;
        await trainerRef.current.train(trainingSamples, (epoch, progress) => {
          setTrainingProgress(progress);
        });
        // progress reaches 100 here, which will trigger the useEffect below
      }
    } catch (err) {
      console.error('Training failed', err);
      setIsTraining(false);
      alert('Lỗi huấn luyện mô hình. Vui lòng thử lại.');
    }
  }, [canTrain, samples, carefulMode]);

  // Handle train completion & re-evaluation
  useEffect(() => {
    if (isTraining && trainingProgress >= 100) {
      setTimeout(() => {
        setIsTraining(false);
        setIsTrained(true);
        playSuccessSound();
        
        // Perform initial evaluation immediately
        const targetDataset = ((teacherTemplate?.samples?.length ?? 0) > 0) ? teacherTemplate!.samples! : samples;
        let hasIssues = false;
        
        const evaluated = samples.map(sample => {
          const refDataset = (targetDataset === samples) ? samples.filter(s => s.id !== sample.id) : targetDataset;
          if (refDataset.length === 0) return sample;
          
          const result = classifyKNNDetailed(sample.features, refDataset, kValue);
          const actualThreshold = Math.min(threshold, kValue);
          const bestVotes = (result.counts as Record<string, number>)[result.label] || 0;
          
          let predictedLabel = 'Chưa rõ ràng';
          if (bestVotes >= actualThreshold) {
            predictedLabel = result.label;
          }
          
          const studentClassId = sample.sourceId;
          const classDef = classes.find(c => c.id === studentClassId);
          const expectedLabel = classDef ? classDef.label : sample.label;
          
          const isMisclassified = (sample.quality?.isBlurry || sample.quality?.isDark) 
            ? false 
            : predictedLabel !== expectedLabel;
          
          if (isMisclassified || sample.quality?.isBlurry || sample.quality?.isDark || sample.isValid === false) {
            hasIssues = true;
          }
          
          return {
            ...sample,
            aiFeedback: {
              isMisclassified,
              predictedLabel,
              nearestMatchThumbnail: result.nearest[0]?.thumbnail
            }
          };
        });
        
        setSamples(evaluated);
        setIsModelOutdated(false);
        
        // Removed auto-popup and auto-submit so the user can test the camera freely
      }, 0);
    }
  }, [isTraining, trainingProgress, classes, kValue, threshold, teacherTemplate, samples, onTrainComplete]);

  // Re-evaluate when K or threshold changes
  useEffect(() => {
    if (isTrained && !isTraining) {
      setTimeout(() => {
        setSamples(prevSamples => {
          let hasChanges = false;
          const targetDataset = ((teacherTemplate?.samples?.length ?? 0) > 0) ? teacherTemplate!.samples! : prevSamples;
          
          const evaluated = prevSamples.map(sample => {
            const refDataset = (targetDataset === prevSamples) ? prevSamples.filter(s => s.id !== sample.id) : targetDataset;
            if (refDataset.length === 0) return sample;
            
            const result = classifyKNNDetailed(sample.features, refDataset, kValue);
            const actualThreshold = Math.min(threshold, kValue);
            
            const bestVotes = (result.counts as Record<string, number>)[result.label] || 0;
            let predictedLabel = 'Chưa rõ ràng';
            if (bestVotes >= actualThreshold) {
              predictedLabel = result.label;
            }
            
            const studentClassId = sample.sourceId;
            const classDef = classes.find(c => c.id === studentClassId);
            const expectedLabel = classDef ? classDef.label : sample.label;
            
            const isMisclassified = (sample.quality?.isBlurry || sample.quality?.isDark)
              ? false
              : predictedLabel !== expectedLabel;
            
            const currentFeedback = sample.aiFeedback;
            if (!currentFeedback || currentFeedback.isMisclassified !== isMisclassified || currentFeedback.predictedLabel !== predictedLabel) {
              hasChanges = true;
              return {
                ...sample,
                aiFeedback: {
                  isMisclassified,
                  predictedLabel,
                  nearestMatchThumbnail: result.nearest[0]?.thumbnail
                }
              };
            }
            
            return sample;
          });
          
          return hasChanges ? evaluated : prevSamples;
        });
      }, 0);
    }
  }, [kValue, threshold, isTrained, isTraining, classes, teacherTemplate]);

  // ══════════════════════════════════════
  // PREDICTION LOOP
  // ══════════════════════════════════════
  useEffect(() => {
    if (modelStatus !== 'ready' || isTraining) return;

    let rafId: number;

    const runPrediction = async () => {
      if (isFaceMode) {
        const faces = allFacesRef.current;
        if (faces && faces.length > 0) {
          const kps = getFaceKeypoints(faces[0]);
          if (kps && kps.length >= 468) {
            const features = normalizeFaceFeatures(kps);
            const resultKNN = classifyKNNWithVotes(features, samples, kValue);
            const resultNN = await trainerRef.current!.predict(features);
            
            if (resultNN && resultNN.label) {
              setPredictedLabel(classes.find(c => c.id === resultNN.label || c.label === resultNN.label)?.label || resultNN.label || 'Chưa rõ ràng... 🤔');
            }
            if (resultNN && resultNN.confidences) {
              setNnConfidences(resultNN.confidences);
            }

            setIsAnomaly(resultKNN.minDistance > 3.5);
            setKNearestIds(resultKNN.kNearestIds);
            setVoteCounts(resultKNN.voteCounts);
          }
        } else {
          setPredictedLabel('AI đang đợi khuôn mặt bé... 👀');
          setNnConfidences(null);
          setIsAnomaly(false);
          setKNearestIds([]);
          setVoteCounts({});
        }
      } else {
        const hands = handsRef.current;
        if (hands && hands.length > 0) {
          if (isTwoHandMode && hands.length >= 2) {
            const f1 = normalizeHandKeypoints(hands[0]?.keypoints || []);
            const f2 = normalizeHandKeypoints(hands[1]?.keypoints || []);
            const pred1KNN = classifyKNNWithVotes(f1, samples, kValue);
            const pred2KNN = classifyKNNWithVotes(f2, samples, kValue);
            
            const pred1NN = await trainerRef.current!.predict(f1);
            const pred2NN = await trainerRef.current!.predict(f2);
            
            // Lấy kết quả tự tin cao hơn
            let bestPred = pred1NN;
            const bestConf = pred1NN?.confidences?.[pred1NN.label] || 0;
            const conf2 = pred2NN?.confidences?.[pred2NN.label] || 0;
            if (conf2 > bestConf) {
              bestPred = pred2NN;
            }

            if (bestPred && bestPred.label) {
              setPredictedLabel(classes.find(c => c.id === bestPred.label || c.label === bestPred.label)?.label || bestPred.label || 'Chưa rõ ràng... 🤔');
            }
            if (bestPred && bestPred.confidences) {
              setNnConfidences(bestPred.confidences);
            }
            
            const isAnomaly1 = pred1KNN.minDistance > 0.7;
            const isAnomaly2 = pred2KNN.minDistance > 0.7;
            setIsAnomaly(isAnomaly1 && isAnomaly2);

            if (isAnomaly1 && isAnomaly2 && datasetQuality?.isDatasetPerfect) {
               setAnomalyMessage('Khác thường, không có dữ liệu này trong thư viện ảnh của bé!');
               setPredictedLabel('Khác thường, không có dữ liệu này trong thư viện ảnh của bé!');
               setKNearestIds([]);
               setVoteCounts({});
               setNnConfidences(null);
            } else {
              setAnomalyMessage(undefined);
              if (pred1NN.label === pred2NN.label) {
                setPredictedLabel(pred1NN.label);
              } else {
                setPredictedLabel(`Tay 1: ${pred1NN.label} | Tay 2: ${pred2NN.label}`);
              }
              
              setKNearestIds([...pred1KNN.kNearestIds, ...pred2KNN.kNearestIds]);
              const merged: Record<string, number> = { ...pred1KNN.voteCounts };
              Object.entries(pred2KNN.voteCounts).forEach(([k, v]) => {
                merged[k] = (merged[k] || 0) + v;
              });
              setVoteCounts(merged);
            }
          } else {
            const kps = hands[0].keypoints;
            if (kps && kps.length >= 21) {
              const features = normalizeHandKeypoints(kps);
              const resultKNN = classifyKNNWithVotes(features, samples, kValue);
              const resultNN = await trainerRef.current!.predict(features);
              
              let currentPredLabel = 'Chưa rõ ràng... 🤔';
              if (resultNN && resultNN.label) {
                currentPredLabel = classes.find(c => c.id === resultNN.label || c.label === resultNN.label)?.label || resultNN.label || 'Chưa rõ ràng... 🤔';
              }

              const teacherSamples: StoredSample[] = (teacherTemplate as TeacherTemplate)?.dataset?.samples || teacherTemplate?.samples || [];

              // Adaptive Mentorship: Only cross-check with Teacher Validator if student is in Phase B
              let isAnom = false;
              let isOODOrConflict = false;
              let isMissingDataLocal = false;

              if (datasetQuality?.isDatasetPerfect && teacherSamples.length > 0) {
                const crossCheck = crossCheckLiveFeatures(features, samples, teacherSamples, kValue, threshold, 0.65, kps);
                isMissingDataLocal = crossCheck.isMissingData || false;
                setIsMissingData(isMissingDataLocal);
                
                if (crossCheck.isAnomaly || crossCheck.isOOD || crossCheck.isConflict || crossCheck.isMissingData) {
                  isAnom = true;
                  setIsAnomaly(true);
                  setAnomalyMessage(crossCheck.message || '⚠️ Cử chỉ này chưa có trong thư viện ảnh của bé!');
                  
                  if (crossCheck.isOOD || crossCheck.isConflict) {
                    isOODOrConflict = true;
                    currentPredLabel = 'Dữ liệu chưa được học... 🤔';
                    setTeacherHintImages([]);
                  } else if (crossCheck.isMissingData) {
                    // It's missing data, not completely OOD. Keep the Teacher's predicted label if any.
                    if (crossCheck.teacherLabel) {
                      currentPredLabel = classes.find(c => c.id === crossCheck.teacherLabel || c.label === crossCheck.teacherLabel)?.label || crossCheck.teacherLabel || currentPredLabel;
                    }
                    if (crossCheck.teacherNearestSampleIds) {
                      const hints = teacherSamples
                        .filter(s => s.id && crossCheck.teacherNearestSampleIds!.includes(s.id))
                        .map(s => s.thumbnail || s.rawThumbnail || '')
                        .filter(url => url !== '')
                        .slice(0, 3);
                      setTeacherHintImages(hints);
                    } else {
                      setTeacherHintImages([]);
                    }
                  }
                } else {
                  setIsAnomaly(resultKNN.minDistance > 0.65);
                  setAnomalyMessage(undefined);
                  setTeacherHintImages([]);
                }
              } else {
                // Phase A: Teacher Validator OFF
                setIsMissingData(false);
                isAnom = resultKNN.minDistance > 0.65;
                setIsAnomaly(isAnom);
                
                if (isAnom && datasetQuality?.isDatasetPerfect) {
                  isOODOrConflict = true;
                  setAnomalyMessage('Khác thường, không có dữ liệu này trong thư viện ảnh của bé!');
                  currentPredLabel = 'Khác thường, không có dữ liệu này trong thư viện ảnh của bé!';
                } else {
                  setAnomalyMessage(undefined);
                }
              }

              setPredictedLabel(currentPredLabel);

              if (isOODOrConflict || isMissingDataLocal) {
                setKNearestIds([]);
                setVoteCounts({});
                
                // For missing data, we still want to show the Teacher's predicted confidences if available, 
                // but since the student doesn't have it, we just set it to null so the energy bar component 
                // can show it at 0% to encourage collection via isAnomaly flag.
                if (isOODOrConflict) {
                  setNnConfidences(null);
                }
              } else {
                if (resultNN && resultNN.confidences) {
                  setNnConfidences(resultNN.confidences);
                }
                setKNearestIds(resultKNN.kNearestIds);
                setVoteCounts(resultKNN.voteCounts);
              }
            }
          }
        } else {
          setPredictedLabel(
            isFaceMode
              ? 'AI đang đợi khuôn mặt bé... 👀'
              : 'AI đang đợi tay bé... ✋',
          );
          setNnConfidences(null);
          setIsAnomaly(false);
          setKNearestIds([]);
          setVoteCounts({});
        }
      }

      rafId = requestAnimationFrame(runPrediction);
    };

    runPrediction();
    return () => cancelAnimationFrame(rafId);
  }, [isTrained, modelStatus, isFaceMode, isTwoHandMode, samples, allFacesRef, handsRef, classes, datasetQuality?.isDatasetPerfect, isTraining, kValue, teacherTemplate, threshold]);

  // ══════════════════════════════════════
  // CANVAS DRAWING LOOP
  // ══════════════════════════════════════
  useEffect(() => {
    let rafId: number;

    const runFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || modelStatus !== 'ready') {
        rafId = requestAnimationFrame(runFrame);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        rafId = requestAnimationFrame(runFrame);
        return;
      }

      // Sync canvas size
      const rect = video.getBoundingClientRect();
      const displayW = Math.round(rect.width);
      const displayH = Math.round(rect.height);
      if (
        displayW > 0 &&
        displayH > 0 &&
        (canvas.width !== displayW || canvas.height !== displayH)
      ) {
        canvas.width = displayW;
        canvas.height = displayH;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (isHandMode) {
        // ── Draw hand skeletons ──
        const hands = handsRef.current;
        if (hands && hands.length > 0) {
          const handsToRender = hands.slice(0, maxVisibleSkeletons);
          handsToRender.forEach((hand, idx) => {
            const kps = hand.keypoints;
            if (kps && kps.length >= 21) {
              drawHandSkeleton(
                ctx,
                kps,
                video.videoWidth,
                video.videoHeight,
                canvas.width,
                canvas.height,
                {
                  lineColor: idx === 0 ? '#6366f1' : '#ec4899',
                  jointColor1: idx === 0 ? '#4f46e5' : '#db2777',
                  jointColor2: idx === 0 ? '#4f46e5' : '#db2777',
                  jointRadius: 5,
                },
              );
            }
          });
        }
      } else {
        // ── Draw face mesh ──
        const allFaces = allFacesRef.current;
        const validFaces = allFaces.filter((kps) => kps.length >= 30);

        if (validFaces.length > 0 && video.videoWidth > 0) {
          validFaces.forEach((kpsRaw) => {
            ctx.save();
            const kps = normalizeFaceKeypoints(kpsRaw, video, canvas);

            if (kps.length > 100) {
              ctx.strokeStyle = '#60a5fa';
              ctx.lineWidth = 1.8;
              drawPolyline(ctx, FACE_OVAL, kps);

              ctx.strokeStyle = '#a78bfa';
              ctx.lineWidth = 1.4;
              drawPolyline(ctx, FACE_L_EYE, kps);
              drawPolyline(ctx, FACE_R_EYE, kps);

              ctx.strokeStyle = '#fbbf24';
              ctx.lineWidth = 1.4;
              drawPolyline(ctx, FACE_LIPS, kps);

              ctx.strokeStyle = '#34d399';
              ctx.lineWidth = 1.2;
              drawPolyline(ctx, FACE_NOSE, kps);
            }

            ctx.fillStyle = 'rgba(96,165,250,0.55)';
            for (const point of kps) {
              ctx.beginPath();
              ctx.arc(point.x, point.y, 1.4, 0, Math.PI * 2);
              ctx.fill();
            }

            ctx.restore();
          });
        }
      }

      rafId = requestAnimationFrame(runFrame);
    };

    runFrame();
    return () => cancelAnimationFrame(rafId);
  }, [
    modelStatus,
    videoRef,
    canvasRef,
    isHandMode,
    maxVisibleSkeletons,
    handsRef,
    allFacesRef,
  ]);

  // ── Cleanup intervals on unmount ────
  useEffect(() => {
    return () => {
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // ══════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════
  const loadingText = isFaceMode
    ? 'ĐANG KHỞI ĐỘNG CAMERA NHẬN DẠNG KHUÔN MẶT...'
    : 'ĐANG KHỞI ĐỘNG CAMERA NHẬN DẠNG XƯƠNG TAY...';



  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* ── LEFT PANEL: Class selector + capture + gallery ── */}
      <div className={`lg:col-span-3 bg-white rounded-3xl p-5 border-4 shadow-xl flex flex-col transition-colors ${carefulMode ? 'border-indigo-400' : 'border-amber-400'}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-black text-indigo-600 tracking-wider uppercase">
            Lớp học AI của bé 🧑‍🏫
          </div>
          {/* Explorer / Careful Mode Toggle */}
          <button
            onClick={() => { playClickSound(); setCarefulMode(!carefulMode); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold border-2 transition-all hover:scale-105 ${
              carefulMode
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-amber-50 border-amber-300 text-amber-700'
            }`}
            title={carefulMode ? 'Chế độ Cẩn Thận: Ảnh sai nhãn sẽ bị loại' : 'Chế độ Khám Phá: Thu tất cả ảnh, kể cả sai nhãn'}
          >
            {carefulMode ? (
              <><ShieldCheck className="w-3.5 h-3.5" /> Cẩn Thận</>
            ) : (
              <><FlaskConical className="w-3.5 h-3.5" /> Khám Phá</>
            )}
          </button>
        </div>

        {/* Explorer Mode Banner */}
        {!carefulMode && (
          <div className="mb-3 bg-amber-50 border-2 border-amber-200 rounded-2xl p-2.5 text-[11px] font-bold text-amber-700 flex items-start gap-2">
            <span>Chế độ Khám Phá: AI sẽ học TẤT CẢ ảnh kể cả sai nhãn. Bé sẽ thấy hậu quả khi dữ liệu bẩn!</span>
          </div>
        )}

        {/* Class buttons */}
        <div className="space-y-2.5 mb-4">
          {classes.map((cls) => {
            const rawCount = getClassSampleCount(cls.id);
            const effectiveCount = isTwoHandMode
              ? Math.floor(rawCount / 2)
              : rawCount;
            const isSelected = activeClass === cls.id;
            const hasEnough = effectiveCount >= minSamplesPerClass;

            return (
              <div
                key={cls.id}
                onClick={() => {
                  playClickSound();
                  setActiveClass(cls.id);
                }}
                className={`cursor-pointer rounded-2xl p-3.5 border-2 transition-all flex items-center justify-between ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/80 shadow-md ring-2 ring-indigo-200'
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div>
                  <div className="font-extrabold text-indigo-900 flex items-center gap-1.5">
                    <span className="text-lg">{cls.emoji}</span>
                    <span>{cls.label}</span>
                  </div>
                  <div className="text-xs text-gray-500 font-semibold mt-1 flex items-center gap-1.5">
                    <span>Đã chụp:</span>
                    <span className="text-indigo-600 font-black">
                      {effectiveCount} ảnh
                    </span>
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                        hasEnough
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700 animate-pulse'
                      }`}
                    >
                      {hasEnough
                        ? '✅ Đủ mẫu'
                        : `⚠️ Cần thêm ${minSamplesPerClass - effectiveCount}`}
                    </span>
                  </div>
                </div>
                {effectiveCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearClassSamples(cls.id);
                    }}
                    className="p-2 hover:bg-red-100 rounded-lg text-red-500"
                    title="Xóa hết"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Capture button */}
        <button
          onMouseDown={startCapturing}
          onMouseUp={stopCapturing}
          onMouseLeave={stopCapturing}
          onTouchStart={startCapturing}
          onTouchEnd={stopCapturing}
          disabled={modelStatus !== 'ready'}
          className={`w-full font-extrabold py-4 px-6 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-lg mb-4 border-b-4 ${
            isCapturing
              ? 'bg-red-500 hover:bg-red-600 border-red-700 text-white animate-pulse scale-95'
              : 'bg-indigo-500 hover:bg-indigo-600 border-indigo-700 text-white active:scale-95 disabled:bg-gray-300 disabled:scale-100'
          }`}
        >
          <Camera className="w-6 h-6" />
          <span>{isCapturing ? 'ĐANG THU MẪU...' : 'GIỮ ĐỂ CHỤP 📸'}</span>
        </button>

        {/* Sample gallery for active class */}
        <SampleGallery
          samples={samples.filter((s) => s.sourceId === activeClass)}
          onDeleteSample={deleteSample}
          onClearAll={() => clearClassSamples(activeClass)}
          isTrained={isTrained}
        />

        {/* Validation toast */}
        {validationToast && (
          <div className={`mt-3 p-3 border-2 rounded-2xl text-sm font-bold flex items-center gap-2 animate-bounce shadow-lg ${
            carefulMode
              ? 'bg-red-100 border-red-400 text-red-700'
              : 'bg-amber-50 border-amber-300 text-amber-700'
          }`}>
            <span className="text-xl">🚨</span>
            <span>{validationToast}</span>
          </div>
        )}

        {/* Status banner */}
        {(() => {
          if (canTrain) {
            return (
              <div className="mt-4 bg-green-50 border-2 border-green-200 text-green-700 rounded-2xl p-3 text-xs font-bold shadow-inner">
                🎉 Tuyệt vời! Đủ dữ liệu rồi — hãy nhấn{' '}
                <b>&quot;Huấn Luyện AI 🧠&quot;</b> bên dưới nhé!
              </div>
            );
          }

          const missing = classes
            .map((cls) => {
              const raw = getClassSampleCount(cls.id);
              const eff = isTwoHandMode ? Math.floor(raw / 2) : raw;
              const need = minSamplesPerClass - eff;
              return need > 0
                ? `"${cls.emoji} ${cls.label}": cần thêm ${need} ảnh`
                : null;
            })
            .filter(Boolean);

          if (missing.length === 0) return null;

          return (
            <div className="mt-4 bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl p-3 text-xs font-bold shadow-inner flex flex-col gap-1">
              <span className="text-red-800 text-sm font-extrabold">
                ⚠️ Cần thêm dữ liệu:
              </span>
              <ul className="list-disc pl-4 space-y-0.5">
                {missing.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          );
        })()}

        {/* Tip */}
        <p className="mt-4 text-xs font-semibold text-gray-500 text-center leading-relaxed bg-yellow-50 border border-yellow-200 rounded-xl p-3">
          💡 <b>Mẹo cho bé:</b>{' '}
          {isFaceMode
            ? 'Hãy di chuyển khuôn mặt nhẹ nhàng khi chụp để AI học được nhiều góc nhé!'
            : 'Hãy xoay bàn tay nhẹ nhàng khi chụp để AI học được nhiều góc nhé!'}
        </p>

        {/* Imbalance Warning */}
        {!isTrained && (
          <DataBalanceWarning 
            classCounts={classes.map((c) => {
              const count = getClassSampleCount(c.id);
              return {
                id: c.id,
                label: c.label,
                count: isTwoHandMode ? Math.floor(count / 2) : count
              };
            })} 
          />
        )}

        {/* Train / Progress */}
        <div className="mt-auto pt-4">
          {isTraining ? (
            <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 animate-pulse">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-700">
                  Bạn AI đang học bài... ⚙️
                </span>
                <span className="text-xs font-black text-indigo-800">
                  {trainingProgress}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-150"
                  style={{ width: `${trainingProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleTrain}
                disabled={!canTrain || (isTrained && !isModelOutdated)}
                className={`w-full font-extrabold py-3.5 px-6 rounded-2xl shadow-lg border-b-4 flex items-center justify-center gap-2 text-lg transition-all ${
                  canTrain && (!isTrained || isModelOutdated)
                    ? 'bg-emerald-500 hover:bg-emerald-600 border-emerald-700 text-white'
                    : 'bg-gray-300 border-gray-400 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Brain className="w-6 h-6" />
                <span>
                  {isModelOutdated && isTrained ? 'Cập nhật mô hình (Re-train) 🔄' : isTrained ? 'ĐÃ DẠY XONG ✅' : 'Dạy bạn AI học 🧠'}
                </span>
              </button>
              
              {isTrained && (
                <button
                  onClick={() => setShowFeedbackModal(true)}
                  className="w-full font-extrabold py-3 px-6 rounded-2xl shadow-md border-b-4 bg-indigo-100 hover:bg-indigo-200 border-indigo-300 text-indigo-700 flex items-center justify-center gap-2 text-base transition-all"
                >
                  <span className="text-xl">🚀</span>
                  <span>Hoàn thành & Nộp Bài</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER PANEL: Camera + Prediction ── */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        {/* Camera view */}
        <div className="bg-white rounded-3xl p-6 border-4 border-indigo-400 shadow-xl relative flex flex-col items-center">

          <DataCollector
            mode={mode}
            activeClassId={activeClass}
            activeClassLabel={classes.find((c) => c.id === activeClass)?.label || activeClass}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onSamplesCollected={(newSamples) => {
              setSamples((prev) => [...prev, ...newSamples]);
              setIsModelOutdated(true);
            }}
            onValidateSample={({ features, classId, detectionResults }) => {
              const activeClassLabel = classes.find((c) => c.id === classId)?.label || classId;

              if (isFaceMode) {
                // ── FACE: expression detection via face keypoints ──
                const faces = detectionResults as FaceMeshResult[];
                if (faces && faces.length > 0) {
                  const kps = getFaceKeypoints(faces[0]);
                  if (kps && kps.length >= 468) {
                    const validation = validateFaceExpression(kps, classId);
                    if (!validation.isValid) {
                      return {
                        isValid: false,
                        isQuestionable: true,
                        questionableReason: validation.suggestion,
                      };
                    }
                  }
                }
                return { isValid: true };
              }

              // ── HAND MODES: golden dataset + finger counting ──
              const hands = detectionResults as HandResult[];
              if (!hands || hands.length === 0 || !hands[0].keypoints || hands[0].keypoints.length < 21) {
                return { isValid: true };
              }
              const keypoints = hands[0].keypoints;

              // Pick golden dataset
              let goldenDataset: GoldenTestSample[] = [];
              if (mode === 'hand-1' || mode === 'hand-2') {
                goldenDataset = GOLDEN_TEST_DATASET;
              } else if (mode === 'gesture') {
                goldenDataset = GOLDEN_GESTURES_DATASET;
              }

              const goldenLabel = mode === 'gesture'
                ? classId
                : CLASS_TO_GOLDEN_LABEL[classId] || '';
              const goldenCurrentClass = goldenDataset.filter((g) => g.expectedLabel === goldenLabel);
              const goldenOtherClasses = goldenDataset.filter((g) => g.expectedLabel !== goldenLabel);
              const isDynamicClass = !CLASS_TO_GOLDEN_LABEL[classId];

              if (isDynamicClass && goldenDataset.length > 0) {
                // Negative golden check for dynamic classes
                let minDistToGolden = Infinity;
                let closestGoldenLabel = '';
                goldenDataset.forEach(g => {
                  let d = 0;
                  for (let i = 0; i < Math.min(features.length, g.features.length); i++) {
                    const diff = g.features[i] - features[i];
                    d += diff * diff;
                  }
                  const dist = Math.sqrt(d);
                  if (dist < minDistToGolden) { minDistToGolden = dist; closestGoldenLabel = g.expectedLabel; }
                });
                const flippedFeatures = features.map((v: number, i: number) => i % 2 === 0 ? -v : v);
                let minDistFlipped = Infinity;
                let closestFlippedLabel = '';
                goldenDataset.forEach(g => {
                  let d = 0;
                  for (let i = 0; i < Math.min(flippedFeatures.length, g.features.length); i++) {
                    const diff = g.features[i] - flippedFeatures[i];
                    d += diff * diff;
                  }
                  const dist = Math.sqrt(d);
                  if (dist < minDistFlipped) { minDistFlipped = dist; closestFlippedLabel = g.expectedLabel; }
                });
                const bestDist = Math.min(minDistToGolden, minDistFlipped);
                const bestLabel = minDistToGolden <= minDistFlipped ? closestGoldenLabel : closestFlippedLabel;
                if (bestDist < 0.35) {
                  return {
                    isValid: false,
                    isQuestionable: true,
                    questionableReason: `Cử chỉ này trông giống "${bestLabel}" quá! Hãy giơ đúng nhé 🖐️`,
                  };
                }
              } else if (goldenCurrentClass.length > 0 && goldenOtherClasses.length > 0) {
                // Fixed class: golden dataset distance check
                const minDistToCorrect = goldenCurrentClass.reduce((min, g) => {
                  let d = 0;
                  for (let i = 0; i < Math.min(features.length, g.features.length); i++) {
                    const diff = g.features[i] - features[i]; d += diff * diff;
                  }
                  return Math.min(min, Math.sqrt(d));
                }, Infinity);
                let minDistToWrong = Infinity;
                let closestWrongLabel = '';
                goldenOtherClasses.forEach((g) => {
                  let d = 0;
                  for (let i = 0; i < Math.min(features.length, g.features.length); i++) {
                    const diff = g.features[i] - features[i]; d += diff * diff;
                  }
                  const dist = Math.sqrt(d);
                  if (dist < minDistToWrong) {
                    minDistToWrong = dist;
                    if (mode === 'gesture') {
                      const cls = classes.find((c) => c.id === g.expectedLabel);
                      closestWrongLabel = cls?.label || g.expectedLabel;
                    } else {
                      closestWrongLabel = g.expectedLabel;
                    }
                  }
                });
                const distThreshold = mode === 'gesture' ? 0.7 : 0.9;
                if (minDistToWrong < minDistToCorrect * distThreshold) {
                  return {
                    isValid: false,
                    isQuestionable: true,
                    questionableReason: `Cử chỉ này trông giống "${closestWrongLabel}" hơn! Hãy thử lại nhé? 🤔`,
                  };
                }
              }

              // Finger counting check
              const expectedFingers = getExpectedFingerCount(classId, mode, activeClassLabel);
              if (expectedFingers > 0) {
                const detectedFingers = countExtendedFingers(keypoints);
                if (detectedFingers >= 0) {
                  let isFingerCountOk: boolean;
                  if (expectedFingers === 5) {
                    isFingerCountOk = detectedFingers >= 4 && isThumbExtended(keypoints);
                  } else if (expectedFingers === 4) {
                    isFingerCountOk = detectedFingers === 4 && !isThumbExtended(keypoints);
                  } else {
                    isFingerCountOk = detectedFingers === expectedFingers;
                  }
                  if (!isFingerCountOk) {
                    return {
                      isValid: false,
                      isQuestionable: true,
                      questionableReason: `Đang giơ không đúng số ngón! Cần giơ đúng ${expectedFingers} ngón 🖐️`,
                    };
                  }
                }
              }

              return { isValid: true };
            }}
            videoRef={videoRef}
          >
            <CameraView
              videoRef={videoRef}
              canvasRef={canvasRef}
              modelStatus={modelStatus}
              cameraError={cameraError}
              loadingText={loadingText}
              theme="blue"
              onRetry={retryCamera}
            />
          </DataCollector>
        </div>

        {/* Prediction result */}
        <div className="bg-gradient-to-r from-indigo-900 to-purple-900 text-white rounded-3xl p-4 shadow-xl border-4 border-purple-400">
          <h4 className="font-extrabold text-[11px] text-purple-300 tracking-widest uppercase mb-1">
            Kết quả dự đoán của AI:
          </h4>

          {samples.length > 0 ? (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-purple-300">
                AI đoán bé đang làm:
              </span>
              <span className="text-xl font-black text-yellow-300">
                {predictedLabel}
              </span>
            </div>
          ) : (
            <div className="text-center py-2 text-purple-200 font-bold mb-3">
              AI chưa có dữ liệu.{' '}
              Bé hãy thu thập mẫu để AI bắt đầu đoán nhé! 🤖✨
            </div>
          )}

          {/* AI Settings Sliders */}
          <div className="bg-white/10 rounded-2xl p-3 border border-white/20 flex flex-col gap-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-purple-200">
                  K hàng xóm (Số ảnh so sánh): {kValue}
                </label>
              </div>
              <input
                type="range"
                min="1"
                max="7"
                step="2"
                value={kValue}
                onChange={(e) => setKValue(Number(e.target.value))}
                className="w-full accent-indigo-400"
              />
              <p className="text-[10px] text-purple-300 mt-1 italic">
                Xem trên biểu đồ → K đường nét đứt nối đến K ảnh gần nhất.
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-purple-200">
                  Độ khắt khe (Sự đồng thuận): {Math.min(threshold, kValue)} / {kValue}
                </label>
              </div>
              <input
                type="range"
                min="1"
                max={kValue}
                step="1"
                value={Math.min(threshold, kValue)}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full accent-pink-400"
              />
              <p className="text-[10px] text-purple-300 mt-1 italic">
                Nếu không đủ đồng thuận → biểu đồ hiện dấu &quot;?&quot;.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL: KNN Scatter Plot (Always visible on desktop) ── */}
      {/* ── RIGHT PANEL: KNN Scatter Plot + Energy Bars ── */}
      <div className="hidden lg:col-span-4 lg:flex flex-col gap-4">
        <div className="bg-white rounded-3xl p-4 border-4 border-indigo-400 shadow-[0_20px_50px_rgba(79,70,229,0.2)] flex flex-col h-[600px]">
          <h4 className="font-extrabold text-sm text-indigo-900 tracking-widest uppercase mb-2 text-center flex items-center justify-center gap-2">
            <span>📊</span> Không gian phân loại kNN
          </h4>
          <div className="flex-1 min-h-0 relative bg-slate-50 rounded-2xl overflow-hidden border-2 border-slate-100">
            <KnnScatterPlot
              samples={samples}
              classes={classes}
              kValue={kValue}
              threshold={threshold}
              kNearestIds={kNearestIds}
              predictedLabel={predictedLabel !== 'Chưa nhận diện... 🤔' && predictedLabel !== 'Chưa rõ ràng... 🤔' ? predictedLabel : undefined}
              voteCounts={voteCounts}
            />
          </div>
        </div>

        {/* Energy Bars Component (Only show if trained) */}
        {isTrained && (
          <AIConfidenceEnergyBars 
            classes={classes} 
            confidences={nnConfidences} 
            isAnomaly={isAnomaly}
            isMissingData={isMissingData}
            anomalyMessage={anomalyMessage}
            isPhaseB={datasetQuality?.isDatasetPerfect}
            teacherHintImages={teacherHintImages}
            classCounts={classes.reduce((acc, c) => {
              acc[c.id] = getClassSampleCount(c.id);
              return acc;
            }, {} as Record<string, number>)}
          />
        )}
      </div>
      
      <AIFeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onProceed={(issueCount: number) => {
          setShowFeedbackModal(false);
          // Score = (valid samples - issues) / valid samples
          // issueCount comes directly from AIFeedbackModal's cross-check
          // so the score matches exactly what the student sees in the popup.
          const validCount = samples.filter(s => s.isValid !== false).length;
          const correctCount = Math.max(0, validCount - issueCount);
          const accuracyScore = validCount > 0 ? (correctCount / validCount) * 100 : 0;
          
          onTrainComplete(samples, async () => {
            return trainerRef.current ? trainerRef.current.saveToBlobs() : null;
          }, accuracyScore);
        }}
        studentSamples={samples}
        teacherTemplate={teacherTemplate}
        kValue={kValue}
        threshold={threshold}
        classes={classes}
        onDeleteSample={deleteSample}
      />
    </div>
  );
}
