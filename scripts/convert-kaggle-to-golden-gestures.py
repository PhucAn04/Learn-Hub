"""
Script chuyen doi bo du lieu Kaggle "Hand Gesture Landmarks" sang dinh dang
Golden Gestures Dataset (TypeScript) cho trang Teach Gestures.

Nguon du lieu:
  - Kaggle: https://www.kaggle.com/datasets/youssefelebiary/hand-gesture-landmarks
  - Tac gia: Youssef Elebiary
  - Giay phep: MIT

Cac cu chi su dung (4 class):
  1. thumb -> Thích (Thumbs Up) 👍
  2. rock  -> Quyết Tâm (Fist) ✊
  3. peace -> Chiến Thắng (Peace) ✌️
  4. open  -> Chào Bạn (Open Hand) ✋
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
    samples = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        label_col = len(header) - 1
        
        for row in reader:
            if len(row) < 64:
                continue
            gesture = row[label_col].strip().lower()
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
# 2. CHUAN HOA DU LIEU
# ============================================================

def normalize_hand_keypoints(landmarks):
    if len(landmarks) < 21:
        return [0.0] * 42
    
    wrist_x, wrist_y = landmarks[0][0], landmarks[0][1]
    translated = [(lm[0] - wrist_x, lm[1] - wrist_y) for lm in landmarks]
    
    max_dist = 0.0001
    for x, y in translated:
        dist = math.sqrt(x * x + y * y)
        if dist > max_dist:
            max_dist = dist
            
    features = []
    for x, y in translated:
        features.append(round(x / max_dist, 4))
        features.append(round(y / max_dist, 4))
    
    return features

# ============================================================
# 3. CHON MAU DAI DIEN BANG K-MEDOIDS
# ============================================================

def euclidean_distance(a, b):
    return math.sqrt(sum((ai - bi) ** 2 for ai, bi in zip(a, b)))

def select_representative_samples(features_list, n_samples=5):
    n = len(features_list)
    if n <= n_samples:
        return list(range(n))
    
    dist_matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            d = euclidean_distance(features_list[i], features_list[j])
            dist_matrix[i][j] = d
            dist_matrix[j][i] = d
            
    total_dists = [sum(dist_matrix[i]) for i in range(n)]
    medoids = [total_dists.index(min(total_dists))]
    
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
        
    return sorted(medoids)

# ============================================================
# 4. XUAT FILE TYPESCRIPT
# ============================================================

def generate_typescript(selected_samples, output_path):
    now = datetime.now().strftime('%Y-%m-%d')
    
    ts_lines = []
    ts_lines.append("import { GoldenTestSample } from './golden-dataset';")
    ts_lines.append('')
    ts_lines.append('/**')
    ts_lines.append(' * Golden Gestures Dataset - Du lieu kiem thu cho chuc nang Teach Gestures')
    ts_lines.append(' *')
    ts_lines.append(' * NGUON DU LIEU: Kaggle "Hand Gesture Landmarks" (Youssef Elebiary)')
    ts_lines.append(' * Cac nhan su dung:')
    ts_lines.append(' *   - thumb -> Thích (Thumbs Up)')
    ts_lines.append(' *   - rock  -> Quyết Tâm (Fist)')
    ts_lines.append(' *   - peace -> Chiến Thắng (Peace)')
    ts_lines.append(' *   - open  -> Chào Bạn (Open Hand)')
    ts_lines.append(' *')
    ts_lines.append(' * Ngay tao: %s' % now)
    ts_lines.append(' */')
    ts_lines.append('export const GOLDEN_GESTURES_DATASET: GoldenTestSample[] = [')
    
    def format_features(features):
        lines = []
        for i in range(0, 42, 8):
            chunk = features[i:i+8]
            line = ', '.join([str(x) for x in chunk])
            if i + 8 < 42:
                line += ','
            lines.append('      ' + line)
        return '\n'.join(lines)
    
    total_gestures = len(selected_samples)
    current_idx = 0
    
    for class_id, label, samples in selected_samples:
        ts_lines.append(f'  // --- {label} ({class_id}) ---')
        for idx, features in enumerate(samples):
            ts_lines.append('  {')
            ts_lines.append(f"    expectedLabel: '{class_id}',")
            ts_lines.append('    features: [')
            ts_lines.append(format_features(features))
            ts_lines.append('    ]')
            
            is_last = (current_idx == total_gestures - 1 and idx == len(samples) - 1)
            if is_last:
                ts_lines.append('  }')
            else:
                ts_lines.append('  },')
        ts_lines.append('')
        current_idx += 1
        
    ts_lines.append('];')
    ts_lines.append('')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(ts_lines))

# ============================================================
# MAIN
# ============================================================

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, 'gesture_landmarks.csv')
    output_path = os.path.join(script_dir, '..', 'client', 'src', 'lib', 'golden-gestures-dataset.ts')
    
    if not os.path.exists(csv_path):
        print('ERROR: Khong tim thay file gesture_landmarks.csv!')
        sys.exit(1)
        
    print('Doc file CSV...')
    all_samples = read_kaggle_csv(csv_path)
    
    target_classes = {
        'thumb': 'class_1', # Thích (Thumbs Up)
        'rock': 'class_2',  # Quyết Tâm (Fist)
        'peace': 'class_3', # Chiến Thắng (Peace)
        'open': 'class_4'   # Chào Bạn (Open Hand)
    }
    
    features_by_class = {k: [] for k in target_classes}
    
    for s in all_samples:
        g = s['gesture']
        if g in target_classes:
            features_by_class[g].append(normalize_hand_keypoints(s['landmarks']))
            
    selected_samples = []
    
    for g, class_id in target_classes.items():
        feats = features_by_class[g]
        print(f'{g}: co {len(feats)} mau. Chon 20 mau dai dien...')
        indices = select_representative_samples(feats, n_samples=20)
        selected = [feats[i] for i in indices]
        selected_samples.append((class_id, g, selected))
        
    print('Xuat file TypeScript...')
    generate_typescript(selected_samples, output_path)
    print('OK - Da xuat', os.path.abspath(output_path))

if __name__ == '__main__':
    main()
