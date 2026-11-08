// Liens de contact construits à partir des paramètres (jamais codés en dur).

export function whatsappLink(number: string | null | undefined, message?: string | null) {
  if (!number) return null;
  let digits = number.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `33${digits.slice(1)}`; // numéro français saisi en 06…
  if (digits.length < 8) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}

export function telLink(number: string | null | undefined) {
  if (!number) return null;
  return `tel:${number.replace(/[^\d+]/g, "")}`;
}

export function socialLink(kind: "instagram" | "facebook" | "tiktok", value: string | null | undefined) {
  if (!value) return null;
  if (/^https?:\/\//.test(value)) return value;
  const handle = value.replace(/^@/, "");
  return { instagram: `https://instagram.com/${handle}`, facebook: `https://facebook.com/${handle}`, tiktok: `https://tiktok.com/@${handle}` }[kind];
}
