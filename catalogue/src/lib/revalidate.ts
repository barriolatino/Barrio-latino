import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

export const CATALOGUE_TAG = "catalogue";

/** Toute modification visible du public passe par ici : une seule invalidation, partout. */
export function revalidateCatalogue() {
  revalidateTag(CATALOGUE_TAG, { expire: 0 });
  revalidatePath("/", "layout");
}
