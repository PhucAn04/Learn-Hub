'use client';

import { useState, useRef, useCallback } from 'react';

export interface MediaRecorderHookResult {
  isRecording: boolean;
  recordingDuration: number;
  maxDuration: number;
  startRecording: () => void;
  stopRecording: () => Promise<Blob | null>;
  recordedVideoUrl: string | null;
  recordedBlob: Blob | null;
  clearRecording: () => void;
}

/**
 * Hook quay video trực tiếp từ camera stream.
 * - Ghi video WebM (VP8/VP9)
 * - Giới hạn tối đa 10 giây (tự động dừng)
 * - Timer real-time
 * - Output: Blob video để chạy frame extraction
 */
export function useMediaRecorder(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  maxDurationSec: number = 10
): MediaRecorderHookResult {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const resolveStopRef = useRef<((blob: Blob | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch { /* ignore */ }
    }
    mediaRecorderRef.current = null;
  }, []);

  const startRecording = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.srcObject) {
      console.error('[MediaRecorder] No video stream available');
      return;
    }

    // Revoke old URL
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(null);
      setRecordedBlob(null);
    }

    const stream = video.srcObject as MediaStream;

    // Pick best supported mime type
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];
    let mimeType = '';
    for (const mt of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mt)) {
        mimeType = mt;
        break;
      }
    }

    if (!mimeType) {
      console.error('[MediaRecorder] No supported mime type found');
      alert('Trình duyệt của bạn không hỗ trợ quay video. Hãy thử Chrome hoặc Firefox nhé!');
      return;
    }

    chunksRef.current = [];

    try {
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2_500_000, // 2.5 Mbps for good quality
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        setRecordedBlob(blob);
        setIsRecording(false);
        setRecordingDuration(0);

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // Resolve any pending stop promise
        if (resolveStopRef.current) {
          resolveStopRef.current(blob);
          resolveStopRef.current = null;
        }
      };

      recorder.onerror = (e) => {
        console.error('[MediaRecorder] Error:', e);
        cleanup();
        setIsRecording(false);
        if (resolveStopRef.current) {
          resolveStopRef.current(null);
          resolveStopRef.current = null;
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // collect data every 1s
      setIsRecording(true);
      startTimeRef.current = Date.now();

      // Timer: update duration every 100ms
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setRecordingDuration(elapsed);

        // Auto-stop at max duration
        if (elapsed >= maxDurationSec) {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        }
      }, 100);
    } catch (err) {
      console.error('[MediaRecorder] Failed to start:', err);
      alert('Không thể bắt đầu quay video. Hãy thử lại nhé!');
    }
  }, [videoRef, maxDurationSec, recordedVideoUrl, cleanup]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(recordedBlob);
        return;
      }

      resolveStopRef.current = resolve;
      mediaRecorderRef.current.stop();
    });
  }, [recordedBlob]);

  const clearRecording = useCallback(() => {
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
    }
    setRecordedVideoUrl(null);
    setRecordedBlob(null);
    setRecordingDuration(0);
    chunksRef.current = [];
  }, [recordedVideoUrl]);

  return {
    isRecording,
    recordingDuration,
    maxDuration: maxDurationSec,
    startRecording,
    stopRecording,
    recordedVideoUrl,
    recordedBlob,
    clearRecording,
  };
}
