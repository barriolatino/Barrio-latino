import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";

import { IMAGE_WIDTHS } from "./media-url";
import { db } from "./db";

// Chaque image est stockée une fois, en WebP, dans trois largeurs.

type Driver = {
  put(file: string, data: Buffer, contentType: string): Promise<void>;
  remove(file: string): Promise<void>;
};

const localDir = path.join(process.cwd(), "public", "uploads");

const localDriver: Driver = {
  async put(file, data) {
    await mkdir(localDir, { recursive: true });
    await writeFile(path.join(localDir, file), data);
  },
  async remove(file) {
    await unlink(path.join(localDir, file)).catch(() => {});
  },
};

// Images dans la base de données : aucun réglage nécessaire, servies par /media/….
const databaseDriver: Driver = {
  async put(file, data, contentType) {
    await db.storedFile.upsert({
      where: { key: file },
      update: { data: new Uint8Array(data), contentType },
      create: { key: file, data: new Uint8Array(data), contentType },
    });
  },
  async remove(file) {
    await db.storedFile.deleteMany({ where: { key: file } });
  },
};

// Supabase Storage via son API REST : pas de SDK, la clé service reste côté serveur.
/** Valeur de variable nettoyée (espaces, guillemets copiés par erreur). */
const envValue = (name: string) => (process.env[name] ?? "").trim().replace(/^["']|["']$/g, "").trim();

function supabaseDriver(): Driver {
  const url = envValue("SUPABASE_URL").replace(/\/+$/, "");
  const key = envValue("SUPABASE_SERVICE_ROLE_KEY");
  const bucket = envValue("SUPABASE_BUCKET") || "media";
  const headers = { Authorization: `Bearer ${key}`, apikey: key };
  return {
    async put(file, data, contentType) {
      const res = await fetch(`${url}/storage/v1/object/${bucket}/${file}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": contentType, "x-upsert": "true", "Cache-Control": "31536000" },
        body: new Uint8Array(data),
      });
      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 200);
        throw new Error(`Envoi de la photo vers Supabase refusé (${res.status}) ${detail}`.trim());
      }
    },
    async remove(file) {
      await fetch(`${url}/storage/v1/object/${bucket}/${file}`, { method: "DELETE", headers });
    },
  };
}

// Supabase dès que ses identifiants sont présents (sauf STORAGE_DRIVER=local) ;
// le disque local ne sert qu'en développement.
export function usesSupabaseStorage() {
  const choice = envValue("STORAGE_DRIVER").toLowerCase();
  if (choice === "local") return false;
  return choice === "supabase" || (!!envValue("SUPABASE_URL") && !!envValue("SUPABASE_SERVICE_ROLE_KEY"));
}

function driver(): Driver {
  if (usesSupabaseStorage()) return supabaseDriver();
  const choice = envValue("STORAGE_DRIVER").toLowerCase();
  if (choice === "local" && !process.env.VERCEL) return localDriver;
  // Sur Vercel (disque non modifiable) ou sur demande : la base de données.
  if (process.env.VERCEL || choice === "database") return databaseDriver;
  return localDriver;
}

/** Adresse publique d'un fichier stocké chez Supabase (pour la redirection de /media). */
export function supabasePublicUrl(file: string) {
  if (!usesSupabaseStorage()) return null;
  const url = envValue("SUPABASE_URL").replace(/\/+$/, "");
  return `${url}/storage/v1/object/public/${envValue("SUPABASE_BUCKET") || "media"}/${file}`;
}

export type ProcessedImage = { key: string; width: number; height: number; blurData: string };

/** Redimensionne, compresse et stocke une image. Les proportions ne sont jamais modifiées. */
export async function storeImage(input: Buffer, baseName: string): Promise<ProcessedImage> {
  // Respecte l'orientation EXIF, puis retire les marges unies (fond blanc ou transparent).
  let source = await sharp(input, { failOn: "none" }).rotate().toBuffer();
  try {
    const trimmed = await sharp(source).trim({ threshold: 12 }).toBuffer({ resolveWithObject: true });
    if (trimmed.info.width > 40 && trimmed.info.height > 40) source = trimmed.data;
  } catch {
    // image unie : on garde l'original
  }
  const image = sharp(source);
  const meta = await image.metadata();
  if (!meta.width || !meta.height) throw new Error("Fichier image illisible");
  const key = `${baseName.slice(0, 50) || "image"}-${randomBytes(4).toString("hex")}`;

  for (const w of IMAGE_WIDTHS) {
    const buf = await image
      .clone()
      .resize({ width: w, height: w, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80, alphaQuality: 90 })
      .toBuffer();
    await driver().put(`${key}-${w}.webp`, buf, "image/webp");
  }
  const tiny = await image.clone().resize(12, 12, { fit: "inside" }).webp({ quality: 40 }).toBuffer();
  const scale = Math.min(1, 1200 / Math.max(meta.width, meta.height));
  return {
    key,
    width: Math.round(meta.width * scale),
    height: Math.round(meta.height * scale),
    blurData: `data:image/webp;base64,${tiny.toString("base64")}`,
  };
}

export async function removeImage(key: string) {
  await Promise.all(IMAGE_WIDTHS.map((w) => driver().remove(`${key}-${w}.webp`)));
}
