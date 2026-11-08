import { AdminHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  await requireAdmin();
  const s = await db.siteSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const logo = s.logoMediaId ? await db.media.findUnique({ where: { id: s.logoMediaId } }) : null;
  return (
    <>
      <AdminHeader title="Paramètres" intro="Coordonnées, textes et réglages du catalogue. Tout ce qui est saisi ici s'affiche sur le site." />
      <SettingsForm
        values={{ ...s, updatedAt: undefined }}
        logo={logo ? { id: logo.id, key: logo.key, name: logo.name, alt: logo.alt, width: logo.width, height: logo.height } : null}
      />
    </>
  );
}
