import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth({ ...authConfig, secret: process.env.AUTH_SECRET });

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role         = req.auth?.user?.role;
  const fleetId      = req.auth?.user?.fleetId ?? null;
  const isFleetOwner = req.auth?.user?.isFleetOwner ?? false;
  const loggedIn     = !!req.auth;

  /** Determina la vista correcta para transportistas */
  function vistaTransportista(): string {
    if (fleetId)      return "/empleado";
    if (isFleetOwner) return "/flota";
    return "/transportista";
  }

  // ── 1. Rutas protegidas: requieren sesión activa ───────────────────────────
  const requiresAuth =
    pathname.startsWith("/transportista") ||
    pathname.startsWith("/flota") ||
    pathname.startsWith("/empleado") ||
    pathname.startsWith("/camionero") ||
    pathname.startsWith("/dador") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin");
  if (requiresAuth && !loggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Admin-only protection ─────────────────────────────────────────────────
  if (pathname.startsWith("/admin") && loggedIn && role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // ── 2. Redirect /camionero → /transportista (legacy route) ────────────────
  if (pathname.startsWith("/camionero")) {
    return NextResponse.redirect(new URL("/transportista" + pathname.slice("/camionero".length), req.url));
  }

  // ── 3. Routing por rol: cada usuario solo accede a su sección ─────────────
  if (loggedIn && role) {
    const isTruckerRoute = pathname.startsWith("/transportista") || pathname.startsWith("/flota") || pathname.startsWith("/empleado");

    // Dador intentando acceder a vista de transportista
    if (isTruckerRoute && role === "dador") {
      return NextResponse.redirect(new URL("/dador", req.url));
    }

    // Transportista intentando acceder a vista de dador
    if (pathname.startsWith("/dador") && role === "transportista") {
      return NextResponse.redirect(new URL(vistaTransportista(), req.url));
    }

    // Transportista en la vista incorrecta para su sub-tipo
    if (role === "transportista" && isTruckerRoute) {
      const correcta = vistaTransportista();
      if (!pathname.startsWith(correcta)) {
        return NextResponse.redirect(new URL(correcta, req.url));
      }
    }
  }

  // ── 4. Si ya está logueado y va al login → mandarlo a su dashboard ─────────
  if (pathname === "/login" && loggedIn && role) {
    let dest: string;
    if (role === "dador")  dest = "/dador";
    else if (role === "admin") dest = "/admin";
    else dest = vistaTransportista();
    return NextResponse.redirect(new URL(dest, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/transportista/:path*", "/flota/:path*", "/empleado/:path*",
    "/camionero/:path*", "/dador/:path*",
    "/dashboard/:path*", "/dashboard",
    "/admin/:path*", "/admin",
    "/login",
  ],
};
