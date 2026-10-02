"use client";

import { useState } from "react";
import type { ImageDTO } from "@/lib/catalogue";
import { mediaSrc } from "@/lib/media-url";
import { ProductImage } from "./product-image";

export function Gallery({ images, name }: { images: ImageDTO[]; name: string }) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? null;
  return (
    <div>
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line">
        <ProductImage image={current} sizes="(min-width: 1024px) 560px, 100vw" priority />
      </div>
      {images.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto" aria-label={`Photos de ${name}`}>
          {images.map((img, i) => (
            <li key={img.key} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Photo ${i + 1} sur ${images.length}`}
                aria-current={i === index}
                className={`block h-16 w-16 overflow-hidden rounded-lg border-2 bg-white sm:h-20 sm:w-20 ${i === index ? "border-navy" : "border-transparent hover:border-line-strong"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaSrc(img.key, 400)} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
