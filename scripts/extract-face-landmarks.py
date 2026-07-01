"""
Script trich xuat Golden Face Dataset tu bo du lieu FER-2013 (Kaggle)
bang MediaPipe FaceLandmarker (Tasks API).

TAI LIEU THAM KHAO:
  - Bo du lieu: FER-2013 (Facial Expression Recognition 2013)
  - Tac gia goc: Pierre-Luc Carrier & Aaron Courville
  - Kaggle: https://www.kaggle.com/datasets/msambare/fer2013
  - Giay phep: Open Database License (ODbL)

Cac cam xuc su dung (3 class):
  1. happy    -> Vui ve (Happy)
  2. sad      -> Buon ba (Sad)
  3. surprise -> Ngac nhien (Surprised)

Luu y: Anh FER-2013 chi 48x48 pixel (grayscale).
Script se upscale len 192x192 va chuyen sang RGB de MediaPipe xu ly tot hon.
"""

import os
import sys
import math
import random
import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from datetime import datetime

# ============================================================
# 1. CHUAN HOA TOA DO MAT (468 diem) - KHOP VOI normalizeFaceFeatures TRONG knn-classifier.ts
# ============================================================
def normalize_face_landmarks(landmarks):
    """
    Chuan hoa 468 diem khuon mat:
    1. Tinh tien chop mui (diem index 1) ve goc toa do (0, 0).
    2. Chia cho khoang cach lon nhat de scale ve pham vi [-1, 1].
    Ket qua: vector 936 phan tu (468 diem x 2 toa do).
    """
    # 478 points might be returned, but we only use the first 468 points for consistency
    if len(landmarks) > 468:
        landmarks = landmarks[:468]

    nose_tip = landmarks[1]
    translated = [(lm[0] - nose_tip[0], lm[1] - nose_tip[1]) for lm in landmarks]
    
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
# 2. XU LY ANH FER-2013 BANG MEDIAPIPE
# ============================================================
def process_fer2013(dataset_dir, script_dir):
    """
    Doc anh tu thu muc FER-2013, upscale 48x48 -> 192x192,
    chay MediaPipe FaceLandmarker de trich xuat diem toa do.
    """
    model_path = os.path.join(script_dir, 'face_landmarker.task')
    if not os.path.exists(model_path):
        print(f"Khong tim thay model tai {model_path}!")
        return []

    base_options = python.BaseOptions(model_asset_path=model_path)
    options = vision.FaceLandmarkerOptions(
        base_options=base_options,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
        num_faces=1,
        min_face_detection_confidence=0.3,
        min_face_presence_confidence=0.3
    )
    detector = vision.FaceLandmarker.create_from_options(options)
    
    # 3 cam xuc phu hop cho tre em
    target_classes = {
        'happy': ('class_1', 'Vui ve (Happy)'),
        'sad': ('class_2', 'Buon ba (Sad)'),
        'surprise': ('class_3', 'Ngac nhien (Surprised)'),
    }
    
    dataset = []
    
    for emotion, (class_id, class_label) in target_classes.items():
        emotion_dir = os.path.join(dataset_dir, 'train', emotion)
        if not os.path.isdir(emotion_dir):
            print(f"  CANH BAO: Khong tim thay thu muc {emotion_dir}")
            continue
            
        all_images = [f for f in os.listdir(emotion_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
        random.seed(42)  # Dam bao ket qua lap lai duoc (reproducible)
        random.shuffle(all_images)
        
        print(f"  {emotion}: {len(all_images)} anh co san. Dang tim 30 anh co the detect duoc mat...")
        
        successful_samples = []
        attempted = 0
        
        for img_name in all_images:
            if len(successful_samples) >= 30:  # Thu thap 30 mau, sau do chon 5 tot nhat
                break
                
            attempted += 1
            img_path = os.path.join(emotion_dir, img_name)
            
            # Doc anh
            image = cv2.imread(img_path)
            if image is None:
                continue
            
            # FER-2013 la grayscale 48x48, can upscale va chuyen sang RGB
            if len(image.shape) == 2 or image.shape[2] == 1:
                image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
            
            # Upscale len 192x192 (x4) de MediaPipe xu ly tot hon
            image = cv2.resize(image, (192, 192), interpolation=cv2.INTER_CUBIC)
            
            # Chay MediaPipe FaceLandmarker
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_image)
            
            detection_result = detector.detect(mp_image)
            
            if not detection_result.face_landmarks:
                continue
                
            landmarks = detection_result.face_landmarks[0]
            pts = [(lm.x, lm.y) for lm in landmarks]
            
            if len(pts) < 468:
                continue
                
            normalized = normalize_face_landmarks(pts)
            successful_samples.append({
                'features': normalized,
                'img_name': img_name
            })
        
        print(f"    -> Detect duoc {len(successful_samples)} mat tu {attempted} anh da thu.")
        
        if len(successful_samples) < 5:
            print(f"    CANH BAO: Chi detect duoc {len(successful_samples)} mat cho {emotion}!")
            
        # Chon 5 mau dai dien bang K-Medoids
        if len(successful_samples) > 5:
            selected = select_representative_samples(successful_samples, n_samples=20)
        else:
            selected = successful_samples
            
        dataset.append((class_id, emotion, [s['features'] for s in selected]))
        print(f"    -> Da chon {len(selected)} mau dai dien cho {emotion}.")
        
    return dataset

# ============================================================
# 3. CHON MAU DAI DIEN BANG K-MEDOIDS
# ============================================================
def euclidean_distance(a, b):
    return math.sqrt(sum((ai - bi) ** 2 for ai, bi in zip(a, b)))

def select_representative_samples(samples_list, n_samples=5):
    """Chon n_samples mau dai dien nhat bang thuat toan K-Medoids."""
    features_list = [s['features'] for s in samples_list]
    n = len(features_list)
    
    if n <= n_samples:
        return samples_list
    
    # Tinh ma tran khoang cach
    dist_matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            d = euclidean_distance(features_list[i], features_list[j])
            dist_matrix[i][j] = d
            dist_matrix[j][i] = d
            
    # Chon medoid dau tien (diem gan trung tam nhat)
    total_dists = [sum(dist_matrix[i]) for i in range(n)]
    medoids = [total_dists.index(min(total_dists))]
    
    # Chon cac medoid tiep theo (xa nhat voi cac medoid da chon)
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
        
    return [samples_list[i] for i in sorted(medoids)]

# ============================================================
# 4. XUAT FILE TYPESCRIPT
# ============================================================
def generate_typescript(selected_samples, output_path):
    now = datetime.now().strftime('%Y-%m-%d')
    
    ts_lines = []
    ts_lines.append("import { GoldenTestSample } from './golden-dataset';")
    ts_lines.append('')
    ts_lines.append('/**')
    ts_lines.append(' * Golden Face Dataset - Du lieu kiem thu cho chuc nang Teach Face')
    ts_lines.append(' *')
    ts_lines.append(' * NGUON DU LIEU: FER-2013 (Facial Expression Recognition 2013) - Kaggle')
    ts_lines.append(' * Tac gia goc: Pierre-Luc Carrier & Aaron Courville')
    ts_lines.append(' * URL: https://www.kaggle.com/datasets/msambare/fer2013')
    ts_lines.append(' * Giay phep: Open Database License (ODbL)')
    ts_lines.append(' *')
    ts_lines.append(' * Quy trinh trich xuat:')
    ts_lines.append(' *   1. Doc anh 48x48 tu FER-2013 (grayscale)')
    ts_lines.append(' *   2. Upscale len 192x192, chuyen sang RGB')
    ts_lines.append(' *   3. Chay Google MediaPipe FaceLandmarker de trich xuat 468 diem toa do')
    ts_lines.append(' *   4. Chuan hoa: tinh tien chop mui ve goc, chia cho khoang cach lon nhat')
    ts_lines.append(' *   5. Chon 5 mau dai dien moi class bang thuat toan K-Medoids')
    ts_lines.append(' *')
    ts_lines.append(' * Cac nhan su dung:')
    ts_lines.append(' *   - class_1 -> Vui ve (Happy)')
    ts_lines.append(' *   - class_2 -> Buon ba (Sad)')
    ts_lines.append(' *   - class_3 -> Ngac nhien (Surprised)')
    ts_lines.append(' *')
    ts_lines.append(' * Moi vector chua 936 phan tu = 468 diem x 2 toa do (x, y) chuan hoa')
    ts_lines.append(' *')
    ts_lines.append(' * Ngay tao: %s' % now)
    ts_lines.append(' */')
    ts_lines.append('export const GOLDEN_FACE_DATASET: GoldenTestSample[] = [')
    
    def format_features(features):
        lines = []
        for i in range(0, len(features), 20):
            chunk = features[i:i+20]
            line = ', '.join([str(x) for x in chunk])
            if i + 20 < len(features):
                line += ','
            lines.append('      ' + line)
        return '\n'.join(lines)
    
    total_classes = len(selected_samples)
    current_idx = 0
    
    for class_id, label, samples in selected_samples:
        ts_lines.append(f'  // --- {label} ({class_id}) ---')
        for idx, features in enumerate(samples):
            ts_lines.append('  {')
            ts_lines.append(f"    expectedLabel: '{class_id}',")
            ts_lines.append('    features: [')
            ts_lines.append(format_features(features))
            ts_lines.append('    ]')
            
            is_last = (current_idx == total_classes - 1 and idx == len(samples) - 1)
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
    dataset_dir = os.path.join(script_dir, '..', 'dataset', 'FER-2013')
    output_path = os.path.join(script_dir, '..', 'client', 'src', 'lib', 'golden-face-dataset.ts')
    
    if not os.path.isdir(dataset_dir):
        print(f'ERROR: Khong tim thay thu muc FER-2013 tai {dataset_dir}!')
        print('Hay dam bao bo du lieu nam tai: dataset/FER-2013/train/{happy,sad,surprise}/')
        sys.exit(1)
    
    print(f'Doc bo du lieu FER-2013 tu: {os.path.abspath(dataset_dir)}')
    dataset = process_fer2013(dataset_dir, script_dir)
    
    if not dataset:
        print('ERROR: Khong trich xuat duoc du lieu nao!')
        sys.exit(1)
    
    print('\nXuat file TypeScript...')
    generate_typescript(dataset, output_path)
    print(f'OK - Da xuat: {os.path.abspath(output_path)}')
    
    total_samples = sum(len(samples) for _, _, samples in dataset)
    print(f'\nTong ket: {total_samples} mau ({len(dataset)} class)')
    for class_id, label, samples in dataset:
        print(f'  {class_id} ({label}): {len(samples)} mau')

if __name__ == '__main__':
    main()
