import Link from "next/link";
import type { CategoryNode } from "@/lib/catalogue";
import { ProductImage } from "./product-image";

export function CategoryCard({ category, compact = false }: { category: CategoryNode; compact?: boolean }) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-cream transition-colors hover:border-line-strong"
    >
      <ProductImage image={category.image} sizes={compact ? "160px" : "(min-width: 1024px) 25vw, 45vw"} className="transition-transform duration-300 group-hover:scale-[1.03]" />
      <div className="flex flex-1 flex-col border-t border-line bg-paper p-3 sm:p-4">
        <h3 className={`font-display font-bold text-navy ${compact ? "text-base leading-tight" : "text-lg sm:text-xl"}`}>{category.name}</h3>
        <p className="tabular text-sm text-ink-muted">
          {category.count} produit{category.count > 1 ? "s" : ""}
        </p>
        {!compact && category.description && <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{category.description}</p>}
      </div>
    </Link>
  );
}
