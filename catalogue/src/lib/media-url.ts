// Construction des URL d'images, utilisable côté serveur comme côté client.
export const IMAGE_WIDTHS = [400, 800, 1200] as const;

/** Toutes les photos passent par /media/… : la route trouve le fichier
 *  (base de données, disque local ou Supabase), quel que soit le stockage. */
export const MEDIA_BASE = "/media";

export function mediaSrc(key: string, width: 400 | 800 | 1200 = 800) {
  return `${MEDIA_BASE}/${key}-${width}.webp`;
}

export function mediaSrcSet(key: string) {
  return IMAGE_WIDTHS.map((w) => `${MEDIA_BASE}/${key}-${w}.webp ${w}w`).join(", ");
}
