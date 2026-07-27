'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Brain, Camera, Trash2 } from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { useMl5Handpose } from '@/hooks/useMl5Handpose';
import { useMl5FaceMesh } from '@/hooks/useMl5FaceMesh';
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
  classes: { id: string; label: string; emoji: string }[];
  minSamplesPerClass?: number;
  maxVisibleSkeletons?: number;
  onTrainComplete: (samples: StoredSample[]) => void;
  teacherTemplate?: any;
}

// ──────────────────────────────────────────────
// Finger counting heuristic (reused from teach/page.tsx)
// ──────────────────────────────────────────────
function countExtendedFingers(keypoints: HandKeypoint[]): number {
  if (!keypoints || keypoints.length < 21) return -1;

  const wrist = keypoints[0];
  let count = 0;
  
  const dist2D = (p1: HandKeypoint, p2: HandKeypoint) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

  // Thumb: compare TIP(4) vs IP(3) using 2D distance
  const thumbTip = keypoints[4];
  const thumbIP = keypoints[3];
  const thumbMCP = keypoints[2];
  
  const thumbDistTip = dist2D(thumbTip, wrist);
  const thumbDistIP = dist2D(thumbIP, wrist);
  const thumbDistMCP = dist2D(thumbMCP, wrist);
  
  if (thumbDistTip > thumbDistIP && thumbDistIP > thumbDistMCP * 1.1) {
    count++;
  }

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
): number {
  if (mode !== 'hand-1' && mode !== 'hand-2') return -1;
  if (classId === 'class_1' || classId === 'class_3') return 1;
  if (classId === 'class_2' || classId === 'class_4') return 2;
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
}: TeachPanelProps) {
  const isHandMode = mode === 'hand-1' || mode === 'hand-2' || mode === 'gesture';
  const isFaceMode = mode === 'emotion';
  const isTwoHandMode = mode === 'hand-2';

  // ── State ───────────────────────────
  const [samples, setSamples] = useState<StoredSample[]>([]);
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
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'video'>('camera');

  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const trainerRef = useRef<TfTrainer | null>(null);
  useEffect(() => {
    trainerRef.current = new TfTrainer();
  }, []);

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

  // ── Thumbnail helper ────────────────
  const getVideoThumbAndCanvas = useCallback((hands?: any[], faces?: any[]) => {
    const cv = document.createElement('canvas');
    cv.width = 240;
    cv.height = 240;
    const ctx = cv.getContext('2d');
    
    const rawCv = document.createElement('canvas');
    rawCv.width = 240;
    rawCv.height = 240;
    const rawCtx = rawCv.getContext('2d');
    
    let rawThumbnail = '';
    if (ctx && rawCtx && videoRef.current) {
      rawCtx.drawImage(videoRef.current, 0, 0, 240, 240);
      ctx.drawImage(rawCv, 0, 0); // copy raw to cv
      rawThumbnail = rawCv.toDataURL('image/jpeg', 0.8);
      
      if (hands && hands.length > 0) {
        hands.forEach((hand, idx) => {
          if (hand.keypoints && hand.keypoints.length >= 21) {
            drawHandSkeleton(ctx, hand.keypoints, videoRef.current!.videoWidth || 640, videoRef.current!.videoHeight || 480, 240, 240, {
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
            drawFaceSkeleton(ctx, kps, videoRef.current!.videoWidth || 640, videoRef.current!.videoHeight || 480, 240, 240);
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
      return samples.filter(
        (s) =>
          s.sourceId === classId ||
          (s.label === classLabel && !s.sourceId),
      ).length;
    },
    [samples, classes],
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
      const quality = assessQuality(canvas);

      setSamples((prev) => {
        let msg = '';
        if (!validation.isValid) {
          msg = validation.suggestion;
        } else if (quality.isBlurry) {
          msg = 'Ảnh hơi mờ! Bé cố gắng giữ chắc tay nhé 🔍';
        } else if (quality.isDark) {
          msg = 'Ảnh hơi tối! Bé tìm chỗ sáng hơn xíu nha 🌑';
        }

        if (msg) {
          if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
          setValidationToast(`⚠️ ${msg}`);
          toastTimeoutRef.current = setTimeout(
            () => setValidationToast(null),
            4000,
          );
        }

        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            label: activeClassLabel,
            features,
            sourceId: activeClass,
            thumbnail,
            rawThumbnail,
            isValid: validation.isValid,
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
      const expectedFingers = getExpectedFingerCount(activeClass, mode);

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
        let rejectedAny = false;
        let rejectionMsg = '';

        const processHand = (handIndex: number) => {
          if (
            !hands[handIndex] ||
            !hands[handIndex].keypoints ||
            hands[handIndex].keypoints!.length < 21
          )
            return;

          const keypoints = hands[handIndex].keypoints!;
          const roi = calculateROI(keypoints as any, rawCanvas.width, rawCanvas.height, 0.1);
          const quality = assessQuality(rawCanvas, roi);

          const features = normalizeHandKeypoints(keypoints);
          let isValid = true;
          
          // Ưu tiên 1: Nếu ảnh mờ/tối, bỏ qua việc kiểm tra xương (tránh ảo giác)
          if (quality.isBlurry || quality.isDark) {
            rejectedAny = true;
            rejectionMsg = quality.isBlurry 
              ? 'Ảnh hơi mờ! Bé cố gắng giữ chắc tay nhé 🔍' 
              : 'Ảnh hơi tối! Bé tìm chỗ sáng hơn xíu nha 🌑';
          } else {
            // Validation 1: Finger counting (hand-1 / hand-2 only)
            if (
              (mode === 'hand-1' || mode === 'hand-2') &&
              expectedFingers > 0
            ) {
              const detected = countExtendedFingers(hands[handIndex].keypoints!);
              if (detected >= 0 && Math.abs(detected - expectedFingers) > 1) {
                isValid = false;
                rejectedAny = true;
                rejectionMsg = `Bé đang giơ ${detected} ngón, nhưng cần ${expectedFingers} ngón! 🖐️`;
              }
            }

            // Validation 2: Golden dataset distance
            if (
              isValid &&
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

              const threshold = mode === 'gesture' ? 0.7 : 0.9;
              if (minDistToWrong < minDistToCorrect * threshold) {
                isValid = false;
                rejectedAny = true;
                rejectionMsg = `Cử chỉ này trông giống "${closestWrongLabel}" hơn! Bé thử lại nhé? 🤔`;
              }
            }
          }

          newSamples.push({
            id: crypto.randomUUID(),
            label: isTwoHandMode ? knnLabel : activeClassLabel,
            features,
            sourceId: activeClass,
            thumbnail,
            rawThumbnail,
            isValid,
            quality,
          });
        };

        processHand(0);
        if (isTwoHandMode) processHand(1);

        if (rejectedAny && rejectionMsg) {
          if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
          setValidationToast(`⚠️ ${rejectionMsg}`);
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
        await trainerRef.current.train(samples, (epoch, progress) => {
          setTrainingProgress(progress);
        });
        // progress reaches 100 here, which will trigger the useEffect below
      }
    } catch (err) {
      console.error('Training failed', err);
      setIsTraining(false);
      alert('Lỗi huấn luyện mô hình. Vui lòng thử lại.');
    }
  }, [canTrain, samples]);

  // Handle train completion & re-evaluation
  useEffect(() => {
    if (isTraining && trainingProgress >= 100) {
      setIsTraining(false);
      setIsTrained(true);
      playSuccessSound();
      
      // Perform initial evaluation immediately
      const targetDataset = (teacherTemplate?.samples?.length > 0) ? teacherTemplate.samples : samples;
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
    }
  }, [isTraining, trainingProgress, classes, kValue, threshold, teacherTemplate, samples, onTrainComplete]);

  // Re-evaluate when K or threshold changes
  useEffect(() => {
    if (isTrained && !isTraining) {
      setSamples(prevSamples => {
        let hasChanges = false;
        const targetDataset = (teacherTemplate?.samples?.length > 0) ? teacherTemplate.samples : prevSamples;
        
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
    }
  }, [kValue, threshold, isTrained, isTraining]);

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
              setPredictedLabel(classes.find(c => c.id === resultNN.label)?.label || 'Chưa rõ ràng... 🤔');
            }
            if (resultNN && resultNN.confidences) {
              setNnConfidences(resultNN.confidences);
            }

            if (resultKNN.minDistance > 3.5 || resultNN.confidence < 50) {
              setPredictedLabel('Khác thường... 👽');
              setKNearestIds([]);
              setVoteCounts({});
            } else {
              setKNearestIds(resultKNN.kNearestIds);
              setVoteCounts(resultKNN.voteCounts);
            }
          }
        } else {
          setPredictedLabel('AI đang đợi khuôn mặt bé... 👀');
          setNnConfidences(null);
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
            let bestConf = pred1NN?.confidences?.[pred1NN.label] || 0;
            const conf2 = pred2NN?.confidences?.[pred2NN.label] || 0;
            if (conf2 > bestConf) {
              bestPred = pred2NN;
            }

            if (bestPred && bestPred.label) {
              setPredictedLabel(classes.find(c => c.id === bestPred.label)?.label || 'Chưa rõ ràng... 🤔');
            }
            if (bestPred && bestPred.confidences) {
              setNnConfidences(bestPred.confidences);
            }
            
            const isAnomaly1 = pred1KNN.minDistance > 0.7;
            const isAnomaly2 = pred2KNN.minDistance > 0.7;

            if (isAnomaly1 && isAnomaly2) {
              setPredictedLabel('Khác thường... 👽');
              setKNearestIds([]);
              setVoteCounts({});
            } else if (isAnomaly1) {
              if (pred2NN.confidence < 50) setPredictedLabel('Chưa rõ ràng... 🤔');
              else setPredictedLabel(`Tay 2: ${pred2NN.label}`);
              
              setKNearestIds(pred2KNN.kNearestIds);
              setVoteCounts(pred2KNN.voteCounts);
            } else if (isAnomaly2) {
              if (pred1NN.confidence < 50) setPredictedLabel('Chưa rõ ràng... 🤔');
              else setPredictedLabel(`Tay 1: ${pred1NN.label}`);
              
              setKNearestIds(pred1KNN.kNearestIds);
              setVoteCounts(pred1KNN.voteCounts);
            } else {
              const avgConf = Math.round((pred1NN.confidence + pred2NN.confidence) / 2);

              if (avgConf < 50) {
                setPredictedLabel('Chưa rõ ràng... 🤔');
              } else if (pred1NN.label === pred2NN.label) {
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
              
              if (resultNN && resultNN.label) {
                setPredictedLabel(classes.find(c => c.id === resultNN.label)?.label || 'Chưa rõ ràng... 🤔');
              }
              if (resultNN && resultNN.confidences) {
                setNnConfidences(resultNN.confidences);
              }
              
              if (resultKNN.minDistance > 0.7 || resultNN.confidence < 50) {
                setPredictedLabel('Khác thường... 👽');
                setKNearestIds([]);
                setVoteCounts({});
              } else {
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
          setKNearestIds([]);
          setVoteCounts({});
        }
      }

      rafId = requestAnimationFrame(runPrediction);
    };

    runPrediction();
    return () => cancelAnimationFrame(rafId);
  }, [isTrained, modelStatus, isFaceMode, isTwoHandMode, samples, allFacesRef, handsRef]);

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
      <div className="lg:col-span-3 bg-white rounded-3xl p-5 border-4 border-indigo-400 shadow-xl flex flex-col">
        <div className="text-xs font-black text-indigo-600 tracking-wider mb-2 uppercase">
          Lớp học AI của bé 🧑‍🏫
        </div>

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
          <div className="mt-3 p-3 bg-red-100 border-2 border-red-400 rounded-2xl text-sm font-bold text-red-700 flex items-center gap-2 animate-bounce shadow-lg">
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
            mode={mode as any}
            activeClassId={activeClass}
            activeClassLabel={classes.find((c) => c.id === activeClass)?.label || activeClass}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onSamplesCollected={(newSamples) => {
              setSamples((prev) => [...prev, ...newSamples]);
              setIsModelOutdated(true);
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
                Nếu không đủ đồng thuận → biểu đồ hiện dấu "?".
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
          <AIConfidenceEnergyBars classes={classes} confidences={nnConfidences} />
        )}
      </div>
      
      <AIFeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onProceed={() => {
          setShowFeedbackModal(false);
          onTrainComplete(samples);
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
