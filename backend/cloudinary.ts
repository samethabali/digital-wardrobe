import { v2 as cloudinary } from 'cloudinary';
import { getCloudinaryCredentials } from './config.js';

// Kimlik bilgileri yalnızca ortam değişkenlerinden okunur; eksikse görsel işlemleri hata verir.
const credentials = getCloudinaryCredentials();
if (credentials) {
  cloudinary.config(credentials);
} else {
  console.warn('[Cloudinary] CLOUDINARY_* ortam değişkenleri tanımlı değil; görsel yükleme ve silme çalışmaz.');
}

export { cloudinary };

/** Cloudinary'nin tek istekte silebildiği en fazla kayıt sayısı. */
export const CLOUDINARY_DELETE_BATCH = 100;

type ImageDeleter = (publicIds: string[]) => Promise<unknown>;
const defaultDeleter: ImageDeleter = (publicIds) => cloudinary.api.delete_resources(publicIds);
let imageDeleter: ImageDeleter = defaultDeleter;

export function setImageDeleterForTests(fake: ImageDeleter | null) {
  imageDeleter = fake || defaultDeleter;
}

/**
 * Görselleri 100'lük gruplar halinde siler. Bir grup başarısız olsa da diğerleri denenir;
 * silinemeyen kimlikler döndürülür (hesap silme bunları loglar, işlemi durdurmaz).
 */
export async function deleteImages(publicIds: string[]): Promise<{ deleted: number; failed: string[] }> {
  const unique = Array.from(new Set(publicIds.filter(Boolean)));
  const failed: string[] = [];
  let deleted = 0;
  for (let i = 0; i < unique.length; i += CLOUDINARY_DELETE_BATCH) {
    const batch = unique.slice(i, i + CLOUDINARY_DELETE_BATCH);
    try {
      await imageDeleter(batch);
      deleted += batch.length;
    } catch (err) {
      console.error('[Cloudinary] Görsel grubu silinemedi:', err);
      failed.push(...batch);
    }
  }
  return { deleted, failed };
}

type ImageUploader = (dataUri: string, options: { folder: string; public_id: string }) => Promise<string>;
const defaultUploader: ImageUploader = async (dataUri, options) => {
  const uploaded = await cloudinary.uploader.upload(dataUri, { ...options, overwrite: true, format: 'png' });
  return uploaded.secure_url;
};
let imageUploader: ImageUploader = defaultUploader;

export function setImageUploaderForTests(fake: ImageUploader | null) {
  imageUploader = fake || defaultUploader;
}

/** PNG görseli kullanıcının klasörüne yükler ve güvenli adresini döndürür. */
export function uploadPng(dataUri: string, options: { folder: string; public_id: string }): Promise<string> {
  return imageUploader(dataUri, options);
}

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
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  if (!cloudName) return false;
  try {
    const parsed = new URL(url);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      parsed.hostname === 'res.cloudinary.com' &&
      parsed.pathname.startsWith(`/${cloudName}/`);
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
