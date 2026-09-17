// Arka plan kaldırma maskesinin son işlemi (tarayıcı ve testler ortak kullanır; saf fonksiyonlar).
// Model "fotoğraftaki belirgin nesneyi" ayırır: askı teli, kapı kulbu gibi parçalar da maskede kalabilir.
// İnce bağlantılar erozyonla koparılır, ana parçaya göre küçük kalan bileşenler atılır.

export interface CleanMaskOptions {
  /** Kopacak en kalın bağlantının yarı kalınlığı, görselin uzun kenarına oranla */
  erodeRatio?: number;
  /** En büyük bileşenin bu oranından küçük bileşenler atılır (ayakkabı çifti gibi ayrık parçalar kalır) */
  minComponentRatio?: number;
}

/** Kare pencerede ikili erozyon (ayrılabilir: önce yatay, sonra dikey kayan pencere). */
function erode(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const pass = (src: Uint8Array, horizontal: boolean) => {
    const out = new Uint8Array(src.length);
    const outer = horizontal ? height : width;
    const inner = horizontal ? width : height;
    const at = (o: number, i: number) => (horizontal ? o * width + i : i * width + o);
    for (let o = 0; o < outer; o++) {
      let count = 0; // penceredeki dolu piksel sayısı
      for (let i = -radius; i < inner + radius; i++) {
        const enter = i + radius;
        if (enter < inner && src[at(o, enter)]) count++;
        const leave = i - radius - 1;
        if (leave >= 0 && src[at(o, leave)]) count--;
        if (i >= 0 && i < inner) {
          // Görsel kenarının dışı dolu sayılır: kenara değen parça kenardan yenmesin
          const lo = Math.max(0, i - radius), hi = Math.min(inner - 1, i + radius);
          const outside = (2 * radius + 1) - (hi - lo + 1);
          out[at(o, i)] = count + outside === 2 * radius + 1 ? 1 : 0;
        }
      }
    }
    return out;
  };
  return pass(pass(mask, true), false);
}

/** Kare pencerede ikili genişletme. */
function dilate(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const inverted = mask.map(v => (v ? 0 : 1));
  // Kenar dışı "dolu" sayıldığı için tersin erozyonunda kenar dışı boş kabul edilir: sonuç kenarda da doğru olur
  return erode(inverted, width, height, radius).map(v => (v ? 0 : 1));
}

/** 4-komşulu bağlı bileşen etiketleri ve alanları. */
function components(mask: Uint8Array, width: number, height: number): { labels: Int32Array; areas: number[] } {
  const labels = new Int32Array(mask.length);
  const areas: number[] = [0];
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    const label = areas.length;
    let area = 0;
    labels[start] = label;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop()!;
      area++;
      const x = p % width;
      const neighbors = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width];
      for (const n of neighbors) {
        if (n >= 0 && n < mask.length && mask[n] && !labels[n]) {
          labels[n] = label;
          stack.push(n);
        }
      }
    }
    areas.push(area);
  }
  return { labels, areas };
}

/**
 * RGBA verisinin alfa kanalını yerinde temizler: ince teller ve ana parçadan kopuk küçük nesneler şeffaf olur.
 * Maske tamamen boşsa veya temizlik her şeyi silecekse alfa değiştirilmez.
 */
export function cleanCutoutAlpha(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, options: CleanMaskOptions = {}): void {
  const size = width * height;
  const binary = new Uint8Array(size);
  for (let i = 0; i < size; i++) binary[i] = rgba[i * 4 + 3] >= 128 ? 1 : 0;

  const radius = Math.max(2, Math.round(Math.max(width, height) * (options.erodeRatio ?? 0.008)));
  const eroded = erode(binary, width, height, radius);
  const { labels, areas } = components(eroded, width, height);
  const largest = Math.max(0, ...areas);
  if (largest === 0) return;

  const minArea = largest * (options.minComponentRatio ?? 0.2);
  const keep = new Uint8Array(size);
  for (let i = 0; i < size; i++) keep[i] = labels[i] && areas[labels[i]] >= minArea ? 1 : 0;

  // Erozyonda kaybolan kenarları geri kazanmak için biraz fazlası kadar genişletilir
  const region = dilate(keep, width, height, radius + 2);
  for (let i = 0; i < size; i++) {
    if (!region[i]) rgba[i * 4 + 3] = 0;
  }
}

/** Görünür piksellerin sınır kutusu (dolgu payıyla); görünür piksel yoksa null. */
export function alphaBounds(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, padRatio = 0.04): { x: number; y: number; width: number; height: number } | null {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * padRatio);
  const x = Math.max(0, x0 - pad), y = Math.max(0, y0 - pad);
  return { x, y, width: Math.min(width, x1 + pad + 1) - x, height: Math.min(height, y1 + pad + 1) - y };
}
