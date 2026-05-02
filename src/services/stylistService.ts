import { WardrobeItem, StylistRequest } from "../types";

/**
 * Kombin oluşturma isteğini server-side'a proxy'ler.
 * Gemini API key artık tarayıcıya maruz kalmaz.
 */
export async function generateOutfit(
  wardrobe: WardrobeItem[],
  request: StylistRequest
) {
  const response = await fetch('/api/generate-outfit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: wardrobe, request })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Seçilen görsel dosyasını base64 encode ederek server'a gönderir,
 * Gemini Vision ile analiz ettirir ve sonucu döndürür.
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
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        // "data:image/png;base64,XXXX" → base64 kısmını ayır
        const [meta, base64] = dataUrl.split(',');
        const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';

        const res = await fetch('/api/analyze-image-base64', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64, mimeType })
        });

        if (!res.ok) { resolve(null); return; }
        const data = await res.json();
        resolve(data.analysis);
      } catch {
        resolve(null);
      }
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsDataURL(file);
  });
}
