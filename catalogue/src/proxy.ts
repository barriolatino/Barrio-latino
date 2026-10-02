import { NextResponse, type NextRequest } from "next/server";

// Premier filtre : sans cookie de session, l'administration renvoie vers la connexion.
// La session elle-même est vérifiée côté serveur par requireAdmin() sur chaque page et action.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("bl_admin")) {
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin", "/admin/((?!login).*)"] };
