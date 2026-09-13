export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function sanitizeDownloadFilename(filename: string): string {
  const cleaned = filename.replace(/[/\\?%*:|"<>]/g, '_').trim();
  return cleaned || 'download';
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = sanitizeDownloadFilename(filename);
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately cancels the download in many browsers.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000);
}

async function resolveAuthHeader(url: string): Promise<HeadersInit | undefined> {
  try {
    const { getPocketBase } = await import('@/services/api/pocketbase/client');
    const pb = getPocketBase();
    const token = pb.authStore.token;
    if (!token) return undefined;
    const base = pb.baseUrl.replace(/\/$/, '');
    if (!url.startsWith(base)) return undefined;
    return { Authorization: token };
  } catch {
    return undefined;
  }
}

async function urlToBlob(url: string): Promise<Blob> {
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    return res.blob();
  }

  const headers = await resolveAuthHeader(url);
  const res = await fetch(url, {
    method: 'GET',
    mode: 'cors',
    // Signed PB URLs carry `token=` — cookies/credentials often break CORS.
    credentials: 'omit',
    headers,
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res.blob();
}

/** Save a remote/local URL as a file — never opens a new tab / media player. */
export async function downloadFromUrl(url: string, filename: string): Promise<void> {
  const blob = await urlToBlob(url);
  triggerBlobDownload(blob, filename);
}
