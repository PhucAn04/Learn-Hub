/**
 * Cloudinary Unsigned Upload Utility
 * 
 * Uploads images AND videos directly from the browser to Cloudinary using unsigned upload.
 * This avoids burdening the backend server with media processing.
 * 
 * Required env vars:
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
 *   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';
const IMAGE_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
const VIDEO_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`;
const RAW_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`;

export function isCloudinaryConfigured(): boolean {
  return !!(CLOUD_NAME && UPLOAD_PRESET && CLOUD_NAME !== 'YOUR_CLOUD_NAME_HERE');
}

/**
 * Upload a single Base64 image to Cloudinary.
 * Returns the secure URL of the uploaded image.
 */
export async function uploadBase64ToCloudinary(
  base64Data: string,
  folder: string = 'learn-hub/datasets'
): Promise<string> {
  if (!isCloudinaryConfigured()) {
    return base64Data;
  }

  const formData = new FormData();
  formData.append('file', base64Data);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);
  // Request high quality
  formData.append('quality', 'auto:best');

  const response = await fetch(IMAGE_UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    console.error('Cloudinary image upload failed:', response.status);
    return base64Data;
  }

  const data = await response.json();
  return data.secure_url;
}

/**
 * Upload a video Blob to Cloudinary.
 * Returns the secure URL of the uploaded video.
 */
export async function uploadVideoToCloudinary(
  videoBlob: Blob,
  folder: string = 'learn-hub/videos',
  onProgress?: (percent: number) => void
): Promise<string | null> {
  if (!isCloudinaryConfigured()) {
    console.log('[Cloudinary] Not configured, cannot upload video');
    return null;
  }

  const formData = new FormData();
  formData.append('file', videoBlob, `video_${Date.now()}.webm`);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);
  formData.append('resource_type', 'video');

  // Use XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', VIDEO_UPLOAD_URL);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data.secure_url);
        } catch {
          reject(new Error('Failed to parse Cloudinary response'));
        }
      } else {
        console.error('Cloudinary video upload failed:', xhr.status, xhr.responseText);
        resolve(null);
      }
    };

    xhr.onerror = () => {
      console.error('Cloudinary video upload network error');
      resolve(null);
    };

    xhr.send(formData);
  });
}

/**
 * Upload a File (image or video) to Cloudinary.
 * Auto-detects resource type from file MIME type.
 */
export async function uploadFileToCloudinary(
  file: File | Blob,
  folder: string = 'learn-hub/uploads',
  onProgress?: (percent: number) => void
): Promise<string | null> {
  if (!isCloudinaryConfigured()) return null;

  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  const uploadUrl = isVideo ? VIDEO_UPLOAD_URL : (isImage ? IMAGE_UPLOAD_URL : RAW_UPLOAD_URL);
  
  const formData = new FormData();
  let fileName = file instanceof File ? file.name : `upload_${Date.now()}`;
  // Cloudinary disallows .bin extension for raw uploads by default. Replace .bin with .json.
  if (fileName.endsWith('.bin')) {
    fileName = fileName.replace(/\.bin$/, '.json');
  }
  formData.append('file', file, fileName);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);

  if (isImage) {
    formData.append('quality', 'auto:best');
  }

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data.secure_url);
        } catch {
          resolve(null);
        }
      } else {
        console.error(`Cloudinary upload failed (${xhr.status}):`, xhr.responseText);
        resolve(null);
      }
    };

    xhr.onerror = () => resolve(null);
    xhr.send(formData);
  });
}

/**
 * Upload TensorFlow.js model JSON & weights blobs to Cloudinary.
 * Returns the secure URLs of the uploaded model.json and model.weights.json.
 */
export async function uploadModelToCloudinary(
  jsonBlob: Blob,
  weightsBlob: Blob,
  challengeType: string = 'teach'
): Promise<{ modelJsonUrl: string | null; modelWeightsUrl: string | null }> {
  if (!isCloudinaryConfigured()) return { modelJsonUrl: null, modelWeightsUrl: null };

  const folder = `learn-hub/models/${challengeType}`;
  const timestamp = Date.now();
  const jsonFile = new File([jsonBlob], `model_${timestamp}.json`, { type: 'application/json' });
  const weightsFile = new File([weightsBlob], `model_${timestamp}.weights.json`, { type: 'application/json' });

  const [modelJsonUrl, modelWeightsUrl] = await Promise.all([
    uploadFileToCloudinary(jsonFile, folder),
    uploadFileToCloudinary(weightsFile, folder),
  ]);

  return { modelJsonUrl, modelWeightsUrl };
}

import { StoredSample } from './knn-classifier';

/**
 * Upload all sample thumbnails to Cloudinary in batches.
 * Returns new samples array with thumbnails replaced by Cloudinary URLs.
 */
export async function uploadSamplesToCloudinary(
  samples: StoredSample[],
  challengeType: string,
  onProgress?: (uploaded: number, total: number) => void
): Promise<StoredSample[]> {
  if (!isCloudinaryConfigured()) {
    console.log('[Cloudinary] Not configured, keeping Base64 thumbnails');
    return samples;
  }

  const folder = `learn-hub/${challengeType}`;
  const totalThumbnails = samples.filter(s => s.thumbnail && s.thumbnail.startsWith('data:')).length;
  const totalRawThumbnails = samples.filter(s => s.rawThumbnail && s.rawThumbnail.startsWith('data:')).length;
  const total = totalThumbnails + totalRawThumbnails;
  let uploaded = 0;

  // Process in parallel batches of 5 for speed
  const BATCH_SIZE = 5;
  const result = [...samples];

  for (let i = 0; i < result.length; i += BATCH_SIZE) {
    const batch = result.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (sample, batchIdx) => {
      const idx = i + batchIdx;
      let newSample = { ...sample };
      
      if (sample.thumbnail && sample.thumbnail.startsWith('data:')) {
        try {
          const url = await uploadBase64ToCloudinary(sample.thumbnail, folder);
          newSample.thumbnail = url;
          uploaded++;
        } catch (err) {
          console.error(`[Cloudinary] Failed to upload sample ${idx}:`, err);
        }
      }
      
      if (sample.rawThumbnail && sample.rawThumbnail.startsWith('data:')) {
        try {
          const url = await uploadBase64ToCloudinary(sample.rawThumbnail, folder);
          newSample.rawThumbnail = url;
          uploaded++;
        } catch (err) {
          console.error(`[Cloudinary] Failed to upload raw sample ${idx}:`, err);
        }
      }
      
      result[idx] = newSample;
      onProgress?.(uploaded, total);
    });
    await Promise.all(promises);
  }

  console.log(`[Cloudinary] Uploaded ${uploaded}/${total} images`);
  return result;
}
