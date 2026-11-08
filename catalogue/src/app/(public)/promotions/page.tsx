import type { Metadata } from "next";
import { ProductListing } from "@/components/product-listing";
import { PageTitle } from "@/components/ui";
import { parseFilters } from "@/lib/filters";

export const metadata: Metadata = { title: "Promotions", description: "Les produits en promotion en ce moment.", alternates: { canonical: "/promotions" } };

export default async function PromotionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className="container-page py-6 sm:py-10">
      <PageTitle title="Promotions" intro="Les bonnes affaires du moment. L'économie réalisée est indiquée sur chaque produit." />
      <ProductListing filters={parseFilters(sp)} fixed={{ promo: true }} basePath="/promotions" searchParams={sp} />
    </div>
  );
}
