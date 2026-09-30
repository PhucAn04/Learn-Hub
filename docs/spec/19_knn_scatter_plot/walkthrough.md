# Walkthrough — Plan 19 v2.1: kNN Scatter Plot & Image Quality

## Tổng quan

Triển khai thành công Plan 19 v2.1 — thêm biểu đồ phân tán kNN trực quan + hệ thống đánh giá chất lượng ảnh vào trang Dạy AI (TeachPanel). Mục đích: giúp bé trực quan hóa dữ liệu huấn luyện AI và tự phát hiện lỗi (Garbage In, Garbage Out).

---

## Files Created (New)

### [image-quality.ts](file:///D:/HOCTAP/Learn-Hub/client/src/lib/image-quality.ts)
- `analyzeBrightness(canvas)` → đo ánh sáng trung bình từ pixel data
- `analyzeBlur(canvas)` → đo Laplacian variance (biến thiên cạnh)
- `assessQuality(canvas)` → kết hợp cả 2 metric, trả về `SampleQualityMeta`

### [scatter-layout.ts](file:///D:/HOCTAP/Learn-Hub/client/src/lib/scatter-layout.ts)
- `computeClassCenters(classIds, w, h)` → chia canvas thành vùng đều nhau theo số nhãn
- `computeScatterPoints(samples, classIds, centers, w)` → tính vị trí mỗi điểm dữ liệu (jitter seeded bằng hash)
- 8 màu predefined cho các class

### [KnnScatterPlot.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/KnnScatterPlot.tsx)
- Canvas component hiển thị biểu đồ phân tán
- Vùng (ellipse) cho mỗi nhãn + label động từ `classes` prop
- Highlight K-nearest neighbors bằng đường nét đứt
- Dấu ★ cho vị trí prediction, dấu **?** khi không đủ đồng thuận
- ⚠️ Pulse animation cho nhãn thiếu dữ liệu (imbalance)
- Tooltip hover hiện thumbnail + tag chất lượng (🌑 tối, 🔍 mờ)
- Zoom/Pan controls

---

## Files Modified

### [knn-classifier.ts](file:///D:/HOCTAP/Learn-Hub/client/src/lib/knn-classifier.ts)
- Thêm interface `SampleQualityMeta` (brightness, blurScore, isDark, isBlurry)
- Thêm field `quality?` vào `StoredSample`
- Thêm function `classifyKNNWithVotes()` → trả về thêm `kNearestIds` và `voteCounts` cho scatter plot

### [TeachPanel.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/TeachPanel.tsx)
- Layout: 2 cột → **3 cột** (Left: nhãn, Center: camera + prediction, Right: scatter plot)
- Xóa hiển thị **"Tự tin %"** (không phù hợp giáo dục)
- Prediction loop: `classifyKNN` → `classifyKNNWithVotes`
- State mới: `kNearestIds`, `voteCounts`
- Import + render `KnnScatterPlot`

### [DataCollector.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/DataCollector.tsx)
- Import `assessQuality`
- Gọi `assessQuality(img.canvas)` khi tạo mẫu
- Attach metadata `quality` vào `StoredSample`

### [AIFeedbackModal.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/AIFeedbackModal.tsx)
- Thêm section **"Chất lượng ảnh"** (orange border)
- Phân tích per-class: nếu >50% ảnh bị tối/mờ → hiện grid thumbnails + badges
- Fix: destructure `qualityIssues` từ `useMemo`
- Fix: TS7053 type casting cho `knn.counts`

---

## Pre-existing Bug Fixes (Bonus)

| File | Bug | Fix |
|------|-----|-----|
| [teach-gestures/page.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/app/(private)/teacher/training/teach-gestures/page.tsx) | Duplicate `setIsCapturing` (dòng 29 + 53) | Xóa dòng 53 |
| [teach-two-hands/page.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/app/(private)/teacher/training/teach-two-hands/page.tsx) | Duplicate `setIsCapturing` (dòng 107 + 130) | Xóa dòng 130 |
| [BodyTeachPanel.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/BodyTeachPanel.tsx) | Missing `</div>` closing left panel → JSX parse error | Thêm `</div>` đóng left panel container + fix indentation |

---

## Verification

- ✅ **TypeScript**: `npx tsc --noEmit --skipLibCheck` → **0 errors**
- ⏳ **Next.js build**: User cần chạy `npm run build` để verify full build (Turbopack)

---

## Next Steps

1. Chạy `npm run dev` và test trực tiếp trên browser
2. Test flow: Chọn nhãn → Chụp ảnh → Quan sát scatter plot cập nhật real-time
3. Test imbalance: Chụp nhiều ảnh cho 1 nhãn, ít cho nhãn khác → Xem pulse warning
4. Test quality: Chụp ảnh trong bóng tối hoặc rung → Xem tag 🌑🔍 trên biểu đồ
5. Click "Dạy AI" → Kiểm tra AIFeedbackModal hiện section chất lượng ảnh
