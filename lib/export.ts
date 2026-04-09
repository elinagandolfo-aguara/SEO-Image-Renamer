import type { ProcessedImage } from './types';

export function buildCsvContent(images: ProcessedImage[]): string {
  const header = 'archivo,alt_text';
  const rows = images
    .filter(img => img.result)
    .map(img => `${img.result!.filename}.jpg,"${img.result!.alt}"`);
  return [header, ...rows].join('\n');
}

export function buildZipFilename(brand: string): string {
  const slug = brand.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `seo-images-${slug}-${date}-${hh}h${mm}.zip`;
}

export async function imageToJpegBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        blob => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        },
        'image/jpeg',
        1.0,
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

export async function downloadZip(images: ProcessedImage[], brand: string): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const folder = zip.folder('seo-images')!;

  for (const img of images) {
    if (!img.result) continue;
    const blob = await imageToJpegBlob(img.file);
    folder.file(`${img.result.filename}.jpg`, blob);
  }

  zip.file('alt-text.csv', buildCsvContent(images));

  const content = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(content);
  a.download = buildZipFilename(brand);
  a.click();
  URL.revokeObjectURL(a.href);
}
