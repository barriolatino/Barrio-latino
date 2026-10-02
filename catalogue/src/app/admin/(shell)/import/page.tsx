import { AdminHeader, Panel } from "@/components/admin/ui";
import { btn } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { ImportWizard } from "./import-wizard";

export const metadata = { title: "Importer des produits" };
export const maxDuration = 60;

export default async function ImportPage() {
  await requireAdmin();
  return (
    <>
      <AdminHeader title="Importer des produits" intro="Ajoutez ou modifiez des dizaines de produits d'un coup depuis Excel. Rien n'est enregistré avant votre validation." />
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <ImportWizard />
        <Panel title="Comment faire" className="self-start text-sm">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Téléchargez le modèle et remplissez une ligne par produit.</li>
            <li>Pour modifier des prix : exportez vos produits, changez les prix dans Excel, réimportez.</li>
            <li>Les produits sont reconnus par leur <strong>référence</strong> : même référence = mise à jour.</li>
            <li>Une colonne retirée du fichier ne modifie rien.</li>
          </ol>
          <div className="mt-4 flex flex-col gap-2">
            <a href="/admin/export/modele.xlsx" className={`${btn.base} ${btn.secondary} ${btn.sm}`}>Modèle Excel (.xlsx)</a>
            <a href="/admin/export/modele.csv" className={`${btn.base} ${btn.ghost} ${btn.sm}`}>Modèle CSV</a>
          </div>
        </Panel>
      </div>
    </>
  );
}
