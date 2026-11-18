// Code d'accès et session signée. Le code et la clé de signature viennent
// des variables d'environnement (MON_STOCK_CODE, MON_STOCK_SECRET) :
// rien de secret n'est écrit dans le dépôt.

import { createHmac, timingSafeEqual } from "node:crypto";

const DUREE_SESSION_S = 30 * 24 * 60 * 60;
const NOM_COOKIE = "monstock_session";

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function signer(texte, secret) {
  return createHmac("sha256", secret).update(texte).digest("base64url");
}

function egal(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function configAcces(env = process.env) {
  const code = env.MON_STOCK_CODE;
  const secret = env.MON_STOCK_SECRET;
  if (!code || code.length < 4 || !secret || secret.length < 32) {
    throw new Error("MON_STOCK_CODE (4 caractères min.) et MON_STOCK_SECRET (32 caractères min.) doivent être définis.");
  }
  return { code, secret };
}

export function codeCorrect(saisi, config) {
  return typeof saisi === "string" && egal(saisi.trim(), config.code);
}

export function creerSession(config, maintenant = Date.now()) {
  const charge = b64url(JSON.stringify({ u: "Clément", exp: Math.floor(maintenant / 1000) + DUREE_SESSION_S }));
  return `${charge}.${signer(charge, config.secret)}`;
}

export function lireSession(enTeteCookie, config, maintenant = Date.now()) {
  const jeton = (enTeteCookie || "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${NOM_COOKIE}=`))
    ?.slice(NOM_COOKIE.length + 1);
  if (!jeton) return null;
  const [charge, signature] = jeton.split(".");
  if (!charge || !signature || !egal(signature, signer(charge, config.secret))) return null;
  try {
    const donnees = JSON.parse(Buffer.from(charge, "base64url").toString("utf8"));
    if (!donnees.exp || donnees.exp * 1000 < maintenant) return null;
    return { utilisateur: donnees.u };
  } catch {
    return null;
  }
}

export function cookieSession(jeton, { securise = true } = {}) {
  return `${NOM_COOKIE}=${jeton}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DUREE_SESSION_S}${securise ? "; Secure" : ""}`;
}

export function cookieFin({ securise = true } = {}) {
  return `${NOM_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${securise ? "; Secure" : ""}`;
}

/** Freine les essais de code : 5 erreurs → 1 minute d'attente (par instance). */
export function creerFrein({ essais = 5, attenteMs = 60_000 } = {}) {
  const echecs = new Map();
  return {
    bloque(ip, maintenant = Date.now()) {
      const e = echecs.get(ip);
      return Boolean(e && e.n >= essais && maintenant - e.depuis < attenteMs);
    },
    echec(ip, maintenant = Date.now()) {
      const e = echecs.get(ip);
      if (!e || maintenant - e.depuis >= attenteMs) echecs.set(ip, { n: 1, depuis: maintenant });
      else e.n++;
    },
    reussite(ip) {
      echecs.delete(ip);
    },
  };
}
