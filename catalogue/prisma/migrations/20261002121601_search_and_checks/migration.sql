-- Recherche tolérante (trigrammes) et garde-fous sur les prix.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Product_searchText_trgm_idx" ON "Product" USING GIN ("searchText" gin_trgm_ops);

ALTER TABLE "Product" ADD CONSTRAINT "Product_price_positive" CHECK ("priceCents" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_case_price_positive" CHECK ("casePriceCents" IS NULL OR "casePriceCents" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_case_quantity_positive" CHECK ("caseQuantity" IS NULL OR "caseQuantity" > 0);
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_price_positive" CHECK ("promoCents" >= 0);
