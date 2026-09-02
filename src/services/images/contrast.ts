export type ImageTextContrast = 'on-dark' | 'on-light';

export function luminanceFromRgb(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function loadImage(url: string, timeoutMs = 3000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = setTimeout(() => {
      reject(new Error('image load timeout'));
    }, timeoutMs);

    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('image load failed'));
    };
    img.src = url;
  });
}

/**
 * Samples the lower half of an image and picks text palette for readability.
 * Falls back to light-on-dark when CORS or canvas read fails.
 */
export async function detectImageTextContrast(
  imageUrl: string,
  options?: { threshold?: number; loadTimeoutMs?: number },
): Promise<ImageTextContrast> {
  const threshold = options?.threshold ?? 0.55;
  const loadTimeoutMs = options?.loadTimeoutMs ?? 3000;

  try {
    const img = await loadImage(imageUrl, loadTimeoutMs);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 'on-dark';

    const maxSize = 64;
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height, 1));
    canvas.width = Math.max(1, Math.floor(img.width * scale));
    canvas.height = Math.max(1, Math.floor(img.height * scale));

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const startY = Math.floor(canvas.height * 0.5);
    const height = canvas.height - startY;
    const data = ctx.getImageData(0, startY, canvas.width, height).data;

    let total = 0;
    let count = 0;
    const stride = 16;

    for (let i = 0; i < data.length; i += stride) {
      total += luminanceFromRgb(data[i], data[i + 1], data[i + 2]);
      count += 1;
    }

    if (count === 0) return 'on-dark';
    return total / count > threshold ? 'on-light' : 'on-dark';
  } catch {
    return 'on-dark';
  }
}
