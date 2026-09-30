# Kế hoạch Triển khai 19: Biểu Đồ Phân Tán kNN Trực Quan & Trải Nghiệm GIGO

Xây dựng biểu đồ phân tán (Scatter Plot) kNN tương tác ngay bên phải khung camera, thay thế hoàn toàn chỉ số "Tự tin: %" hiện tại, đồng thời tích hợp kiểm tra chất lượng ảnh (blur/brightness) từ Plan 14 vào metadata mỗi sample để phục vụ phân tích hậu huấn luyện.

---

## User Review Required

> [!IMPORTANT]
> **Triết lý cốt lõi:** Đây là một platform training AI nơi bé là nhân vật chính. Bé trực tiếp trải nghiệm quá trình huấn luyện, tự tay thu thập dữ liệu, quan sát biểu đồ phân tán thay đổi real-time, và tự rút ra bài học khi AI hoạt động kém — hoàn toàn không có mascot, chatbot, hay các concept ẩn dụ.

> [!WARNING]
> Kế hoạch này sẽ **loại bỏ hoàn toàn** khối "Tự tin: X%" ở phần kết quả dự đoán ([TeachPanel.tsx#L1042-L1049](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/TeachPanel.tsx#L1042-L1049)) và thay thế bằng Biểu đồ phân tán kNN tương tác.

---

## Quyết định: Không dùng PCA — Dùng Class-Region Scatter Layout

### Tại sao KHÔNG dùng PCA?

Mục tiêu thật sự của biểu đồ là **trực quan hóa việc phân loại dữ liệu** — bé cần thấy rõ:
- Nhãn nào có nhiều ảnh, nhãn nào có ít ảnh (kích thước vùng)
- AI đang "hỏi ý kiến" ảnh nào khi dự đoán (K-neighbors)
- Dữ liệu có bị mất cân bằng không

PCA giải quyết bài toán **giảm 42/936 chiều xuống 2 chiều** — nhưng bé không cần hiểu trục X, Y nghĩa là gì. PCA thêm ~70 dòng code cho một bài toán mà bé không cần biết đến, và kết quả PCA có thể cho ra các cluster chồng lấp hoặc bị xoay lệch khiến biểu đồ khó đọc.

### Phương án thay thế: Class-Region Scatter Layout (~30 dòng)

Mỗi class được **gán sẵn 1 vùng riêng biệt** trên biểu đồ (tọa độ trung tâm cố định). Các chấm trong cùng class được **jitter** (rải nhẹ ngẫu nhiên) quanh trung tâm vùng đó để tránh chồng.

```
Ví dụ 3 class trên biểu đồ:

     ┌──────────────────────────────────┐
     │                                  │
     │      🟣🟣🟣🟣                   │
     │    🟣🟣🟣🟣🟣🟣 "Búa"          │
     │      🟣🟣🟣🟣                   │
     │                                  │
     │  🟢🟢 "Kéo"    🟠🟠🟠 "Bao"    │  ← Tên nhãn lấy động từ cột trái
     │  🟢🟢           🟠              │
     │                  ⚠️ Ít dữ liệu   │
     │            ★ ← AI đang đoán      │
     │         ╱ ╲                       │
     │     ╱       ╲  (K=3 đường nét    │
     │   🟣        🟢   đứt nối đến    │
     │   🟣           3 ảnh gần nhất)   │
     └──────────────────────────────────┘
```

**Bé thấy ngay:** "Búa" có vùng to (nhiều ảnh), "Bao" có vùng nhỏ xíu + cảnh báo.

### K-Neighbors vẫn chính xác 100%

Điểm mấu chốt: Việc tìm K điểm gần nhất **vẫn tính trên feature space thật** (42D/936D) bằng hàm `classifyKNN()` đã có sẵn, rồi chỉ **highlight** các chấm tương ứng trên biểu đồ bằng đường nét đứt. Biểu đồ là công cụ hiển thị, không phải công cụ tính toán.

| | PCA | Class-Region Scatter (chọn) |
|---|---|---|
| Độ phức tạp code | ~70 dòng utility | ~30 dòng layout |
| K-neighbors | Tính trên 2D (xấp xỉ) | Tính trên feature space thật (chính xác) rồi highlight |
| Ý nghĩa trực quan | Trục X, Y trừu tượng | Mỗi vùng = 1 nhãn, rõ ràng |
| Khi thêm sample | Phải recompute toàn bộ PCA | Chỉ thêm 1 chấm vào vùng tương ứng |
| Responsive | Giống nhau | Giống nhau |

---

## Phân Tích Hiện Trạng Codebase

### Kiến trúc Layout hiện tại của [TeachPanel.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/TeachPanel.tsx)

```
┌─────────────────────────────────────────────────────────────┐
│         grid grid-cols-1 lg:grid-cols-3 gap-6               │
│ ┌──────────────┐  ┌────────────────────────────────────────┐│
│ │  LEFT PANEL   │  │          RIGHT PANEL (col-span-2)      ││
│ │  (1 col)      │  │  ┌──────────────────────────────────┐  ││
│ │               │  │  │  Camera + DataCollector           │  ││
│ │  • Class btns │  │  │  (CameraView inside)              │  ││
│ │  • Capture    │  │  └──────────────────────────────────┘  ││
│ │  • Gallery    │  │  ┌──────────────────────────────────┐  ││
│ │  • Train btn  │  │  │  Prediction Result (gradient)     │  ││
│ │               │  │  │  • "AI đoán: ..."                 │  ││
│ │               │  │  │  • "Tự tin: 83%"  ← SẼ XÓA       │  ││
│ │               │  │  │  • K slider                       │  ││
│ │               │  │  │  • Threshold slider               │  ││
│ │               │  │  └──────────────────────────────────┘  ││
│ └──────────────┘  └────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Layout MỚI sau Plan 19

```
┌──────────────────────────────────────────────────────────────────────┐
│              grid grid-cols-1 lg:grid-cols-3 gap-4                   │
│ ┌───────────┐  ┌───────────────────────┐  ┌────────────────────────┐│
│ │ LEFT PANEL│  │ CENTER: Camera+Result │  │ RIGHT: kNN Scatter     ││
│ │ (rút gọn) │  │                       │  │  Plot (MỚI)           ││
│ │           │  │ ┌───────────────────┐ │  │ ┌────────────────────┐ ││
│ │ • Classes │  │ │  CameraView       │ │  │ │ 🟣🟣    🟢🟢     │ ││
│ │ • Capture │  │ │  + DataCollector   │ │  │ │  🟣🟣  ★  🟢     │ ││
│ │ • Gallery │  │ └───────────────────┘ │  │ │ 🟣 🟣  🟢         │ ││
│ │ • Train   │  │ ┌───────────────────┐ │  │ │     🟠  🟠  🟠    │ ││
│ │           │  │ │ AI đoán: Búa ✊    │ │  │ │  🟠  🟠     ⚠️   │ ││
│ │           │  │ │ (Không còn %)      │ │  │ │ [+ / -] zoom     │ ││
│ │           │  │ │ K slider ──────────│─│──│─│→ K lines count    │ ││
│ │           │  │ │ Threshold slider ──│─│──│─│→ Highlight color  │ ││
│ │           │  │ └───────────────────┘ │  │ └────────────────────┘ ││
│ └───────────┘  └───────────────────────┘  └────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

### Các file bị ảnh hưởng

| File | Trạng thái | Vai trò |
|---|---|---|
| [knn-classifier.ts](file:///D:/HOCTAP/Learn-Hub/client/src/lib/knn-classifier.ts) | MODIFY | Thêm `SampleQualityMeta` vào `StoredSample`, thêm `classifyKNNWithVotes()` |
| [TeachPanel.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/TeachPanel.tsx) | MODIFY | Đổi layout 3 cột, xóa "Tự tin: %", render `<KnnScatterPlot>` |
| [DataCollector.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/DataCollector.tsx) | MODIFY | Gọi `assessQuality()` khi thu mẫu |
| [AIFeedbackModal.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/AIFeedbackModal.tsx) | MODIFY | Thêm phân tích chất lượng ảnh (blur/dark) |
| **KnnScatterPlot.tsx** | **NEW** | Component biểu đồ phân tán kNN |
| **scatter-layout.ts** | **NEW** | Tính toán vị trí vùng + jitter (~30 dòng) |
| **image-quality.ts** | **NEW** | Tính blur (Laplacian) & brightness |

> [!NOTE]
> So với plan cũ: **Loại bỏ hoàn toàn file `pca.ts`**. Thay bằng `scatter-layout.ts` nhỏ gọn hơn nhiều.

---

## Proposed Changes

### Component 1: Core AI Layer

---

#### [MODIFY] [knn-classifier.ts](file:///D:/HOCTAP/Learn-Hub/client/src/lib/knn-classifier.ts)

Mở rộng `StoredSample` interface:

```typescript
export interface SampleQualityMeta {
  brightness: number;   // 0-255
  blurScore: number;    // Laplacian variance
  isDark: boolean;      // brightness < 60
  isBright: boolean;    // brightness > 200
  isBlurry: boolean;    // blurScore < ngưỡng
}

export interface StoredSample {
  id?: string;
  label: string;
  features: number[];
  sourceId?: string;
  thumbnail?: string;
  rawThumbnail?: string;
  isValid?: boolean;
  quality?: SampleQualityMeta;   // ← MỚI: metadata chất lượng ảnh
}
```

Thêm hàm `classifyKNNWithVotes()`: giống `classifyKNNDetailed()` nhưng trả về thêm **danh sách ID** của K samples gần nhất để biểu đồ highlight đúng chấm.

```typescript
export function classifyKNNWithVotes(
  newFeatures: number[],
  samples: StoredSample[],
  k: number
): {
  label: string;
  confidence: number;
  kNearestIds: string[];      // ← ID của K chấm gần nhất trên biểu đồ
  voteCounts: Record<string, number>; // ← Số phiếu mỗi class
}
```

---

#### [NEW] scatter-layout.ts (`client/src/lib/scatter-layout.ts`)

Module tính tọa độ 2D cho biểu đồ. **Không giảm chiều — chỉ sắp xếp vị trí theo class:**

```typescript
interface ScatterPoint {
  sampleId: string;
  x: number;      // Tọa độ X trên canvas
  y: number;      // Tọa độ Y trên canvas
  classId: string;
  color: string;
}

// Palette màu cho các vùng
const CLASS_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#a855f7'];

/**
 * Tính vị trí trung tâm cho mỗi class trên canvas.
 * - 2 classes: trái / phải
 * - 3 classes: tam giác đều
 * - 4 classes: 4 góc
 * - 5+ classes: phân bố đều trên vòng tròn
 */
export function computeClassCenters(
  classIds: string[],
  canvasWidth: number,
  canvasHeight: number
): Record<string, { cx: number; cy: number; color: string }>;

/**
 * Gán tọa độ 2D cho mỗi sample.
 * Mỗi sample được đặt gần trung tâm class của nó,
 * jitter bằng hash(sample.id) để vị trí ổn định giữa các lần render.
 */
export function computeScatterPoints(
  samples: StoredSample[],
  classIds: string[],
  canvasWidth: number,
  canvasHeight: number
): ScatterPoint[];
```

**Thuật toán jitter:** Dùng seeded random từ `sample.id` (không dùng `Math.random()`) để mỗi chấm có vị trí cố định — tránh biểu đồ nhảy lung tung khi re-render. Bán kính jitter tỷ lệ với `sqrt(số sample trong class)` → vùng lớn khi có nhiều ảnh, vùng nhỏ khi ít ảnh.

---

#### [NEW] image-quality.ts (`client/src/lib/image-quality.ts`)

Module kiểm tra chất lượng ảnh (tích hợp từ Plan 14):

```typescript
export function analyzeBrightness(canvas: HTMLCanvasElement): number;
export function analyzeBlur(canvas: HTMLCanvasElement): number;
export function assessQuality(canvas: HTMLCanvasElement): SampleQualityMeta;
```

- **Brightness:** Grayscale trung bình `(R×0.299 + G×0.587 + B×0.114)`
- **Blur:** Laplacian 3×3 variance. Variance thấp = ít cạnh = ảnh mờ
- **Chỉ gắn tag, KHÔNG chặn** — bé vẫn tự do lưu ảnh mờ/tối

---

### Component 2: Biểu Đồ Phân Tán kNN (Core UI)

---

#### [NEW] KnnScatterPlot.tsx (`client/src/components/journey/KnnScatterPlot.tsx`)

Component vẽ biểu đồ bằng `<canvas>` (không thư viện ngoài):

**Props:**
```typescript
interface KnnScatterPlotProps {
  samples: StoredSample[];
  classes: { id: string; label: string; emoji: string }[];
  kValue: number;
  threshold: number;
  kNearestIds?: string[];          // ID K chấm gần nhất (từ classifyKNNWithVotes)
  predictedLabel?: string;         // Nhãn AI đang đoán
  voteCounts?: Record<string, number>; // Số phiếu mỗi class
}
```

**Tính năng chi tiết:**

1. **Các vùng class (Regions):**
   - Mỗi class 1 vùng tròn/ellipse bán trong suốt (opacity ~15%), viền nhẹ cùng màu
   - Tên nhãn + emoji hiển thị giữa vùng, **lấy động từ `classes` prop** — tương ứng 1:1 với tên class ở cột nhãn bên trái (ví dụ: cột trái hiện "☝️ 1 Ngón Tay" thì biểu đồ cũng hiện đúng "☝️ 1 Ngón Tay"). Khi tên nhãn ở cột trái thay đổi, biểu đồ tự động cập nhật theo.
   - Kích thước vùng tỷ lệ với `sqrt(số sample)` → nhiều ảnh = vùng to, ít ảnh = vùng nhỏ
   - Vùng tự động reflow khi thêm/xóa sample

2. **Các chấm điểm (Data Points):**
   - Mỗi chấm = 1 ảnh bé đã chụp, màu theo class
   - Hover/tap → tooltip nhỏ hiện thumbnail ảnh
   - Chấm có viền đỏ nếu `quality.isDark` hoặc `quality.isBlurry`
   - Animation nhẹ (scale-in) khi chấm mới xuất hiện

3. **K-Neighbors highlight (liên kết slider K):**
   - Khi `kNearestIds` thay đổi (real-time từ camera), K chấm tương ứng được **phóng to + viền sáng + đường nét đứt** nối về vùng class đang được đoán
   - Khi bé kéo thanh **K** từ 1→7: số đường nét đứt tăng/giảm tương ứng → bé thấy K lớn = AI hỏi ý kiến nhiều ảnh hơn
   - Nếu K chấm thuộc nhiều class khác nhau → đường nét đứt có nhiều màu → bé **thấy** AI đang bối rối
   - Ví dụ trực quan:
     ```
     K=3, AI đoán "Búa":           K=3, AI bối rối:
     
       🟣 ── ★                       🟣 ── ★ ── 🟢
       🟣 ─╱                              │
       🟣 ╱                               🟠
     (3 đường cùng màu tím            (3 đường 3 màu khác nhau
      → AI rất chắc chắn)              → AI không biết chọn ai)
     ```

4. **Liên kết slider Threshold (Độ khắt khe):**
   - Trong K chấm gần nhất, các chấm cùng class chiến thắng được highlight xanh lá
   - Nếu số chấm highlight < threshold → tất cả K chấm chuyển sang viền vàng cảnh báo + text "?" hiện ở trung tâm biểu đồ → bé hiểu: không đủ sự đồng thuận

5. **Thu phóng (Zoom):**
   - Lăn con lăn chuột (wheel) hoặc 2 button `[+]` `[-]` ở góc phải dưới
   - Kéo (drag) để pan khi đã zoom in
   - Giúp bé zoom vào vùng nhỏ để thấy rõ sự chênh lệch

6. **Cảnh báo mất cân bằng:**
   - Khi `max(count) / min(count) ≥ 2`: Vùng nhỏ nhất nhấp nháy viền vàng nhẹ + text "Ít dữ liệu hơn ⚠️"
   - **Không popup, không chặn** — chỉ gợi ý trực quan trên biểu đồ

---

### Component 3: Tích hợp vào TeachPanel

---

#### [MODIFY] [TeachPanel.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/TeachPanel.tsx)

**Thay đổi Layout:**

- **Trước:** `grid-cols-1 lg:grid-cols-3` — Left (1 col) + Right Camera+Result (2 cols)
- **Sau:** 3 cột đều: Left (classes/capture) + Center (camera/result/sliders) + Right (KnnScatterPlot)

**Xóa bỏ:**
- Khối "Tự tin: X%" (`bg-white/10 px-3 py-1`) tại [#L1042-L1049](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/TeachPanel.tsx#L1042-L1049)
- State `confidence` không còn cần thiết cho UI (vẫn giữ nội bộ nếu cần cho logic)

**Thêm mới trong prediction loop:**
- Gọi `classifyKNNWithVotes()` thay vì `classifyKNN()` → nhận được `kNearestIds` và `voteCounts`
- Truyền xuống `<KnnScatterPlot>` để biểu đồ highlight real-time

**Thêm mới trong captureSample():**
- Gọi `assessQuality(canvas)` từ `image-quality.ts`
- Đính kèm `quality` metadata vào mỗi `StoredSample`

---

#### [MODIFY] [DataCollector.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/DataCollector.tsx)

Trong `processDetectedFrames()` ([#L88-L147](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/DataCollector.tsx#L88-L147)):
- Gọi `assessQuality(img.canvas)` sau khi extract features
- Đính kèm `quality: SampleQualityMeta` vào StoredSample
- **Không chặn** sample nào

---

#### [MODIFY] [AIFeedbackModal.tsx](file:///D:/HOCTAP/Learn-Hub/client/src/components/journey/AIFeedbackModal.tsx)

Bổ sung phần **"Chất lượng ảnh"** vào phân tích:
- Nếu > 50% ảnh trong 1 class có `isDark` hoặc `isBlurry`:
  - Hiển thị grid ảnh lỗi kèm tag "🌑 Tối" hoặc "🔍 Mờ"
  - Text: *"Nhãn 'Búa' có 8/10 ảnh bị mờ. AI khó nhận ra vì dữ liệu không rõ nét!"*
- Giữ nguyên phân tích Balance và Label Correctness đã có

---

## Verification Plan

### Manual Verification
1. Mở Sandbox, tạo 3 class (Búa, Kéo, Bao)
2. Xác nhận biểu đồ phân tán xuất hiện bên phải camera, sát viền phải màn hình
3. Thu 20 ảnh cho "Búa", 5 cho "Kéo", 3 cho "Bao" → Vùng "Búa" to, vùng "Bao" nhỏ + nhấp nháy cảnh báo
4. Giơ tay trước camera → K đường nét đứt xuất hiện nối đến K chấm gần nhất
5. Kéo thanh K từ 1→7 → Số đường nét đứt thay đổi tương ứng
6. Kéo thanh Threshold lên cao → Nếu không đủ đồng thuận thì "?" xuất hiện
7. Zoom in (lăn chuột / nút +) → Zoom mượt, kéo pan được
8. Chụp ảnh trong phòng tối → Chấm có viền đỏ trên biểu đồ
9. Bấm "Dạy bạn AI học" → Modal hiện phân tích chất lượng ảnh nếu phát hiện mờ/tối
10. Xác nhận "Tự tin: X%" đã bị loại bỏ hoàn toàn

### Responsive
- Mobile (< lg): Biểu đồ xuất hiện bên dưới camera
- Desktop (≥ lg): 3 cột ngang cân đối
