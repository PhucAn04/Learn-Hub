/**
 * Cloudinary Unsigned Upload Utility
 * 
 * Uploads images directly from the browser to Cloudinary using unsigned upload.
 * This avoids burdening the backend server with image processing.
 * 
 * Required env vars:
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
 *   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

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
    // Return the original base64 if Cloudinary is not configured
    return base64Data;
  }

  const formData = new FormData();
  formData.append('file', base64Data);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);

  const response = await fetch(UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    console.error('Cloudinary upload failed:', response.status);
    // Fallback to base64 on error
    return base64Data;
  }

  const data = await response.json();
  return data.secure_url;
}

/**
 * Upload all sample thumbnails to Cloudinary in batches.
 * Returns new samples array with thumbnails replaced by Cloudinary URLs.
 * 
 * Shows progress via optional callback.
 */
export async function uploadSamplesToCloudinary(
  samples: any[],
  challengeType: string,
  onProgress?: (uploaded: number, total: number) => void
): Promise<any[]> {
  if (!isCloudinaryConfigured()) {
    console.log('[Cloudinary] Not configured, keeping Base64 thumbnails');
    return samples;
  }

  const folder = `learn-hub/${challengeType}`;
  const total = samples.filter(s => s.thumbnail && s.thumbnail.startsWith('data:')).length;
  let uploaded = 0;

  // Process in parallel batches of 5 for speed
  const BATCH_SIZE = 5;
  const result = [...samples];

  for (let i = 0; i < result.length; i += BATCH_SIZE) {
    const batch = result.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (sample, batchIdx) => {
      const idx = i + batchIdx;
      if (sample.thumbnail && sample.thumbnail.startsWith('data:')) {
        try {
          const url = await uploadBase64ToCloudinary(sample.thumbnail, folder);
          result[idx] = { ...sample, thumbnail: url };
          uploaded++;
          onProgress?.(uploaded, total);
        } catch (err) {
          console.error(`[Cloudinary] Failed to upload sample ${idx}:`, err);
          // Keep original base64 on failure
        }
      }
    });
    await Promise.all(promises);
  }

  console.log(`[Cloudinary] Uploaded ${uploaded}/${total} images`);
  return result;
}
