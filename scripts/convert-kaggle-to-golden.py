"""
Script chuyen doi bo du lieu Kaggle "Hand Gesture Landmarks" sang dinh dang
Golden Test Dataset (TypeScript) tuong thich voi he thong Learn-Hub.

Nguon du lieu:
  - Kaggle: https://www.kaggle.com/datasets/youssefelebiary/hand-gesture-landmarks
  - Tac gia: Youssef Elebiary
  - Giay phep: MIT

Cach su dung:
  python convert-kaggle-to-golden.py
  (Yeu cau file gesture_landmarks.csv cung thu muc)
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
# 3. CHON MAU DAI DIEN BANG K-MEDOIDS
# ============================================================

def euclidean_distance(a, b):
    """Tinh khoang cach Euclid giua 2 vector."""
    return math.sqrt(sum((ai - bi) ** 2 for ai, bi in zip(a, b)))


def select_representative_samples(features_list, n_samples=5):
    """
    Chon n_samples mau dai dien bang thuat toan K-Medoids don gian.
    Tra ve danh sach chi so (index) cua cac mau duoc chon.
    """
    n = len(features_list)
    if n <= n_samples:
        return list(range(n))
    
    # Tinh ma tran khoang cach
    dist_matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            d = euclidean_distance(features_list[i], features_list[j])
            dist_matrix[i][j] = d
            dist_matrix[j][i] = d
    
    # Khoi tao: chon mau gan tam nhat
    total_dists = [sum(dist_matrix[i]) for i in range(n)]
    medoids = [total_dists.index(min(total_dists))]
    
    # Chon cac medoid tiep theo bang chien luoc farthest-first
    for _ in range(n_samples - 1):
        max_min_dist = -1
        best_candidate = -1
        for candidate in range(n):
            if candidate in medoids:
                continue
            min_dist_to_medoids = min(dist_matrix[candidate][m] for m in medoids)
            if min_dist_to_medoids > max_min_dist:
                max_min_dist = min_dist_to_medoids
                best_candidate = candidate
        medoids.append(best_candidate)
    
    # Tinh chinh medoids (swap optimization)
    improved = True
    max_iterations = 50
    iteration = 0
    while improved and iteration < max_iterations:
        improved = False
        iteration += 1
        for m_idx in range(len(medoids)):
            current_medoid = medoids[m_idx]
            current_cost = _calculate_total_cost(medoids, dist_matrix, n)
            
            best_swap = current_medoid
            best_cost = current_cost
            for candidate in range(n):
                if candidate in medoids:
                    continue
                medoids[m_idx] = candidate
                new_cost = _calculate_total_cost(medoids, dist_matrix, n)
                if new_cost < best_cost:
                    best_cost = new_cost
                    best_swap = candidate
                medoids[m_idx] = current_medoid
            
            if best_swap != current_medoid:
                medoids[m_idx] = best_swap
                improved = True
    
    return sorted(medoids)


def _calculate_total_cost(medoids, dist_matrix, n):
    """Tinh tong khoang cach tu moi diem den medoid gan nhat."""
    total = 0.0
    for i in range(n):
        min_dist = min(dist_matrix[i][m] for m in medoids)
        total += min_dist
    return total


# ============================================================
# 4. TINH THONG KE DE DOI CHIEU LUAN VAN
# ============================================================

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
    
    return {
        'label': label,
        'n_samples': n,
        'mean_vector': mean_vec,
        'avg_std': avg_std,
    }


# ============================================================
# 5. XUAT FILE TYPESCRIPT
# ============================================================

def generate_typescript(point_samples, peace_samples, stats, output_path):
    """Xuat (append) file golden-dataset.ts tu cac mau da chon."""
    
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
    
    ts_lines = []
    
    # Point samples
    ts_lines.append("  // --- 1 NGON TAY (Bổ sung từ K-Medoids) ---")
    for features in point_samples:
        ts_lines.append('  {')
        ts_lines.append("    expectedLabel: '1 Ng\u00f3n Tay \u261d\ufe0f',")
        ts_lines.append('    features: [')
        ts_lines.append(format_features(features))
        ts_lines.append('    ]')
        ts_lines.append('  },')
    
    ts_lines.append('')
    
    # Peace samples
    ts_lines.append("  // --- 2 NGON TAY (Bổ sung từ K-Medoids) ---")
    for idx, features in enumerate(peace_samples):
        ts_lines.append('  {')
        ts_lines.append("    expectedLabel: '2 Ng\u00f3n Tay \u270c\ufe0f',")
        ts_lines.append('    features: [')
        ts_lines.append(format_features(features))
        ts_lines.append('    ]')
        if idx < len(peace_samples) - 1:
            ts_lines.append('  },')
        else:
            ts_lines.append('  }')
    
    append_content = '\n'.join(ts_lines)
    
    # Read existing file and inject before '];'
    if os.path.exists(output_path):
        with open(output_path, 'r', encoding='utf-8') as f:
            existing_content = f.read()
        
        # Add a trailing comma to the last existing item if needed
        # We find the last closing brace before ];
        insert_idx = existing_content.rfind('];')
        if insert_idx != -1:
            # Check if there is a comma before ]; (roughly)
            # Actually just replacing '];' with ',\n' + append_content + '\n];'
            # But the last element might not have a comma
            pre_content = existing_content[:insert_idx].rstrip()
            if not pre_content.endswith(','):
                pre_content += ','
            
            new_content = pre_content + '\n' + append_content + '\n];\n'
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            return
            
    print("ERROR: Could not find existing golden-dataset.ts to append to!")
    sys.exit(1)


# ============================================================
# MAIN
# ============================================================

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, 'gesture_landmarks.csv')
    output_path = os.path.join(script_dir, '..', 'client', 'src', 'lib', 'golden-dataset.ts')
    
    # Kiem tra file CSV ton tai
    if not os.path.exists(csv_path):
        print('=' * 60)
        print('ERROR: Khong tim thay file gesture_landmarks.csv!')
        print('Huong dan:')
        print('  1. Truy cap: https://www.kaggle.com/datasets/youssefelebiary/hand-gesture-landmarks')
        print('  2. Nhan "Download"')
        print('  3. Giai nen file ZIP')
        print('  4. Dat file gesture_landmarks.csv vao: %s' % script_dir)
        print('=' * 60)
        sys.exit(1)
    
    print('=' * 60)
    print('Dang chuyen doi du lieu Kaggle -> Golden Test Dataset...')
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
        marker = ' <-- SU DUNG' if g in ('point', 'peace') else ''
        print('    - %s: %d mau%s' % (g, count, marker))
    
    # Buoc 2: Loc va chuan hoa
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
    
    if len(point_features) < 5 or len(peace_features) < 5:
        print('ERROR: Khong du mau! Can it nhat 5 mau cho moi cu chi.')
        sys.exit(1)
    
    # Buoc 3: Tinh thong ke
    print('')
    print('[Buoc 3] Tinh thong ke...')
    point_stats = compute_statistics(point_features, 'point')
    peace_stats = compute_statistics(peace_features, 'peace')
    print('  Point - So mau: %d, Do lech chuan TB: %.4f' % (point_stats['n_samples'], point_stats['avg_std']))
    print('  Peace - So mau: %d, Do lech chuan TB: %.4f' % (peace_stats['n_samples'], peace_stats['avg_std']))
    
    # Buoc 4: Chon mau dai dien bang K-Medoids
    print('')
    print('[Buoc 4] Chon 20 mau dai dien bang K-Medoids...')
    point_indices = select_representative_samples(point_features, n_samples=20)
    peace_indices = select_representative_samples(peace_features, n_samples=20)
    
    selected_point = [point_features[i] for i in point_indices]
    selected_peace = [peace_features[i] for i in peace_indices]
    
    print('  Da chon mau point tai indices: %s' % str(point_indices))
    print('  Da chon mau peace tai indices: %s' % str(peace_indices))
    
    # Tinh khoang cach trung binh giua cac mau da chon
    def avg_inter_distance(samples):
        total = 0
        count = 0
        for i in range(len(samples)):
            for j in range(i + 1, len(samples)):
                total += euclidean_distance(samples[i], samples[j])
                count += 1
        return total / count if count > 0 else 0
    
    print('  Khoang cach TB giua cac mau point da chon: %.4f' % avg_inter_distance(selected_point))
    print('  Khoang cach TB giua cac mau peace da chon: %.4f' % avg_inter_distance(selected_peace))
    
    # Buoc 5: Xuat TypeScript
    print('')
    print('[Buoc 5] Xuat file golden-dataset.ts...')
    
    stats_dict = {
        'total_point': point_stats['n_samples'],
        'total_peace': peace_stats['n_samples'],
        'std_point': '%.4f' % point_stats['avg_std'],
        'std_peace': '%.4f' % peace_stats['avg_std'],
    }
    
    generate_typescript(selected_point, selected_peace, stats_dict, output_path)
    
    output_abs = os.path.abspath(output_path)
    print('  OK - Da xuat thanh cong: %s' % output_abs)
    
    # Tong ket
    print('')
    print('=' * 60)
    print('CHUYEN DOI HOAN TAT!')
    print('=' * 60)
    print('')
    print('Tom tat:')
    print('  - Nguon du lieu: Kaggle "Hand Gesture Landmarks" (Youssef Elebiary)')
    print('  - Tong mau goc: %d point + %d peace' % (point_stats['n_samples'], peace_stats['n_samples']))
    print('  - Mau da chon: 20 point (1 ngon) + 20 peace (2 ngon) = 40 mau')
    print('  - Thuat toan chon mau: K-Medoids')
    print('  - Chuan hoa: normalizeHandKeypoints() (wrist->origin, scale by max dist)')
    print('  - Output: %s' % output_abs)
    print('')
    print('Tai lieu tham khao:')
    print('  [1] Elebiary, Y. (2025). Hand Gesture Landmarks [Dataset]. Kaggle.')
    print('      https://www.kaggle.com/datasets/youssefelebiary/hand-gesture-landmarks')
    print('  [2] Zhang, F. et al. (2020). MediaPipe Hands: On-device Real-time Hand')
    print('      Tracking. arXiv:2006.10214. https://arxiv.org/abs/2006.10214')
    print('  [3] Cover, T., & Hart, P. (1967). Nearest neighbor pattern classification.')
    print('      IEEE Trans. Information Theory, 13(1), 21-27.')


if __name__ == '__main__':
    main()
