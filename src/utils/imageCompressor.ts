/**
 * High-Definition (Full HD) Client-Side Image Processor & GPS Watermarker for POWER Utility
 * Produces crystal-clear HD photos (up to 1920px, ~0.92 JPEG quality) with a sharp GPS Camera stamp
 * so meter readings, consumer details, and site evidence remain 100% legible in both the app and Google Sheets.
 */

export interface CompressionOptions {
  maxDimension?: number;
  quality?: number;
  watermarkText?: string;
  subText?: string;
  gpsText?: string;
  addressText?: string;
  maxBase64Length?: number;
}

export async function getBrowserGpsCoordinates(timeoutMs = 4500): Promise<{
  lat: number;
  lng: number;
  accuracy?: number;
  formatted: string;
} | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return null;
  }
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy ? Math.round(pos.coords.accuracy) : undefined;
        const latDir = lat >= 0 ? 'N' : 'S';
        const lngDir = lng >= 0 ? 'E' : 'W';
        const formatted = `LAT: ${Math.abs(lat).toFixed(6)}° ${latDir}, LON: ${Math.abs(lng).toFixed(6)}° ${lngDir}${acc ? ` (±${acc}m)` : ''}`;
        resolve({ lat, lng, accuracy: acc, formatted });
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 }
    );
  });
}

export function drawGpsWatermarkOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  info: {
    watermarkText?: string;
    subText?: string;
    gpsText?: string;
    addressText?: string;
  }
) {
  const { watermarkText, subText, gpsText, addressText } = info;
  if (!watermarkText && !subText && !gpsText && !addressText) return;

  const scale = Math.max(0.75, Math.min(2.2, width / 1000));
  const padX = Math.round(16 * scale);
  const padY = Math.round(12 * scale);
  const lineGap = Math.round(6 * scale);

  const lines: { text: string; color: string; font: string }[] = [];

  // Line 1: Header + GPS Badge
  if (watermarkText) {
    lines.push({
      text: watermarkText,
      color: '#fbbf24',
      font: `900 ${Math.round(18 * scale)}px system-ui, -apple-system, sans-serif`
    });
  }

  // Line 2: GPS Coordinates
  if (gpsText) {
    lines.push({
      text: `📍 ${gpsText}`,
      color: '#34d399',
      font: `700 ${Math.round(15 * scale)}px ui-monospace, SFMono-Regular, Menlo, monospace`
    });
  }

  // Line 3: Address / Location if present
  if (addressText) {
    lines.push({
      text: addressText,
      color: '#f8fafc',
      font: `600 ${Math.round(14 * scale)}px system-ui, -apple-system, sans-serif`
    });
  }

  // Line 4: Worker & Timestamp
  if (subText) {
    lines.push({
      text: subText,
      color: '#e2e8f0',
      font: `700 ${Math.round(14 * scale)}px ui-monospace, SFMono-Regular, Menlo, monospace`
    });
  }

  const lineHeight = Math.round(20 * scale);
  const badgeHeight = padY * 2 + lines.length * lineHeight + Math.max(0, lines.length - 1) * lineGap;
  const topY = Math.max(0, height - badgeHeight);

  // Dark semi-transparent gradient banner at bottom
  const grad = ctx.createLinearGradient(0, topY, 0, height);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.84)');
  grad.addColorStop(1, 'rgba(2, 6, 23, 0.94)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, topY, width, badgeHeight);

  // Top accent border line
  ctx.fillStyle = '#10b981';
  ctx.fillRect(0, topY, width, Math.max(2, Math.round(3 * scale)));

  // Top-right "GPS CAMERA HD" pill
  const pillText = 'GPS CAMERA • HD';
  ctx.font = `900 ${Math.round(12 * scale)}px system-ui, -apple-system, sans-serif`;
  const pillTextW = ctx.measureText(pillText).width;
  const pillW = pillTextW + Math.round(20 * scale);
  const pillH = Math.round(24 * scale);
  const pillX = width - pillW - padX;
  const pillY = topY + padY;

  ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
  ctx.fillRect(pillX, pillY, pillW, pillH);
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
  ctx.strokeRect(pillX, pillY, pillW, pillH);
  ctx.fillStyle = '#6ee7b7';
  ctx.textBaseline = 'middle';
  ctx.fillText(pillText, pillX + Math.round(10 * scale), pillY + pillH / 2);

  // Draw text lines
  ctx.textBaseline = 'top';
  let curY = topY + padY;
  for (const item of lines) {
    ctx.font = item.font;
    ctx.fillStyle = item.color;
    ctx.fillText(item.text, padX, curY, width - padX * 2);
    curY += lineHeight + lineGap;
  }
}

export async function compressImageFile(
  file: File | Blob,
  options: CompressionOptions = {}
): Promise<string> {
  // Always enforce HD minimum resolution and quality so Evidence photos are never blurry
  const targetMaxDim = Math.max(options.maxDimension || 1920, 1600);
  const targetQuality = Math.max(options.quality || 0.92, 0.88);
  const maxBase64Length = Math.max(options.maxBase64Length || 2400000, 1800000);
  const { watermarkText, subText, addressText } = options;

  if (!file) {
    return '';
  }

  // Video or PDF files cannot be canvas-compressed directly
  if (file.type && (file.type.startsWith('video/') || file.type === 'application/pdf')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  // Obtain live GPS coordinates if not already passed in options
  let effectiveGpsText = options.gpsText || '';
  if (!effectiveGpsText && (watermarkText || subText)) {
    const gps = await getBrowserGpsCoordinates(2500);
    if (gps) {
      effectiveGpsText = gps.formatted;
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const result = readerEvent.target?.result as string;
      if (!result) {
        resolve('');
        return;
      }

      const img = new Image();
      img.onload = () => {
        const renderAtScale = (dimLimit: number, q: number): string => {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          // Preserve native resolution if smaller than dimLimit, or cap cleanly at dimLimit (HD)
          if (width > height) {
            if (width > dimLimit) {
              height = Math.round((height * dimLimit) / width);
              width = dimLimit;
            }
          } else {
            if (height > dimLimit) {
              width = Math.round((width * dimLimit) / height);
              height = dimLimit;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { alpha: false });

          if (!ctx) {
            return result;
          }

          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          if (watermarkText || subText || effectiveGpsText || addressText) {
            drawGpsWatermarkOnCanvas(ctx, width, height, {
              watermarkText: watermarkText || 'WBSEDCL FIELD EVIDENCE',
              subText,
              gpsText: effectiveGpsText,
              addressText
            });
          }

          return canvas.toDataURL('image/jpeg', q);
        };

        try {
          let curDim = targetMaxDim;
          let curQual = targetQuality;
          let compressedDataUrl = renderAtScale(curDim, curQual);

          let attempts = 0;
          while (compressedDataUrl.length > maxBase64Length && attempts < 4) {
            attempts++;
            curQual = Math.max(0.82, curQual - 0.04);
            curDim = Math.max(1280, Math.round(curDim * 0.88));
            compressedDataUrl = renderAtScale(curDim, curQual);
          }

          resolve(compressedDataUrl);
        } catch {
          resolve(result);
        }
      };

      img.onerror = () => {
        resolve(result);
      };

      img.src = result;
    };

    reader.onerror = (err) => {
      reject(err);
    };

    reader.readAsDataURL(file);
  });
}


