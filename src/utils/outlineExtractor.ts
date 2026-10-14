/**
 * Advanced Ultra-Clean Outline & Contour Extractor for AR Paper Tracing.
 * 
 * Features:
 * 1. extractColorlessOutline (AI Outline):
 *    - Strips ALL fills, skin tones, hair colors, clothes colors, and shading completely.
 *    - Leaves ONLY pure, high-contrast black/charcoal contour line-art with 100% transparent background.
 *    - Handles both vector SVGs (built-in anime/animal templates) and bitmap photos (user gallery uploads).
 * 
 * 2. extractSketchOutline:
 *    - Generates soft graphite pencil sketch lines.
 */

export function stripColorsFromSvg(svgDataUrlOrXml: string): string {
  try {
    let svgContent = svgDataUrlOrXml;
    const isDataUrl = svgDataUrlOrXml.startsWith('data:image/svg+xml');

    if (isDataUrl) {
      if (svgDataUrlOrXml.includes('utf8,')) {
        svgContent = decodeURIComponent(svgDataUrlOrXml.split('utf8,')[1]);
      } else if (svgDataUrlOrXml.includes('base64,')) {
        svgContent = atob(svgDataUrlOrXml.split('base64,')[1]);
      }
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svgElem = doc.querySelector('svg');
    if (!svgElem) return svgDataUrlOrXml;

    // Remove background rects
    const allRects = svgElem.querySelectorAll('rect');
    allRects.forEach((rect) => {
      const width = rect.getAttribute('width');
      const height = rect.getAttribute('height');
      if (width === '100%' || width === '420' || width === '500' || width === '290' || (height && height.includes('100%'))) {
        rect.remove();
      }
    });

    // Convert all shapes to crisp outlines
    const drawableTags = ['path', 'circle', 'ellipse', 'polygon', 'polyline', 'rect', 'line'];
    drawableTags.forEach((tag) => {
      const elements = svgElem.querySelectorAll(tag);
      elements.forEach((el) => {
        el.setAttribute('fill', 'none');
        const currentStroke = el.getAttribute('stroke');
        if (!currentStroke || currentStroke === 'none' || currentStroke !== '#ffffff') {
          el.setAttribute('stroke', '#0c0c14');
        }
        const sw = parseFloat(el.getAttribute('stroke-width') || '2.8');
        el.setAttribute('stroke-width', String(Math.max(2, Math.min(sw, 4.5))));
        el.setAttribute('stroke-linecap', 'round');
        el.setAttribute('stroke-linejoin', 'round');
      });
    });

    const serializer = new XMLSerializer();
    const newSvgStr = serializer.serializeToString(svgElem);
    return `data:image/svg+xml;utf8,${encodeURIComponent(newSvgStr)}`;
  } catch (err) {
    console.warn('SVG color stripping failed:', err);
    return svgDataUrlOrXml;
  }
}

export async function extractColorlessOutline(imageSrc: string): Promise<string> {
  if (imageSrc.includes('<svg') || imageSrc.startsWith('data:image/svg+xml')) {
    return stripColorsFromSvg(imageSrc);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxDim = 900;
        let w = img.width || 600;
        let h = img.height || 600;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        // Draw white background then image for clean contrast
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // Grayscale luminance
        const gray = new Float32Array(w * h);
        for (let i = 0; i < data.length; i += 4) {
          const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          gray[i / 4] = l;
        }

        // Canny / Sobel Edge Detection with optimized thresholding for manga & characters
        const output = ctx.createImageData(w, h);
        const outData = output.data;

        const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

        const gradMap = new Float32Array(w * h);
        let sumMag = 0;
        let count = 0;

        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            let px = 0;
            let py = 0;
            let k = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const val = gray[(y + dy) * w + (x + dx)];
                px += val * sobelX[k];
                py += val * sobelY[k];
                k++;
              }
            }
            const mag = Math.hypot(px, py);
            gradMap[y * w + x] = mag;
            sumMag += mag;
            count++;
          }
        }

        const avgMag = count > 0 ? sumMag / count : 25;
        const threshold = Math.max(16, avgMag * 0.55);

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const mag = gradMap[y * w + x] || 0;

            if (mag > threshold) {
              const strength = Math.min(1.0, (mag - threshold) / 50);
              const alpha = Math.round(200 + strength * 55);

              outData[idx] = 10;       // R: deep black ink
              outData[idx + 1] = 10;   // G
              outData[idx + 2] = 15;   // B
              outData[idx + 3] = alpha; // Solid stroke
            } else {
              // 100% Transparent background and color fill
              outData[idx] = 255;
              outData[idx + 1] = 255;
              outData[idx + 2] = 255;
              outData[idx + 3] = 0;
            }
          }
        }

        ctx.putImageData(output, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(imageSrc);
      }
    };

    img.onerror = () => {
      resolve(imageSrc);
    };

    img.src = imageSrc;
  });
}

export async function extractSketchOutline(imageSrc: string): Promise<string> {
  if (imageSrc.includes('<svg') || imageSrc.startsWith('data:image/svg+xml')) {
    return stripColorsFromSvg(imageSrc);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxDim = 900;
        let w = img.width || 600;
        let h = img.height || 600;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        const gray = new Float32Array(w * h);
        for (let i = 0; i < data.length; i += 4) {
          const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          gray[i / 4] = l;
        }

        const output = ctx.createImageData(w, h);
        const outData = output.data;

        const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            let px = 0;
            let py = 0;
            let k = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const val = gray[(y + dy) * w + (x + dx)];
                px += val * sobelX[k];
                py += val * sobelY[k];
                k++;
              }
            }

            const mag = Math.hypot(px, py);
            const idx = (y * w + x) * 4;

            if (mag > 14) {
              const ink = Math.min(255, Math.round((mag / 50) * 255));
              outData[idx] = 40;       // Graphite pencil gray
              outData[idx + 1] = 40;
              outData[idx + 2] = 48;
              outData[idx + 3] = ink;
            } else {
              outData[idx] = 255;
              outData[idx + 1] = 255;
              outData[idx + 2] = 255;
              outData[idx + 3] = 0;
            }
          }
        }

        ctx.putImageData(output, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(imageSrc);
      }
    };

    img.onerror = () => {
      resolve(imageSrc);
    };

    img.src = imageSrc;
  });
}
