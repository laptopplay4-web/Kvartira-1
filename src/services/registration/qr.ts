import QRCode from 'qrcode';

/**
 * SVG QR for crisp print / screen, wrapped in a data URL.
 *
 * Returning a data URL instead of raw markup keeps the caller on `<img src>`
 * rather than `dangerouslySetInnerHTML`, and an image loaded from a data URL
 * cannot execute script even if the SVG payload were ever tampered with.
 */
export async function renderRegistrationQrSvgDataUrl(
  text: string,
  size = 320,
): Promise<string> {
  const svg = await QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: size,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** PNG data URL for download. */
export async function renderRegistrationQrPngDataUrl(
  text: string,
  size = 1024,
): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: size,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

export function downloadDataUrl(filename: string, dataUrl: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
