import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth({ ...authConfig, secret: process.env.AUTH_SECRET });

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;
  const loggedIn = !!req.auth;

  // ── 1. Rutas protegidas: requieren sesión activa ───────────────────────────
  const requiresAuth =
    pathname.startsWith("/transportista") ||
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
    if (pathname.startsWith("/transportista") && role === "dador") {
      return NextResponse.redirect(new URL("/dador", req.url));
    }
    if (pathname.startsWith("/dador") && role === "transportista") {
      return NextResponse.redirect(new URL("/transportista", req.url));
    }
  }

  // ── 4. Si ya está logueado y va al login → mandarlo a su dashboard ─────────
  if (pathname === "/login" && loggedIn && role) {
    const dest = role === "dador" ? "/dador" : role === "admin" ? "/admin" : "/transportista";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/transportista/:path*", "/camionero/:path*", "/dador/:path*", "/dashboard/:path*", "/dashboard", "/admin/:path*", "/admin", "/login"],
};
