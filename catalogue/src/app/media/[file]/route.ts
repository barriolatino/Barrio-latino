import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { supabasePublicUrl } from "@/lib/storage";

// Les noms de fichiers changent à chaque nouvelle image : mise en cache définitive.
const CACHE = "public, max-age=31536000, s-maxage=31536000, immutable";

export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!/^[a-z0-9-]+-(400|800|1200)\.webp$/.test(file)) return new Response("Introuvable", { status: 404 });

  const stored = await db.storedFile.findUnique({ where: { key: file } });
  if (stored) {
    return new Response(new Uint8Array(stored.data), { headers: { "Content-Type": stored.contentType, "Cache-Control": CACHE } });
  }
  try {
    const local = await readFile(path.join(process.cwd(), "public", "uploads", file));
    return new Response(new Uint8Array(local), { headers: { "Content-Type": "image/webp", "Cache-Control": CACHE } });
  } catch {
    // pas sur le disque local
  }
  const remote = supabasePublicUrl(file);
  if (remote) return Response.redirect(remote, 308);
  return new Response("Introuvable", { status: 404 });
}
