import os
import re

def rewrite_teach_face():
    file_path = 'client/src/app/(private)/challenge/teach-face/page.tsx'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Imports
    content = content.replace("import { drawFaceStickers, getFaceKeypoints } from '@/lib/face-drawing';", 
"""import { 
  FACE_OVAL,
  FACE_L_EYE,
  FACE_R_EYE,
  FACE_LIPS,
  FACE_NOSE,
  drawPolyline,
  normalizeFaceKeypoints,
  getSmileMetricsFromFaceMesh,
  drawFaceStickers,
  getFaceKeypoints
} from '@/lib/face-drawing';""")

    # 2. Hook destructuring
    content = content.replace("const { allFacesRef: handsRef, modelStatus } = useMl5FaceMesh(videoRef, cameraActive, {\n    maxFaces: 1,\n  });",
                              "const { allFacesRef, modelStatus } = useMl5FaceMesh(videoRef, cameraActive, {\n    maxFaces: 1,\n  });")

    # 3. captureSample
    capture_pattern = re.compile(r'const captureSample = \(\) => \{.*?\};', re.DOTALL)
    new_capture = """const captureSample = () => {
    const faces = allFacesRef.current;
    if (!faces || faces.length === 0) {
      speakVietnamese('Bạn A I chưa nhìn thấy khuôn mặt nào trước camera cả!');
      return;
    }

    playClickSound();
    
    const activeClassLabel = activeClass;
    const newSamples: StoredSample[] = [];

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
  };"""
    content = capture_pattern.sub(new_capture, content)

    # 4. prediction loop
    pred_pattern = re.compile(r'const runPrediction = \(\) => \{.*?\};', re.DOTALL)
    new_pred = """const runPrediction = () => {
      const faces = allFacesRef.current;
      
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
    };"""
    content = pred_pattern.sub(new_pred, content)
    
    # 5. speak debounce
    speak_pattern = re.compile(r"if \(predictedLabel !== speakDebounceText\) \{.*?\}\n      \}", re.DOTALL)
    new_speak = """if (predictedLabel !== speakDebounceText) {
        setSpeakDebounceText(predictedLabel);
        
        let msg = '';
        if (predictedLabel.includes('Vui vẻ')) {
          msg = 'A I đoán bé đang rất vui!';
          setEffectEmoji('😀');
        } else if (predictedLabel.includes('Buồn bã')) {
          msg = 'A I đoán bé đang buồn!';
          setEffectEmoji('😢');
        } else if (predictedLabel.includes('Ngạc nhiên')) {
          msg = 'A I đoán bé đang ngạc nhiên!';
          setEffectEmoji('😲');
        }

        if (msg) {
          speakVietnamese(msg);
          setTimeout(() => setEffectEmoji(null), 1200);
        }
      }"""
    content = speak_pattern.sub(new_speak, content)

    # 6. canvas drawing loop
    run_frame_pattern = re.compile(r'const runFrame = \(\) => \{.*?\};\n\n    runFrame\(\);', re.DOTALL)
    new_run_frame = """const drawFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && modelStatus === 'ready') {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const rect = video.getBoundingClientRect();
          const displayWidth = Math.round(rect.width);
          const displayHeight = Math.round(rect.height);

          if (displayWidth > 0 && displayHeight > 0 && (canvas.width !== displayWidth || canvas.height !== displayHeight)) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const allFaces = allFacesRef.current;
          const validFaces = allFaces.filter(kps => kps.length >= 30);

          if (validFaces.length > 0 && video.videoWidth > 0 && video.videoHeight > 0) {
            validFaces.forEach((kpsRaw, faceIdx) => {
              ctx.save();

              const kps = normalizeFaceKeypoints(kpsRaw, video, canvas);
              
              // Colors
              const ovalColor = '#60a5fa';
              const eyeColor = '#a78bfa';
              const lipsColor = '#fbbf24';
              const noseColor = '#34d399';
              const dotColor = 'rgba(96,165,250,0.55)';

              // Draw face wireframe
              if (kps.length > 100) {
                ctx.strokeStyle = ovalColor;
                ctx.lineWidth = 1.8;
                drawPolyline(ctx, FACE_OVAL, kps);

                ctx.strokeStyle = eyeColor;
                ctx.lineWidth = 1.4;
                drawPolyline(ctx, FACE_L_EYE, kps);
                drawPolyline(ctx, FACE_R_EYE, kps);

                ctx.strokeStyle = lipsColor;
                ctx.lineWidth = 1.4;
                drawPolyline(ctx, FACE_LIPS, kps);

                ctx.strokeStyle = noseColor;
                ctx.lineWidth = 1.2;
                drawPolyline(ctx, FACE_NOSE, kps);
              }

              // Draw keypoints
              ctx.fillStyle = dotColor;
              for (const point of kps) {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 1.4, 0, Math.PI * 2);
                ctx.fill();
              }

              ctx.restore();
            });
          }
        }
      }
      rafId = requestAnimationFrame(drawFrame);
    };

    drawFrame();"""
    content = run_frame_pattern.sub(new_run_frame, content)

    # 7. replace `allFacesRef` deps in useEffect
    content = content.replace("  }, [modelStatus, videoRef, canvasRef]);", "  }, [modelStatus, videoRef, canvasRef, allFacesRef]);")

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    rewrite_teach_face()
