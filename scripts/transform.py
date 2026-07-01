import os

def main():
    with open('client/src/app/(private)/challenge/teach-gestures/page.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Imports
    content = content.replace('useMl5Handpose', 'useMl5FaceMesh')
    content = content.replace('import { drawHandSkeleton } from \'@/lib/hand-drawing\';', 'import { drawFaceStickers, getFaceKeypoints } from \'@/lib/face-drawing\';')
    content = content.replace('normalizeHandKeypoints', 'normalizeFaceFeatures')
    content = content.replace('GOLDEN_GESTURES_DATASET', 'GOLDEN_FACE_DATASET')
    content = content.replace('golden-gestures-dataset', 'golden-face-dataset')
    content = content.replace('TeachGesturesPage', 'TeachFacePage')

    # Classes
    old_classes = '''const CLASSES = [
  { id: 'class_1', label: 'class_1', voicePrompt: 'Hãy dạy bạn A I nhận biết cử chỉ Thích nhé!' },
  { id: 'class_2', label: 'class_2', voicePrompt: 'Hãy dạy bạn A I nhận biết cử chỉ Quyết tâm nào!' },
  { id: 'class_3', label: 'class_3', voicePrompt: 'Hãy dạy bạn A I nhận biết cử chỉ Chiến thắng nhé!' },
  { id: 'class_4', label: 'class_4', voicePrompt: 'Hãy dạy bạn A I nhận biết cử chỉ Chào bạn nhé!' },
];'''

    new_classes = '''const CLASSES = [
  { id: 'class_1', label: 'Vui vẻ (Happy) 😀', voicePrompt: 'Hãy dạy bạn A I nhận biết nét mặt vui vẻ nhé!' },
  { id: 'class_2', label: 'Buồn bã (Sad) 😢', voicePrompt: 'Hãy dạy bạn A I nhận biết nét mặt buồn bã nào!' },
  { id: 'class_3', label: 'Ngạc nhiên (Surprised) 😲', voicePrompt: 'Hãy dạy bạn A I nhận biết nét mặt ngạc nhiên nhé!' },
];'''
    content = content.replace(old_classes, new_classes)

    # Hook and Capture Logic
    content = content.replace('''  const { handsRef, modelStatus } = useMl5FaceMesh(videoRef, cameraActive, {
    maxHands: 2,
  });''', '''  const { allFacesRef: handsRef, modelStatus } = useMl5FaceMesh(videoRef, cameraActive, {
    maxFaces: 1,
  });''')

    content = content.replace('''  const captureSample = () => {
    const hands = handsRef.current;
    if (!hands || hands.length === 0) {
      speakVietnamese('Bạn A I chưa nhìn thấy khuôn mặt nào trước camera cả!');
      return;
    }
    
    const isTwoHandClass = false; // Gestures challenge uses 1 hand or detects whatever hand is there. But let's just train on hand 0 for simplicity. Actually, we can just allow training on both hands if they are on screen.
    if (isTwoHandClass && hands.length < 2) {
      speakVietnamese('Với dáng tay này, bé cần đưa cả hai khuôn mặt vào màn hình nhé!');
      return;
    }

    playClickSound();
    
    const activeClassLabel = activeClass;
    let knnLabel = activeClassLabel;

    const newSamples: StoredSample[] = [];

    // First hand
    if (hands[0] && hands[0].keypoints && hands[0].keypoints.length >= 21) {
      newSamples.push({
        label: knnLabel,
        features: normalizeFaceFeatures(hands[0].keypoints),
        sourceId: activeClass,
      });
    }

    // Second hand (Gestures doesn't require 2 hands, but if both are present, learn from both)
    if (hands[1] && hands[1].keypoints && hands[1].keypoints.length >= 21) {
      newSamples.push({
        label: knnLabel,
        features: normalizeFaceFeatures(hands[1].keypoints),
        sourceId: activeClass,
      });
    }

    if (newSamples.length > 0) {
      setSamples(prev => [...prev, ...newSamples]);
      speakVietnamese(`Đã thêm mẫu hình cho ${activeClassLabel}`);
    }
  };''', '''  const captureSample = () => {
    const faces = handsRef.current;
    if (!faces || faces.length === 0) {
      speakVietnamese('Bạn A I chưa nhìn thấy khuôn mặt nào trước camera cả!');
      return;
    }

    playClickSound();
    
    const activeClassLabel = activeClass;
    const newSamples = [];

    const face = faces[0];
    const kps = getFaceKeypoints(face);
    if (kps && kps.length >= 468) {
      newSamples.push({
        label: activeClassLabel,
        features: normalizeFaceFeatures(kps),
        sourceId: activeClass,
      });
    }

    if (newSamples.length > 0) {
      setSamples(prev => [...prev, ...newSamples]);
      speakVietnamese(`Đã thêm mẫu hình cho ${activeClassLabel}`);
    }
  };''')

    # Mock Training condition
    content = content.replace('''    const c1 = samples.filter(s => s.sourceId === 'class_1' || (s.label === CLASSES[0].label && !s.sourceId)).length;
    const c2 = samples.filter(s => s.sourceId === 'class_2' || (s.label === CLASSES[1].label && !s.sourceId)).length;
    const c3 = samples.filter(s => s.sourceId === 'class_3').length;
    const c4 = samples.filter(s => s.sourceId === 'class_4').length;

    if (c1 < 3 || c2 < 3 || c3 < 6 || c4 < 6) { // c3/c4 need 6 samples (3 captures x 2 hands)
      speakVietnamese('Bé chưa chụp đủ 3 ảnh mẫu cho mỗi nhóm rồi! Bé hãy chụp thêm hình mẫu nhé!');
      return;
    }''', '''    const c1 = samples.filter(s => s.sourceId === 'class_1' || (s.label === CLASSES[0].label && !s.sourceId)).length;
    const c2 = samples.filter(s => s.sourceId === 'class_2' || (s.label === CLASSES[1].label && !s.sourceId)).length;
    const c3 = samples.filter(s => s.sourceId === 'class_3' || (s.label === CLASSES[2].label && !s.sourceId)).length;

    if (c1 < 3 || c2 < 3 || c3 < 3) {
      speakVietnamese('Bé chưa chụp đủ 3 ảnh mẫu cho mỗi nhóm rồi! Bé hãy chụp thêm hình mẫu nhé!');
      return;
    }''')

    # Prediction Loop
    content = content.replace('''    const runPrediction = () => {
      const hands = handsRef.current;
      
      if (hands && hands.length > 0) {
        if (hands.length === 2) {
          // Dual Hand Prediction logic: classify both hands and count total fingers
          const hand1 = hands[0];
          const hand2 = hands[1];
          const f1 = normalizeFaceFeatures(hand1?.keypoints || []);
          const f2 = normalizeFaceFeatures(hand2?.keypoints || []);

          const pred1 = classifyKNN(f1, samples, 3);
          const pred2 = classifyKNN(f2, samples, 3);

          const isHand1One = pred1.label.includes('1');
          const isHand2One = pred2.label.includes('1');
          
          let totalFingers = 0;
          totalFingers += isHand1One ? 1 : 2;
          totalFingers += isHand2One ? 1 : 2;

          setPredictedLabel(`2 Bàn Tay 👐 (Tay 1: ${isHand1One ? '1 ngón' : '2 ngón'}, Tay 2: ${isHand2One ? '1 ngón' : '2 ngón'} | Tổng: ${totalFingers} ngón)`);
          setConfidence(Math.round((pred1.confidence + pred2.confidence) / 2));
        } else {
          // Single Hand Prediction
          const hand = hands[0];
          const kps = hand.keypoints;
          if (kps && kps.length >= 21) {
            const features = normalizeFaceFeatures(kps);
            const result = classifyKNN(features, samples, 3);
            setPredictedLabel(result.label);
            setConfidence(result.confidence);
          }
        }
      } else {
        setPredictedLabel('AI đang đợi khuôn mặt bé... 👀');
        setConfidence(0);
      }

      rafId = requestAnimationFrame(runPrediction);
    };''', '''    const runPrediction = () => {
      const faces = handsRef.current;
      
      if (faces && faces.length > 0) {
        const face = faces[0];
        const kps = getFaceKeypoints(face);
        if (kps && kps.length >= 468) {
          const features = normalizeFaceFeatures(kps);
          const result = classifyKNN(features, samples, 3);
          setPredictedLabel(result.label);
          setConfidence(result.confidence);
        }
      } else {
        setPredictedLabel('AI đang đợi khuôn mặt bé... 👀');
        setConfidence(0);
      }

      rafId = requestAnimationFrame(runPrediction);
    };''')

    # Text changes
    content = content.replace('Dạy AI học Cử chỉ (Gestures)', 'Dạy AI học Cảm xúc (Face)')
    content = content.replace('các cử chỉ', 'các cảm xúc')
    content = content.replace('cử chỉ', 'cảm xúc')
    content = content.replace('bàn tay', 'khuôn mặt')
    content = content.replace('tay bé', 'khuôn mặt bé')
    content = content.replace("saveProgress('teach-gestures'", "saveProgress('teach-face'")

    # Canvas Drawing
    content = content.replace('''          if (handsRef.current && handsRef.current.length > 0) {
            handsRef.current.forEach(hand => {
              drawHandSkeleton(ctx, hand.keypoints);
            });
          }''', '''          if (handsRef.current && handsRef.current.length > 0) {
            handsRef.current.forEach(face => {
              drawFaceStickers(ctx, face, { oval: '#f472b6', eye: '#818cf8', lips: '#fb923c', nose: '#34d399', dot: 'rgba(244,114,182,0.55)' });
            });
          }''')

    # Bug in original teach gestures replacement logic
    content = content.replace('''                const c1 = getCount(CLASSES[0].id, CLASSES[0].label);
                const c2 = getCount(CLASSES[1].id, CLASSES[1].label);
                const c3 = getCount(CLASSES[2].id, CLASSES[2].label);
                const c4 = getCount(CLASSES[3].id, CLASSES[3].label);
                const isReady = c1 >= 3 && c2 >= 3 && c3 >= 3 && c4 >= 3;

                if (!isReady) {
                  return (
                    <div className=\"bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl p-4 text-xs font-bold mb-6 flex flex-col gap-1.5 shadow-inner\">
                      <span className=\"text-red-800 text-sm font-extrabold block\">⚠️ Yêu cầu dữ liệu:</span>
                      <span>Bé cần chụp ít nhất 3 ảnh cho mỗi nhóm để AI có thể học tốt nhé:</span>
                      <ul className=\"list-disc pl-4 space-y-1\">
                        {c1 < 3 && <li>Nhóm \"{CLASSES[0].label}\": thiếu {3 - c1} ảnh mẫu.</li>}
                        {c2 < 3 && <li>Nhóm \"{CLASSES[1].label}\": thiếu {3 - c2} ảnh mẫu.</li>}
                        {c3 < 3 && <li>Nhóm \"{CLASSES[2].label}\": thiếu {3 - c3} ảnh mẫu.</li>}
                        {c4 < 3 && <li>Nhóm \"{CLASSES[3].label}\": thiếu {3 - c4} ảnh mẫu.</li>}
                      </ul>
                    </div>
                  );
                }''', '''                const c1 = getCount(CLASSES[0].id, CLASSES[0].label);
                const c2 = getCount(CLASSES[1].id, CLASSES[1].label);
                const c3 = getCount(CLASSES[2].id, CLASSES[2].label);
                const isReady = c1 >= 3 && c2 >= 3 && c3 >= 3;

                if (!isReady) {
                  return (
                    <div className=\"bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl p-4 text-xs font-bold mb-6 flex flex-col gap-1.5 shadow-inner\">
                      <span className=\"text-red-800 text-sm font-extrabold block\">⚠️ Yêu cầu dữ liệu:</span>
                      <span>Bé cần chụp ít nhất 3 ảnh cho mỗi nhóm để AI có thể học tốt nhé:</span>
                      <ul className=\"list-disc pl-4 space-y-1\">
                        {c1 < 3 && <li>Nhóm \"{CLASSES[0].label}\": thiếu {3 - c1} ảnh mẫu.</li>}
                        {c2 < 3 && <li>Nhóm \"{CLASSES[1].label}\": thiếu {3 - c2} ảnh mẫu.</li>}
                        {c3 < 3 && <li>Nhóm \"{CLASSES[2].label}\": thiếu {3 - c3} ảnh mẫu.</li>}
                      </ul>
                    </div>
                  );
                }''')

    content = content.replace("speakVietnamese('Bé chưa chụp đủ 3 ảnh mẫu cho mỗi nhóm rồi! Bé hãy chụp thêm hình mẫu nhé!');", "speakVietnamese('Bé chưa chụp đủ 3 ảnh mẫu cho mỗi nhóm rồi! Bé hãy chụp thêm hình mẫu nhé!');")

    with open('client/src/app/(private)/challenge/teach-face/page.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
