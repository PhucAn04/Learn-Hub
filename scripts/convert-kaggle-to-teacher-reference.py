"""
Script trich xuat TOAN BO mau point/peace tu Kaggle "Hand Gesture Landmarks"
sang file TypeScript teacher-reference-dataset.ts phuc vu Teacher evaluation.

Khac voi convert-kaggle-to-golden.py (chi chon 5 mau dai dien cho Student),
script nay trich xuat TAT CA cac mau point va peace (68 mau) de lam bo du lieu
doi chieu chat che cho Teacher.

Nguon du lieu:
  - Kaggle: https://www.kaggle.com/datasets/youssefelebiary/hand-gesture-landmarks
  - Tac gia: Youssef Elebiary
  - Giay phep: MIT

Cach su dung:
  python convert-kaggle-to-teacher-reference.py
"""

import csv
import math
import os
import sys
from datetime import datetime


# ============================================================
# 1. DOC DU LIEU CSV TU KAGGLE
# ============================================================

def read_kaggle_csv(csv_path):
    """
    Doc file CSV Kaggle Hand Gesture Landmarks.
    Format: 63 cot toa do (landmark_0_x, landmark_0_y, landmark_0_z, ...) + 1 cot gesture_label
    Tra ve list cac dict: { 'gesture': str, 'landmarks': [(x,y,z), ...] }
    """
    samples = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)  # Bo qua dong header
        label_col = len(header) - 1  # Cot nhan nam o cuoi cung
        
        for row in reader:
            if len(row) < 64:
                continue
            
            gesture = row[label_col].strip().lower()
            
            # Doc 63 gia tri toa do (21 landmarks x 3 xyz)
            landmarks = []
            for i in range(21):
                x = float(row[i * 3].strip())
                y = float(row[i * 3 + 1].strip())
                z = float(row[i * 3 + 2].strip())
                landmarks.append((x, y, z))
            
            samples.append({
                'gesture': gesture,
                'landmarks': landmarks
            })
    
    return samples


# ============================================================
# 2. CHUAN HOA DU LIEU (GIONG HET normalizeHandKeypoints)
# ============================================================

def normalize_hand_keypoints(landmarks):
    """
    Chuan hoa 21 landmarks thanh vector 42 chieu (chi x, y).
    Logic giong het ham normalizeHandKeypoints() trong
    client/src/lib/knn-classifier.ts:
    
    1. Tinh tien co tay (Landmark 0) ve goc (0, 0)
    2. Tim khoang cach Euclid lon nhat tu co tay
    3. Chia toa do cho khoang cach lon nhat
    """
    if len(landmarks) < 21:
        return [0.0] * 42
    
    # Buoc 1: Tinh tien co tay ve goc
    wrist_x, wrist_y = landmarks[0][0], landmarks[0][1]
    translated = [(lm[0] - wrist_x, lm[1] - wrist_y) for lm in landmarks]
    
    # Buoc 2: Tim khoang cach lon nhat tu co tay
    max_dist = 0.0001  # Giong code TypeScript goc: let maxDist = 0.0001
    for x, y in translated:
        dist = math.sqrt(x * x + y * y)
        if dist > max_dist:
            max_dist = dist
    
    # Buoc 3: Chuan hoa va flatten thanh mang 42 phan tu
    features = []
    for x, y in translated:
        features.append(round(x / max_dist, 4))
        features.append(round(y / max_dist, 4))
    
    return features


# ============================================================
# 3. TINH THONG KE
# ============================================================

def euclidean_distance(a, b):
    """Tinh khoang cach Euclid giua 2 vector."""
    return math.sqrt(sum((ai - bi) ** 2 for ai, bi in zip(a, b)))


def compute_statistics(features_list, label):
    """Tinh vector trung binh va do lech chuan cho mot nhom cu chi."""
    n = len(features_list)
    dim = len(features_list[0])
    
    mean_vec = [0.0] * dim
    for f in features_list:
        for i in range(dim):
            mean_vec[i] += f[i]
    mean_vec = [v / n for v in mean_vec]
    
    std_vec = [0.0] * dim
    for f in features_list:
        for i in range(dim):
            std_vec[i] += (f[i] - mean_vec[i]) ** 2
    std_vec = [math.sqrt(v / n) for v in std_vec]
    
    avg_std = sum(std_vec) / len(std_vec)
    
    # Khoang cach TB giua cac mau
    total_dist = 0
    count = 0
    for i in range(n):
        for j in range(i + 1, n):
            total_dist += euclidean_distance(features_list[i], features_list[j])
            count += 1
    avg_inter_dist = total_dist / count if count > 0 else 0
    
    return {
        'label': label,
        'n_samples': n,
        'avg_std': avg_std,
        'avg_inter_distance': avg_inter_dist,
    }


# ============================================================
# 4. XUAT FILE TYPESCRIPT
# ============================================================

def generate_typescript(point_features, peace_features, point_stats, peace_stats, output_path):
    """Tao file teacher-reference-dataset.ts tu TOAN BO mau point/peace."""
    
    def format_features(features):
        """Format mang features thanh chuoi TypeScript voi comment landmarks."""
        lines = []
        groups = [
            (0, 1, '0: wrist'),
            (1, 5, '1-4: thumb'),
            (5, 9, '5-8: index'),
            (9, 13, '9-12: middle'),
            (13, 17, '13-16: ring'),
            (17, 21, '17-20: pinky'),
        ]
        
        for start, end, comment in groups:
            vals = []
            for i in range(start, end):
                vals.append(str(features[i * 2]))
                vals.append(str(features[i * 2 + 1]))
            line = ', '.join(vals)
            if end < 21:
                lines.append('      ' + line + ', // ' + comment)
            else:
                lines.append('      ' + line + '  // ' + comment)
        
        return '\n'.join(lines)
    
    now = datetime.now().strftime('%Y-%m-%d')
    
    ts_lines = []
    ts_lines.append("export interface TeacherReferenceSample {")
    ts_lines.append("  features: number[];")
    ts_lines.append("  expectedLabel: string;")
    ts_lines.append("}")
    ts_lines.append("")
    ts_lines.append("/**")
    ts_lines.append(" * Teacher Reference Dataset - Bo du lieu chuan tu Kaggle phuc vu Teacher evaluation")
    ts_lines.append(" *")
    ts_lines.append(" * NGUON DU LIEU:")
    ts_lines.append(' *   Bo du lieu: "Hand Gesture Landmarks" (Kaggle)')
    ts_lines.append(" *   Tac gia:     Youssef Elebiary")
    ts_lines.append(" *   URL:         https://www.kaggle.com/datasets/youssefelebiary/hand-gesture-landmarks")
    ts_lines.append(" *   Giay phep:   MIT License")
    ts_lines.append(" *")
    ts_lines.append(" * PHUONG PHAP TRICH XUAT:")
    ts_lines.append(" *   - Toa do 21 diem moc xuong tay (Hand Landmarks) duoc trich xuat bang")
    ts_lines.append(" *     mo hinh MediaPipe Hands (Google, 2020) tu anh ban tay thuc te.")
    ts_lines.append(' *   - Bai bao tham chieu: Zhang et al. "MediaPipe Hands: On-device Real-time')
    ts_lines.append(' *     Hand Tracking", arXiv:2006.10214')
    ts_lines.append(" *")
    ts_lines.append(" * CHUAN HOA:")
    ts_lines.append(" *   Ap dung cung thuat toan normalizeHandKeypoints() cua he thong:")
    ts_lines.append(" *   1. Tinh tien co tay (Landmark 0) ve goc toa do (0, 0)")
    ts_lines.append(" *   2. Chia toa do cho khoang cach Euclid lon nhat tu co tay")
    ts_lines.append(" *   3. Chi lay toa do 2D (x, y), vector 42 chieu")
    ts_lines.append(" *")
    ts_lines.append(" * MUC DICH:")
    ts_lines.append(" *   Dung lam bo du lieu doi chieu cho Teacher evaluation (Distance-weighted KNN).")
    ts_lines.append(" *   KHONG thay the golden-dataset.ts (Student Golden Test).")
    ts_lines.append(" *")
    ts_lines.append(" * THONG KE:")
    ts_lines.append(" *   - Tong mau point (1 ngon): %d, Do lech chuan TB: %.4f" % (point_stats['n_samples'], point_stats['avg_std']))
    ts_lines.append(" *   - Tong mau peace (2 ngon): %d, Do lech chuan TB: %.4f" % (peace_stats['n_samples'], peace_stats['avg_std']))
    ts_lines.append(" *   - Tong cong: %d mau" % (point_stats['n_samples'] + peace_stats['n_samples']))
    ts_lines.append(" *")
    ts_lines.append(" * Ngay tao: %s" % now)
    ts_lines.append(" * Formatted as: [x0, y0, x1, y1, ..., x20, y20]")
    ts_lines.append(" */")
    ts_lines.append("export const TEACHER_REFERENCE_DATASET: TeacherReferenceSample[] = [")
    
    # Point samples
    ts_lines.append("  // --- 1 NGON TAY (Toan bo mau point tu Kaggle: %d mau) ---" % len(point_features))
    for features in point_features:
        ts_lines.append("  {")
        ts_lines.append("    expectedLabel: '1 Ng\u00f3n Tay \u261d\ufe0f',")
        ts_lines.append("    features: [")
        ts_lines.append(format_features(features))
        ts_lines.append("    ]")
        ts_lines.append("  },")
    
    ts_lines.append("")
    
    # Peace samples
    ts_lines.append("  // --- 2 NGON TAY (Toan bo mau peace tu Kaggle: %d mau) ---" % len(peace_features))
    for idx, features in enumerate(peace_features):
        ts_lines.append("  {")
        ts_lines.append("    expectedLabel: '2 Ng\u00f3n Tay \u270c\ufe0f',")
        ts_lines.append("    features: [")
        ts_lines.append(format_features(features))
        ts_lines.append("    ]")
        if idx < len(peace_features) - 1:
            ts_lines.append("  },")
        else:
            ts_lines.append("  }")
    
    ts_lines.append("];")
    ts_lines.append("")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(ts_lines))


# ============================================================
# MAIN
# ============================================================

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, '..', 'dataset', 'Hand_Gesture_Landmarks', 'gesture_landmarks.csv')
    output_path = os.path.join(script_dir, '..', 'client', 'src', 'lib', 'teacher-reference-dataset.ts')
    
    # Kiem tra file CSV ton tai
    if not os.path.exists(csv_path):
        print('=' * 60)
        print('ERROR: Khong tim thay file gesture_landmarks.csv!')
        print('Duong dan can: %s' % os.path.abspath(csv_path))
        print('Huong dan:')
        print('  1. Truy cap: https://www.kaggle.com/datasets/youssefelebiary/hand-gesture-landmarks')
        print('  2. Nhan "Download"')
        print('  3. Giai nen file ZIP')
        print('  4. Dat file gesture_landmarks.csv vao thu muc dataset/Hand_Gesture_Landmarks/')
        print('=' * 60)
        sys.exit(1)
    
    print('=' * 60)
    print('TRICH XUAT TEACHER REFERENCE DATASET')
    print('(Toan bo mau point/peace tu Kaggle)')
    print('=' * 60)
    
    # Buoc 1: Doc CSV
    print('')
    print('[Buoc 1] Doc file CSV...')
    all_samples = read_kaggle_csv(csv_path)
    print('  Tong so mau trong CSV: %d' % len(all_samples))
    
    gestures = {}
    for s in all_samples:
        g = s['gesture']
        gestures[g] = gestures.get(g, 0) + 1
    print('  Cac cu chi co san:')
    for g, count in sorted(gestures.items()):
        marker = ' <-- TRICH XUAT' if g in ('point', 'peace') else ''
        print('    - %s: %d mau%s' % (g, count, marker))
    
    # Buoc 2: Loc va chuan hoa CHI point va peace
    print('')
    print('[Buoc 2] Loc cu chi point/peace va chuan hoa...')
    point_features = []
    peace_features = []
    
    for s in all_samples:
        if s['gesture'] == 'point':
            features = normalize_hand_keypoints(s['landmarks'])
            point_features.append(features)
        elif s['gesture'] == 'peace':
            features = normalize_hand_keypoints(s['landmarks'])
            peace_features.append(features)
    
    print('  Mau "point" (1 ngon) sau chuan hoa: %d' % len(point_features))
    print('  Mau "peace" (2 ngon) sau chuan hoa: %d' % len(peace_features))
    print('  TONG CONG: %d mau' % (len(point_features) + len(peace_features)))
    
    if len(point_features) == 0 or len(peace_features) == 0:
        print('ERROR: Khong tim thay mau point hoac peace trong CSV!')
        sys.exit(1)
    
    # Buoc 3: Tinh thong ke
    print('')
    print('[Buoc 3] Tinh thong ke...')
    point_stats = compute_statistics(point_features, 'point')
    peace_stats = compute_statistics(peace_features, 'peace')
    print('  Point - So mau: %d, Do lech chuan TB: %.4f, Khoang cach TB: %.4f' % (
        point_stats['n_samples'], point_stats['avg_std'], point_stats['avg_inter_distance']))
    print('  Peace - So mau: %d, Do lech chuan TB: %.4f, Khoang cach TB: %.4f' % (
        peace_stats['n_samples'], peace_stats['avg_std'], peace_stats['avg_inter_distance']))
    
    # Buoc 4: Xuat TypeScript
    print('')
    print('[Buoc 4] Xuat file teacher-reference-dataset.ts...')
    generate_typescript(point_features, peace_features, point_stats, peace_stats, output_path)
    
    output_abs = os.path.abspath(output_path)
    print('  OK - Da xuat thanh cong: %s' % output_abs)
    
    # Tong ket
    print('')
    print('=' * 60)
    print('TRICH XUAT HOAN TAT!')
    print('=' * 60)
    print('')
    print('Tom tat:')
    print('  - Nguon du lieu: Kaggle "Hand Gesture Landmarks" (Youssef Elebiary)')
    print('  - Mau trich xuat: %d point (1 ngon) + %d peace (2 ngon) = %d mau' % (
        len(point_features), len(peace_features), len(point_features) + len(peace_features)))
    print('  - Chi trich xuat: point va peace (KHONG lay cac cu chi khac)')
    print('  - Chuan hoa: normalizeHandKeypoints() (wrist->origin, scale by max dist)')
    print('  - Output: %s' % output_abs)
    print('')
    print('  LUU Y: File nay KHONG thay the golden-dataset.ts!')
    print('  golden-dataset.ts van duoc giu nguyen cho Student Golden Test.')


if __name__ == '__main__':
    main()
