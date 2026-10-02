import QRCode from "qrcode";
import { getAdmin } from "@/lib/auth";
import { exportRows } from "@/lib/import";
import { buildWorkbook, toCsv, type SheetRow } from "@/lib/spreadsheet";

const EXAMPLE: SheetRow[] = [
  { reference: "ARE-001", name: "Arepas blanches", brand: "La Victoria", category: "Arepas & galettes", country: "Colombie", storage: "Surgelé", unitCount: "5", packaging: "Paquet de 5", saleUnit: "unité", price: "3,20", caseQuantity: "25", casePrice: "72,00", available: "oui", published: "oui", featured: "non", isNew: "non", tags: "arepa, maïs" },
  { reference: "PUL-090", name: "Pulpe de maracuyá", brand: "Canoa", category: "Pulpes & fruits", subcategory: "Pulpes de fruits", country: "CO", storage: "Surgelé", weight: "90", packaging: "Sachet", price: "1,40", promotionalPrice: "1,19", available: "oui", published: "oui", isNew: "oui", tags: "fruit de la passion, jus" },
];

const stamp = () => new Date().toISOString().slice(0, 10);

export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  if (!(await getAdmin())) return new Response("Non autorisé", { status: 401 });
  const { file } = await params;
  const url = new URL(request.url);

  if (file === "produits.csv" || file === "modele.csv") {
    const rows = file === "modele.csv" ? EXAMPLE : await exportRows();
    return new Response(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${file === "modele.csv" ? "modele-import-produits.csv" : `produits-${stamp()}.csv`}"`,
      },
    });
  }
  if (file === "produits.xlsx" || file === "modele.xlsx") {
    const template = file === "modele.xlsx";
    const wb = await buildWorkbook(template ? EXAMPLE : await exportRows(), template);
    const buffer = await wb.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${template ? "modele-import-produits.xlsx" : `produits-${stamp()}.xlsx`}"`,
      },
    });
  }
  if (file === "qr.svg" || file === "qr.png") {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;
    const path = url.searchParams.get("path") ?? "/catalogue";
    const target = new URL(path.startsWith("/") ? path : "/catalogue", site).toString();
    const opts = { margin: 2, color: { dark: "#12173A", light: "#FFFFFF" }, errorCorrectionLevel: "M" as const };
    if (file === "qr.svg") {
      const svg = await QRCode.toString(target, { ...opts, type: "svg" });
      return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Content-Disposition": `attachment; filename="qr-catalogue.svg"` } });
    }
    const png = await QRCode.toBuffer(target, { ...opts, width: 1200 });
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="qr-catalogue.png"` } });
  }
  return new Response("Introuvable", { status: 404 });
}
