'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Edge,
  Node,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Import our custom nodes
import CameraNode from './CameraNode';
import DatasetNode from './DatasetNode';
import BrainNode from './BrainNode';
import OutputNode from './OutputNode';

// Import logic hooks from the old TeachPanel (we'll just mock or duplicate the essential imports for this skeleton)
import { useCamera } from '@/hooks/useCamera';
import { useMl5Handpose } from '@/hooks/useMl5Handpose';
import { useMl5FaceMesh } from '@/hooks/useMl5FaceMesh';
import { drawHandSkeleton } from '@/lib/hand-drawing';
import { getFaceKeypoints, drawFaceSkeleton } from '@/lib/face-drawing';
import { normalizeHandKeypoints, normalizeFaceFeatures, StoredSample } from '@/lib/knn-classifier';
import { TfTrainer } from '@/lib/tf-trainer';
import { assessQuality } from '@/lib/image-quality';
import { playClickSound, playSuccessSound } from '@/lib/audio';

const nodeTypes = {
  camera: CameraNode,
  dataset: DatasetNode,
  brain: BrainNode,
  output: OutputNode,
};

interface TeachFlowPanelProps {
  mode: 'hand-1' | 'hand-2' | 'gesture' | 'emotion';
  classes: { id: string; label: string; emoji: string }[];
  minSamplesPerClass?: number;
  onTrainComplete: (samples: StoredSample[]) => void;
  initialDataset?: StoredSample[];
}

export default function TeachFlowPanelWrapper(props: TeachFlowPanelProps) {
  return (
    <div style={{ width: '100%', height: '80vh' }} className="bg-slate-50 rounded-3xl overflow-hidden border-4 border-slate-200">
      <ReactFlowProvider>
        <TeachFlowPanel {...props} />
      </ReactFlowProvider>
    </div>
  );
}

function TeachFlowPanel({ mode, classes, minSamplesPerClass = 3, onTrainComplete, initialDataset }: TeachFlowPanelProps) {
  // 1. Core State
  const [samples, setSamples] = useState<StoredSample[]>(initialDataset || []);
  const [activeClass, setActiveClass] = useState(classes[0]?.id);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [isTrained, setIsTrained] = useState(false);
  const [predictedLabel, setPredictedLabel] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);

  // Gamification stats
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [currentLoss, setCurrentLoss] = useState<number | undefined>(undefined);
  const [currentAcc, setCurrentAcc] = useState<number | undefined>(undefined);

  // Refs
  const trainerRef = useRef<TfTrainer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Camera & ML
  const { videoRef, cameraActive } = useCamera({
    width: 320,
    height: 240,
    facingMode: 'user',
  });
  
  const isFaceMode = mode === 'emotion';
  const handpose = useMl5Handpose(videoRef, cameraActive && !isFaceMode, { maxHands: 1 });
  const facemesh = useMl5FaceMesh(videoRef, cameraActive && isFaceMode, { maxFaces: 1 });

  const modelStatus = isFaceMode ? facemesh.modelStatus : handpose.modelStatus;

  // 2. Actions
  const getClassSampleCount = useCallback((clsId: string) => samples.filter((s) => s.sourceId === clsId).length, [samples]);
  
  const canTrain = classes.every((cls) => getClassSampleCount(cls.id) >= minSamplesPerClass);

  const clearClassSamples = (clsId: string) => {
    setSamples(prev => prev.filter(s => s.sourceId !== clsId));
    setIsTrained(false);
  };

  const startCapturing = () => { setIsCapturing(true); playClickSound(); };
  const stopCapturing = () => setIsCapturing(false);

  const trainModel = async () => {
    if (!canTrain || samples.length === 0) return;
    setIsTraining(true);
    playClickSound();

    if (!trainerRef.current) trainerRef.current = new TfTrainer();

    try {
      await trainerRef.current.train(samples, (epoch, progress, loss, acc) => {
        setCurrentEpoch(epoch);
        setCurrentLoss(loss);
        setCurrentAcc(acc);
      });
      setIsTrained(true);
      playSuccessSound();
      onTrainComplete(samples);
    } catch (e) {
      console.error(e);
      alert('Lỗi huấn luyện AI!');
    } finally {
      setIsTraining(false);
    }
  };

  // 3. Drawing loop
  useEffect(() => {
    if (modelStatus !== 'ready') return;
    
    let rafId: number;
    let lastCaptureTime = 0;

    const draw = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let currentFeatures: number[] | null = null;
      let rawKeypoints: any = null;

      // Draw and extract based on mode
      if (isFaceMode) {
        const faces = facemesh.allFacesRef.current;
        if (faces && faces.length > 0) {
          rawKeypoints = faces[0];
          const kps = getFaceKeypoints(rawKeypoints);
          if (kps) {
            drawFaceSkeleton(ctx, kps, video.videoWidth, video.videoHeight, canvas.width, canvas.height);
            currentFeatures = normalizeFaceFeatures(kps);
          }
        }
      } else {
        const hands = handpose.handsRef.current;
        if (hands && hands.length > 0) {
          rawKeypoints = hands[0].keypoints;
          drawHandSkeleton(ctx, rawKeypoints, video.videoWidth, video.videoHeight, canvas.width, canvas.height, { jointRadius: 5 });
          currentFeatures = normalizeHandKeypoints(rawKeypoints);
        }
      }

      // Capture logic
      if (isCapturing && currentFeatures && rawKeypoints) {
        const now = Date.now();
        if (now - lastCaptureTime > 150) { // Throttle capture
           // Simplified capture logic for skeleton
           const quality = assessQuality(canvas, { x: 0, y: 0, w: canvas.width, h: canvas.height });
           if (!quality.isBlurry && !quality.isDark) {
             const classDef = classes.find((c) => c.id === activeClass);
             if (classDef) {
               setSamples(prev => [...prev, {
                 id: Math.random().toString(36).slice(2),
                 sourceId: activeClass,
                 label: classDef.label,
                 features: currentFeatures!,
                 thumbnail: '', // Need to grab thumbnail, simplified here
                 quality
               }]);
               playClickSound();
               lastCaptureTime = now;
             }
           }
        }
      }

      rafId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafId);
  }, [modelStatus, isCapturing, activeClass, classes]);

  // 4. Live Prediction Loop
  useEffect(() => {
    if (!isTrained || isTraining || !trainerRef.current) return;
    let rafId: number;

    const predict = async () => {
       // Similar to draw loop, extract features and call predict
       let currentFeatures: number[] | null = null;
       if (isFaceMode) {
         const faces = facemesh.allFacesRef.current;
         if (faces && faces.length > 0) {
           const kps = getFaceKeypoints(faces[0]);
           if (kps) currentFeatures = normalizeFaceFeatures(kps);
         }
       } else {
         const hands = handpose.handsRef.current;
         if (hands && hands.length > 0) {
           currentFeatures = normalizeHandKeypoints(hands[0]?.keypoints || []);
         }
       }

       if (currentFeatures && trainerRef.current) {
         const res = await trainerRef.current.predict(currentFeatures);
         setPredictedLabel(res.label);
         setConfidence(res.confidence);
       } else {
         setPredictedLabel(null);
       }
       rafId = requestAnimationFrame(predict);
    };

    predict();
    return () => cancelAnimationFrame(rafId);
  }, [isTrained, isTraining]);

  // 5. Build ReactFlow Nodes
  const initialNodes: Node[] = useMemo(() => [
    {
      id: 'camera',
      type: 'camera',
      position: { x: 50, y: 150 },
      data: { videoRef, canvasRef },
    },
    {
      id: 'dataset',
      type: 'dataset',
      position: { x: 450, y: 100 },
      data: { 
        classes, activeClass, setActiveClass, getClassSampleCount, 
        isCapturing, startCapturing, stopCapturing, clearClassSamples, modelStatus 
      },
    },
    {
      id: 'brain',
      type: 'brain',
      position: { x: 900, y: 100 },
      data: { 
        isTraining, isTrained, canTrain, trainModel,
        currentEpoch, currentLoss, currentAcc
      },
    },
    {
      id: 'output',
      type: 'output',
      position: { x: 1350, y: 150 },
      data: { isTrained, predictedLabel, confidence },
    },
  ], [
    classes, activeClass, isCapturing, modelStatus,
    isTraining, isTrained, canTrain,
    currentEpoch, currentLoss, currentAcc,
    predictedLabel, confidence
  ]);

  const initialEdges: Edge[] = useMemo(() => [
    { id: 'e1-2', source: 'camera', target: 'dataset', animated: isCapturing, style: { strokeWidth: 4, stroke: '#10b981' } },
    { id: 'e2-3', source: 'dataset', target: 'brain', animated: isTraining, style: { strokeWidth: 4, stroke: '#f59e0b' } },
    { id: 'e3-4', source: 'brain', target: 'output', animated: isTrained && predictedLabel !== null, style: { strokeWidth: 4, stroke: '#6366f1' } },
  ], [isCapturing, isTraining, isTrained, predictedLabel]);

  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  // Sync state changes to nodes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      className="bg-slate-50"
    >
      <Background color="#cbd5e1" gap={20} size={2} />
      <Controls />
    </ReactFlow>
  );
}
