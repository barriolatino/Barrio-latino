import type { MediaItem } from "../../actions/media";

export type ProductFormValues = {
  id?: string;
  name: string;
  brandName: string;
  reference: string;
  description: string;
  categoryId: string;
  countryId: string;
  storage: string;
  netWeightG: string;
  volumeMl: string;
  unitCount: string;
  packaging: string;
  saleUnit: string;
  price: string;
  promo: string;
  promoEndsAt: string;
  caseQuantity: string;
  casePrice: string;
  cost: string;
  available: boolean;
  published: boolean;
  isNew: boolean;
  featured: boolean;
  tags: string;
  seoTitle: string;
  seoDescription: string;
  images: MediaItem[];
};

export function emptyValues(): ProductFormValues {
  return {
    name: "", brandName: "", reference: "", description: "", categoryId: "", countryId: "", storage: "AMBIENT",
    netWeightG: "", volumeMl: "", unitCount: "", packaging: "", saleUnit: "UNIT", price: "", promo: "", promoEndsAt: "",
    caseQuantity: "", casePrice: "", cost: "", available: true, published: true, isNew: false, featured: false, tags: "",
    seoTitle: "", seoDescription: "", images: [],
  };
}
