// Construction des URL d'images, utilisable côté serveur comme côté client.
export const IMAGE_WIDTHS = [400, 800, 1200] as const;

/** "/uploads" en local ; l'URL publique du bucket Supabase en production. */
export const MEDIA_BASE = process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "/uploads";

export function mediaSrc(key: string, width: 400 | 800 | 1200 = 800) {
  return `${MEDIA_BASE}/${key}-${width}.webp`;
}

export function mediaSrcSet(key: string) {
  return IMAGE_WIDTHS.map((w) => `${MEDIA_BASE}/${key}-${w}.webp ${w}w`).join(", ");
}
