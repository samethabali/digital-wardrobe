import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export { cloudinary };

// Cloudinary public_id helper
export function getPublicIdFromUrl(url: string): string | null {
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;

    let publicIdWithExtension = parts[1];
    if (publicIdWithExtension.startsWith('v')) {
      const slashIndex = publicIdWithExtension.indexOf('/');
      if (slashIndex !== -1) {
        publicIdWithExtension = publicIdWithExtension.substring(slashIndex + 1);
      }
    }

    if (publicIdWithExtension.includes('digital_wardrobe/')) {
      const idx = publicIdWithExtension.indexOf('digital_wardrobe/');
      publicIdWithExtension = publicIdWithExtension.substring(idx);
    }

    const dotIndex = publicIdWithExtension.lastIndexOf('.');
    if (dotIndex !== -1) {
      return publicIdWithExtension.substring(0, dotIndex);
    }
    return publicIdWithExtension;
  } catch (e) {
    console.error('[Cloudinary] Extract public_id error:', e);
    return null;
  }
}

// Yalnızca kullanıcının kendi Cloudinary klasöründeki görselin public_id'sini döndürür.
// Silme işlemleri bunu kullanır; böylece başka bir kullanıcının görseline işaret eden bir kayıt,
// o kullanıcının görselini sildiremez.
export function getOwnedPublicId(url: string | undefined | null, userId: string): string | null {
  if (!url) return null;
  const publicId = getPublicIdFromUrl(url);
  return publicId && publicId.startsWith(`digital_wardrobe/${userId}/`) ? publicId : null;
}

// Sunucu yalnızca kendi Cloudinary hesabımızdaki görselleri indirebilir (SSRF koruması):
// aksi halde veritabanındaki bir URL üzerinden sunucuya rastgele adresler çektirilebilir.
export function isOwnCloudinaryUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      parsed.hostname === 'res.cloudinary.com' &&
      parsed.pathname.startsWith(`/${process.env.CLOUDINARY_CLOUD_NAME}/`);
  } catch {
    return false;
  }
}

/** Cloudinary görsel adresine dönüşüm ekler (ör. "f_png,w_768"); mevcut dönüşümlerin yerine geçer. */
export function withTransformation(url: string, transformation: string): string {
  const [prefix, rest] = url.split('/upload/');
  if (!rest) return url;
  // Mevcut dönüşüm segmentini (sürümden ya da klasörden önceki kısım) atla
  const segments = rest.split('/');
  const firstIsTransform = segments[0] && !/^v\d+$/.test(segments[0]) && segments[0].includes('_') && !segments[0].startsWith('digital_wardrobe');
  const remaining = firstIsTransform ? segments.slice(1) : segments;
  return `${prefix}/upload/${transformation}/${remaining.join('/')}`;
}

type ImageFetcher = (url: string) => Promise<{ ok: boolean; headers: { get(name: string): string | null }; arrayBuffer(): Promise<ArrayBuffer> }>;
let imageFetcher: ImageFetcher = (url) => fetch(url, { signal: AbortSignal.timeout(10_000) });

export function setImageFetcherForTests(fake: ImageFetcher | null) {
  imageFetcher = fake || ((url) => fetch(url, { signal: AbortSignal.timeout(10_000) }));
}

/** Kendi Cloudinary hesabımızdaki bir görseli base64 olarak indirir; başka adresleri reddeder. */
export async function downloadOwnImage(url: string): Promise<{ base64: string; mimeType: string; buffer: Buffer } | null> {
  if (!isOwnCloudinaryUrl(url)) {
    console.warn('[Cloudinary] Kendi hesabımız dışındaki görsel adresi reddedildi:', url);
    return null;
  }
  try {
    const response = await imageFetcher(url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return { base64: buffer.toString('base64'), mimeType: response.headers.get('content-type') || 'image/jpeg', buffer };
  } catch (e) {
    console.error('[Cloudinary] Görsel indirilemedi:', e);
    return null;
  }
}
