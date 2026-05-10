import { WardrobeItem, StylistRequest } from "../types";

/**
 * Görsel dosyasını Canvas API ile sıkıştırır.
 * Maksimum genişlik 1280px, kalite %82 JPEG.
 * Gemini Vision analiz kalitesini korurken payload ~10-20x küçülür.
 */
async function compressImageForAnalysis(
  file: File,
  maxWidth = 1280,
  quality = 0.82
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      // PNG dahil hepsini JPEG olarak gönder — analiz için fark etmez, boyut küçülür
      const mimeType = 'image/jpeg';
      const dataUrl = canvas.toDataURL(mimeType, quality);
      const base64 = dataUrl.split(',')[1];
      resolve({ base64, mimeType });
    };

    img.onerror = () => {
      // Canvas başarısız olursa ham FileReader fallback
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const [meta, base64] = dataUrl.split(',');
        const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
        resolve({ base64, mimeType });
      };
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Kombin oluşturma isteğini server-side'a proxy'ler.
 * - signal: Dışarıdan iptal edilebilir (kullanıcı yeni istek başlatırsa)
 * - 45 saniyelik kendi timeout'u var
 */
export async function generateOutfit(
  wardrobe: WardrobeItem[],
  request: StylistRequest,
  signal?: AbortSignal
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000);

  // Dışarıdan gelen signal ile bağla — iptal edilirse bu da iptal olur
  signal?.addEventListener('abort', () => controller.abort());

  try {
    const response = await fetch('/api/generate-outfit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: wardrobe, request }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    return response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err; // AbortError dahil yukarıya ilet
  }
}

/**
 * Seçilen görsel dosyasını sıkıştırıp server'a gönderir,
 * Gemini Vision ile analiz ettirir ve sonucu döndürür.
 * - Canvas API ile ~10-20x sıkıştırma uygulanır
 * - 30 saniyelik timeout uygulanır
 */
export async function analyzeImageFile(file: File): Promise<{
  name: string;
  category: string;
  subCategory: string;
  color: string;
  material: string;
  style: string;
  weatherMatch: string[];
} | null> {
  try {
    // 1) Sıkıştır — mobil kamera fotoğraflarını küçültür, limit sorununu çözer
    const { base64, mimeType } = await compressImageForAnalysis(file);

    // 2) AbortController + 30 sn timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.warn('[Vision] İstek 30 sn içinde yanıt vermedi, iptal edildi.');
    }, 30_000);

    try {
      const res = await fetch('/api/analyze-image-base64', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) return null;
      const data = await res.json();
      return data.analysis;
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr?.name === 'AbortError') {
        console.warn('[Vision] Zaman aşımı nedeniyle iptal edildi.');
      }
      return null;
    }
  } catch {
    return null;
  }
}
