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
        features.append(round(x / max_dist, 6))
        features.append(round(y / max_dist, 6))
    
    return features

# ============================================================
# 3. XUAT FILE TYPESCRIPT
# ============================================================

def generate_typescript(samples_dict, output_path):
    def format_features(features):
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
    ts_lines.append("import { GoldenTestSample } from './golden-dataset';")
    ts_lines.append("")
    ts_lines.append("/**")
    ts_lines.append(" * Golden Gestures Dataset - Du lieu kiem thu cho chuc nang Teach Gestures")
    ts_lines.append(" *")
    ts_lines.append(" * NGUON DU LIEU: Kaggle \\"Hand Gesture Landmarks\\" (Youssef Elebiary)")
    ts_lines.append(" * Cac nhan su dung:")
    ts_lines.append(" *   - thumb, thumb_inverted -> Thích (Thumbs Up)")
    ts_lines.append(" *   - close, close_inverted -> Quy?t Tâm (Fist)")
    ts_lines.append(" *   - peace, peace_inverted -> Chi?n Th?ng (Peace) (Kept from original)")
    ts_lines.append(" *   - open, open_inverted  -> Chào B?n (Open Hand)")
    ts_lines.append(" *   - rock, rock_inverted  -> Rock & Roll (Sign of the Horns)")
    ts_lines.append(" *   - point, point_inverted -> Ch? Tay (Point)")
    ts_lines.append(" *")
    ts_lines.append(f" * Ngay cap nhat: {now}")
    ts_lines.append(" */")
    ts_lines.append("export const GOLDEN_GESTURES_DATASET: GoldenTestSample[] = [")
    
    class_labels = {
        'class_1': 'thumb (class_1)',
        'class_2': 'close (class_2)',
        'class_3': 'peace (class_3)',
        'class_4': 'open (class_4)',
        'class_5': 'rock (class_5)',
        'class_6': 'point (class_6)',
    }
    
    for cls_id in ['class_1', 'class_2', 'class_3', 'class_4', 'class_5', 'class_6']:
        samples_in_class = samples_dict.get(cls_id, [])
        if not samples_in_class: continue
        
        ts_lines.append(f"  // --- {class_labels[cls_id]} ---")
        for idx, features in enumerate(samples_in_class):
            ts_lines.append("  {")
            ts_lines.append(f"    expectedLabel: '{cls_id}',")
            ts_lines.append("    features: [")
            ts_lines.append(format_features(features))
            ts_lines.append("    ]")
            ts_lines.append("  },")
    
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
    output_path = os.path.join(script_dir, '..', 'client', 'src', 'lib', 'golden-gestures-dataset.ts')
    
    if not os.path.exists(csv_path):
        print('ERROR: Khong tim thay file gesture_landmarks.csv!')
        sys.exit(1)
        
    all_samples = read_kaggle_csv(csv_path)
    
    mapping = {
        'thumb': 'class_1', 'thumb_inverted': 'class_1',
        'close': 'class_2', 'close_inverted': 'class_2',
        'peace': 'class_3', 'peace_inverted': 'class_3',
        'open': 'class_4', 'open_inverted': 'class_4',
        'rock': 'class_5', 'rock_inverted': 'class_5',
        'point': 'class_6', 'point_inverted': 'class_6',
    }
    
    samples_dict = {}
    total = 0
    for s in all_samples:
        g = s['gesture']
        if g in mapping:
            cls_id = mapping[g]
            features = normalize_hand_keypoints(s['landmarks'])
            if cls_id not in samples_dict:
                samples_dict[cls_id] = []
            samples_dict[cls_id].append(features)
            total += 1
            
    print(f'Total samples processed: {total}')
    
    generate_typescript(samples_dict, output_path)
    print(f'Da xuat file vao: {output_path}')

if __name__ == '__main__':
    main()
