import { mediaSrc, mediaSrcSet } from "@/lib/media-url";
import type { ImageDTO } from "@/lib/catalogue";
import { ImageIcon } from "./icons";

/** Photo produit : jamais déformée, toujours contenue dans un cadre carré. */
export function ProductImage({
  image,
  sizes,
  priority = false,
  className = "",
}: {
  image: ImageDTO | null;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (!image) {
    return (
      <div className={`flex aspect-square items-center justify-center bg-white text-ink-faint ${className}`}>
        <ImageIcon width={32} height={32} />
        <span className="sr-only">Photo à venir</span>
      </div>
    );
  }
  return (
    <div className={`relative aspect-square bg-white ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- images déjà optimisées à l'envoi */}
      <img
        src={mediaSrc(image.key, 800)}
        srcSet={mediaSrcSet(image.key)}
        sizes={sizes}
        width={image.width}
        height={image.height}
        alt={image.alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className="absolute inset-0 h-full w-full object-contain p-[8%]"
      />
    </div>
  );
}
