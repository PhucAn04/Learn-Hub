'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { StoredSample } from '@/lib/knn-classifier';
import {
  computeClassCenters,
  computeScatterPoints,
  ScatterPoint,
  ClassCenter,
  CLASS_COLORS,
} from '@/lib/scatter-layout';

// ── Props ──
interface KnnScatterPlotProps {
  samples: StoredSample[];
  classes: { id: string; label: string; emoji?: string }[];
  kValue: number;
  threshold: number;
  kNearestIds?: string[];
  predictedLabel?: string;
  voteCounts?: Record<string, number>;
}

// ── Tooltip state ──
interface TooltipState {
  x: number;
  y: number;
  thumbnail: string;
  label: string;
  isDark?: boolean;
  isBlurry?: boolean;
}

// ── Constants ──
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.15;
const POINT_RADIUS = 4;
const POINT_RADIUS_HIGHLIGHT = 6.5;

export default function KnnScatterPlot({
  samples,
  classes,
  kValue,
  threshold,
  kNearestIds = [],
  predictedLabel,
  voteCounts = {},
}: KnnScatterPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Tooltip
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Canvas size
  const [canvasSize, setCanvasSize] = useState({ w: 400, h: 400 });

  // ── Resize observer ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasSize({ w: Math.round(width), h: Math.round(height) });
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ── Compute layout ──
  const classIds = useMemo(() => classes.map((c) => c.id), [classes]);

  const classCenters = useMemo(
    () => computeClassCenters(classIds, canvasSize.w, canvasSize.h),
    [classIds, canvasSize.w, canvasSize.h]
  );

  const scatterPoints = useMemo(
    () => computeScatterPoints(samples, classIds, classCenters, canvasSize.w, classes),
    [samples, classIds, classCenters, canvasSize.w, classes]
  );

  // ── Build label map from classes prop ──
  const labelMap = useMemo(() => {
    const map: Record<string, { label: string; emoji?: string }> = {};
    classes.forEach((c) => {
      map[c.id] = { label: c.label, emoji: c.emoji };
    });
    return map;
  }, [classes]);

  // ── Imbalance detection ──
  const imbalanceInfo = useMemo(() => {
    if (classIds.length < 2) return null;
    const counts: Record<string, number> = {};
    classIds.forEach((id) => (counts[id] = 0));
    samples.forEach((s) => {
      const cid = s.sourceId || classIds[0];
      counts[cid] = (counts[cid] || 0) + 1;
    });

    const values = Object.values(counts);
    const max = Math.max(...values);
    
    // Find all lagging classes
    const laggingClassIds = Object.entries(counts)
      .filter(([, v]) => v > 0 && (max > v * 1.2))
      .map(([id]) => id);

    if (laggingClassIds.length === 0) return null;

    return { laggingClassIds };
  }, [samples, classIds]);

  // ── Transform helpers ──
  const toScreen = useCallback(
    (x: number, y: number) => ({
      sx: (x - canvasSize.w / 2) * zoom + canvasSize.w / 2 + panOffset.x,
      sy: (y - canvasSize.h / 2) * zoom + canvasSize.h / 2 + panOffset.y,
    }),
    [zoom, panOffset, canvasSize]
  );

  // ── Draw ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.w * dpr;
    canvas.height = canvasSize.h * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.roundRect(0, 0, canvasSize.w, canvasSize.h, 16);
    ctx.fill();

    // Grid lines (subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const gridStep = 40 * zoom;
    for (let x = panOffset.x % gridStep; x < canvasSize.w; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasSize.h);
      ctx.stroke();
    }
    for (let y = panOffset.y % gridStep; y < canvasSize.h; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasSize.w, y);
      ctx.stroke();
    }

    // ── Draw class regions ──
    const kNearestSet = new Set(kNearestIds);
    const animTime = Date.now() / 1000;

    classIds.forEach((classId) => {
      const center = classCenters[classId];
      if (!center) return;

      const classPoints = scatterPoints.filter((p) => p.classId === classId);
      const count = classPoints.length;
      if (count === 0) {
        // Draw empty placeholder
        const { sx, sy } = toScreen(center.cx, center.cy);
        ctx.beginPath();
        ctx.arc(sx, sy, 30 * zoom, 0, Math.PI * 2);
        ctx.strokeStyle = center.color + '40';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        const info = labelMap[classId];
        if (info) {
          ctx.fillStyle = center.color + '80';
          ctx.font = `bold ${Math.max(10, 11 * zoom)}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${info.emoji} ${info.label}`, sx, sy);
        }
        return;
      }

      // Region ellipse: compute bounding box of points
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      classPoints.forEach((p) => {
        const { sx, sy } = toScreen(p.x, p.y);
        if (sx < minX) minX = sx;
        if (sx > maxX) maxX = sx;
        if (sy < minY) minY = sy;
        if (sy > maxY) maxY = sy;
      });

      const regionCx = (minX + maxX) / 2;
      const regionCy = (minY + maxY) / 2;
      const regionRx = Math.max((maxX - minX) / 2 + 20 * zoom, 30 * zoom);
      const regionRy = Math.max((maxY - minY) / 2 + 20 * zoom, 30 * zoom);

      // Region background
      ctx.beginPath();
      ctx.ellipse(regionCx, regionCy, regionRx, regionRy, 0, 0, Math.PI * 2);
      ctx.fillStyle = center.color + '15';
      ctx.fill();

      // Region border
      const isLagging = imbalanceInfo?.laggingClassIds.includes(classId);
      if (isLagging) {
        // Pulsing yellow border for imbalanced class
        const pulse = 0.5 + 0.5 * Math.sin(animTime * 3);
        ctx.strokeStyle = `rgba(250, 204, 21, ${0.3 + pulse * 0.4})`;
        ctx.lineWidth = 2.5;
      } else {
        ctx.strokeStyle = center.color + '30';
        ctx.lineWidth = 1.5;
      }
      ctx.stroke();

      // Region label — dynamic from classes prop
      const info = labelMap[classId];
      if (info) {
        ctx.fillStyle = center.color + 'cc';
        const fontSize = Math.max(10, 12 * zoom);
        ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const labelY = regionCy - regionRy - 8 * zoom;
        const displayLabel = isLagging ? `⚠️ ${info.emoji} ${info.label}` : `${info.emoji} ${info.label}`;
        ctx.fillText(displayLabel, regionCx, labelY);

        // Count badge
        ctx.font = `600 ${Math.max(9, 10 * zoom)}px system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText(`${count} ảnh`, regionCx, labelY + fontSize + 2);
      }

      // Imbalance warning text
      if (isLagging) {
        ctx.font = `bold ${Math.max(9, 10 * zoom)}px system-ui, sans-serif`;
        ctx.fillStyle = `rgba(250, 204, 21, ${0.6 + 0.3 * Math.sin(animTime * 3)})`;
        ctx.textAlign = 'center';
        ctx.fillText('⚠️ Ít dữ liệu hơn', regionCx, regionCy + regionRy + 14 * zoom);
      }
    });

    // ── Draw data points ──
    scatterPoints.forEach((point) => {
      const { sx, sy } = toScreen(point.x, point.y);
      const isKNearest = kNearestSet.has(point.sampleId);
      const sample = samples.find((s) => s.id === point.sampleId);
      const hasBadQuality = sample?.quality?.isDark || sample?.quality?.isBlurry;

      const radius = isKNearest ? POINT_RADIUS_HIGHLIGHT * zoom : POINT_RADIUS * zoom;

      // Glow for K-nearest
      if (isKNearest) {
        ctx.beginPath();
        ctx.arc(sx, sy, radius + 4 * zoom, 0, Math.PI * 2);
        ctx.fillStyle = point.color + '30';
        ctx.fill();
      }

      // Main dot
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fillStyle = isKNearest ? point.color : point.color + 'bb';
      ctx.fill();

      // Border
      if (hasBadQuality) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5 * zoom;
      } else if (isKNearest) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * zoom;
      } else {
        ctx.strokeStyle = point.color;
        ctx.lineWidth = 1 * zoom;
      }
      ctx.stroke();
    });

    // ── Draw K-nearest lines & Live Star ★ ──
    if (kNearestIds.length > 0 || predictedLabel) {
      // Find predicted class object
      const predictedClass = classes.find(
        (c) => c.id === predictedLabel || c.label === predictedLabel
      );
      const predictedCenter = predictedClass ? classCenters[predictedClass.id] : null;

      // Find screen coordinates of K-nearest points
      const nearestPointsWithScreen = kNearestIds
        .map((id) => {
          const point = scatterPoints.find((p) => p.sampleId === id);
          return point ? { point, screen: toScreen(point.x, point.y) } : null;
        })
        .filter((item): item is { point: ScatterPoint; screen: { sx: number; sy: number } } => Boolean(item));

      let starSx = 0;
      let starSy = 0;

      if (nearestPointsWithScreen.length > 0) {
        // Calculate centroid of K-nearest points for accurate live position
        const avgX = nearestPointsWithScreen.reduce((sum, p) => sum + p.screen.sx, 0) / nearestPointsWithScreen.length;
        const avgY = nearestPointsWithScreen.reduce((sum, p) => sum + p.screen.sy, 0) / nearestPointsWithScreen.length;

        if (predictedCenter) {
          const centerScreen = toScreen(predictedCenter.cx, predictedCenter.cy);
          starSx = avgX * 0.7 + centerScreen.sx * 0.3;
          starSy = avgY * 0.7 + centerScreen.sy * 0.3;
        } else {
          starSx = avgX;
          starSy = avgY;
        }
      } else if (predictedCenter) {
        const centerScreen = toScreen(predictedCenter.cx, predictedCenter.cy);
        starSx = centerScreen.sx;
        starSy = centerScreen.sy;
      }

      if (starSx > 0 && starSy > 0) {
        // Draw glowing dashed lines from star to K-nearest points
        nearestPointsWithScreen.forEach(({ point, screen }) => {
          ctx.beginPath();
          ctx.moveTo(starSx, starSy);
          ctx.lineTo(screen.sx, screen.sy);
          ctx.strokeStyle = point.color + 'dd';
          ctx.lineWidth = 2 * zoom;
          ctx.setLineDash([5 * zoom, 4 * zoom]);
          ctx.stroke();
          ctx.setLineDash([]);
        });

        // Outer glowing aura for the live star
        ctx.beginPath();
        ctx.arc(starSx, starSy, 12 * zoom, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
        ctx.fill();

        // Draw star ★
        drawStar(ctx, starSx, starSy, 10 * zoom, 5 * zoom, 5);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * zoom;
        ctx.stroke();

        // Threshold check: show "?" if not enough consensus
        const bestVoteCount = Math.max(...Object.values(voteCounts), 0);
        const actualThreshold = Math.min(threshold, kValue);
        if (bestVoteCount < actualThreshold && kNearestIds.length > 0) {
          ctx.font = `bold ${24 * zoom}px system-ui, sans-serif`;
          ctx.fillStyle = 'rgba(250, 204, 21, 0.9)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('?', starSx, starSy - 22 * zoom);
        }
      }
    }

    // ── Empty state ──
    if (samples.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Chụp ảnh để thấy dữ liệu hiện lên đây!', canvasSize.w / 2, canvasSize.h / 2);
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillText('📊 Biểu đồ phân loại kNN', canvasSize.w / 2, canvasSize.h / 2 + 22);
    }

    // Request next animation frame for imbalance pulse
    if (imbalanceInfo) {
      const rafId = requestAnimationFrame(() => {
        // Trigger re-render by canvas redraw (the effect deps will handle it)
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [
    canvasSize,
    zoom,
    panOffset,
    scatterPoints,
    classIds,
    classCenters,
    labelMap,
    kNearestIds,
    predictedLabel,
    voteCounts,
    threshold,
    kValue,
    samples,
    imbalanceInfo,
    toScreen,
    classes,
  ]);

  // ── Imbalance pulse animation ──
  useEffect(() => {
    if (!imbalanceInfo) return;
    let rafId: number;
    const tick = () => {
      // Force re-render to update pulse
      setCanvasSize((prev) => ({ ...prev }));
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [imbalanceInfo]);

  // ── Mouse events for tooltip & drag ──
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (isDragging) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        setPanOffset({
          x: dragStartRef.current.panX + dx,
          y: dragStartRef.current.panY + dy,
        });
        return;
      }

      // Hit test points
      let found = false;
      for (const point of scatterPoints) {
        const { sx, sy } = toScreen(point.x, point.y);
        const dist = Math.sqrt((mx - sx) ** 2 + (my - sy) ** 2);
        if (dist < POINT_RADIUS * zoom + 4) {
          const sample = samples.find((s) => s.id === point.sampleId);
          if (sample?.thumbnail) {
            setTooltip({
              x: mx,
              y: my,
              thumbnail: sample.thumbnail,
              label: sample.label,
              isDark: sample.quality?.isDark,
              isBlurry: sample.quality?.isBlurry,
            });
            found = true;
          }
          break;
        }
      }
      if (!found) setTooltip(null);
    },
    [isDragging, scatterPoints, samples, zoom, toScreen]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (zoom > 1) {
        setIsDragging(true);
        dragStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          panX: panOffset.x,
          panY: panOffset.y,
        };
      }
    },
    [zoom, panOffset]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setZoom((prev) => {
      const newZoom = e.deltaY < 0 ? prev + ZOOM_STEP : prev - ZOOM_STEP;
      return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    });
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP * 2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const newZoom = Math.max(MIN_ZOOM, prev - ZOOM_STEP * 2);
      if (newZoom <= 1) setPanOffset({ x: 0, y: 0 });
      return newZoom;
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[300px] rounded-2xl overflow-hidden bg-slate-900"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        style={{ cursor: isDragging ? 'grabbing' : zoom > 1 ? 'grab' : 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          handleMouseUp();
          setTooltip(null);
        }}
        onWheel={handleWheel}
      />

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-10">
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-white/70 hover:text-white transition-colors border border-white/10"
          title="Phóng to"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-white/70 hover:text-white transition-colors border border-white/10"
          title="Thu nhỏ"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {/* Zoom indicator */}
      {zoom !== 1 && (
        <div className="absolute top-3 right-3 bg-white/10 backdrop-blur-sm text-white/60 text-[10px] font-bold px-2 py-1 rounded-lg border border-white/10">
          {Math.round(zoom * 100)}%
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            left: Math.min(tooltip.x + 12, canvasSize.w - 120),
            top: Math.max(tooltip.y - 90, 8),
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl border-2 border-slate-200 overflow-hidden">
            <img
              src={tooltip.thumbnail}
              alt={tooltip.label}
              className="w-20 h-20 object-cover"
            />
            <div className="px-2 py-1.5 text-center">
              <div className="text-[10px] font-bold text-slate-700 truncate max-w-[80px]">
                {tooltip.label}
              </div>
              {(tooltip.isDark || tooltip.isBlurry) && (
                <div className="text-[9px] font-bold text-red-500 mt-0.5">
                  {tooltip.isDark && '🌑 Tối '}
                  {tooltip.isBlurry && '🔍 Mờ'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chart title */}
      <div className="absolute top-3 left-3 text-[10px] font-bold text-white/30 uppercase tracking-wider">
        Biểu đồ phân loại kNN
      </div>
    </div>
  );
}

// ── Helper: draw 5-pointed star ──
function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  points: number
) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
