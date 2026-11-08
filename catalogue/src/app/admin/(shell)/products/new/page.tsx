import Link from "next/link";
import { AdminHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { formOptions } from "../form-data";
import { emptyValues } from "../form-values";
import { ProductForm } from "../product-form";
import { SavedToast } from "../saved-toast";

export const metadata = { title: "Ajouter un produit" };

export default async function NewProduct({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin();
  const [opts, { saved }] = await Promise.all([formOptions(), searchParams]);
  return (
    <>
      <AdminHeader title="Ajouter un produit" intro={<>Seuls le nom, la catégorie et le prix sont obligatoires. <Link className="underline" href="/admin/import">Plusieurs produits ? Importez un fichier Excel.</Link></>} />
      {saved && <SavedToast text="Produit publié. Vous pouvez saisir le suivant." />}
      <ProductForm values={emptyValues()} {...opts} />
    </>
  );
}
