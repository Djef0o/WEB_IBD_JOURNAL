/**
 * Réduction des photos de repas avant stockage : côté le plus long ≤ 1280 px, WebP (JPEG si le
 * navigateur ne sait pas encoder en WebP). Aucune donnée ne quitte le navigateur.
 */
export const MAX_PHOTO_SIDE = 1280;
export const PHOTO_QUALITY = 0.82;

export interface Size {
  width: number;
  height: number;
}

/** Dimensions réduites pour tenir dans `max` px sur le côté le plus long ; jamais d'agrandissement. */
export function fitWithin(width: number, height: number, max: number = MAX_PHOTO_SIDE): Size {
  if (!(width > 0) || !(height > 0)) throw new RangeError(`Invalid image size: ${width}x${height}`);
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Types d'encodage essayés dans l'ordre ; le premier dont le Blob obtenu a bien ce type est retenu. */
export const ENCODINGS = ['image/webp', 'image/jpeg'] as const;

/**
 * Encode avec le premier format réellement produit : un navigateur qui ne gère pas WebP renvoie
 * silencieusement du PNG, que l'on écarte.
 */
export async function encodeFirstSupported(
  encode: (type: string, quality: number) => Promise<Blob>,
  quality: number = PHOTO_QUALITY,
): Promise<Blob> {
  let last: Blob | null = null;
  for (const type of ENCODINGS) {
    const blob = await encode(type, quality);
    if (blob.type === type) return blob;
    last = blob;
  }
  if (!last) throw new Error('No encoder');
  return last;
}

/** Image réduite prête à être stockée par `db/photos`. Lève si le fichier n'est pas une image décodable. */
export async function resizeImage(file: Blob, max: number = MAX_PHOTO_SIDE): Promise<Blob> {
  // `imageOrientation: 'from-image'` applique l'orientation EXIF des photos de téléphone.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2d context');
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await encodeFirstSupported((type, quality) => canvas.convertToBlob({ type, quality }));
  } finally {
    bitmap.close();
  }
}
