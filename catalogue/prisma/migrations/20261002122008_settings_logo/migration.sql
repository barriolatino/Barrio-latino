-- DropIndex
DROP INDEX "Product_searchText_trgm_idx";

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "logoMediaId" TEXT;
