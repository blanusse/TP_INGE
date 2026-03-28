import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;
  const loggedIn = !!req.auth;

  // ── 1. Rutas protegidas: requieren sesión activa ───────────────────────────
  const requiresAuth = pathname.startsWith("/camionero") || pathname.startsWith("/dador") || pathname.startsWith("/dashboard");
  if (requiresAuth && !loggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── 2. Routing por rol: cada usuario solo accede a su sección ─────────────
  if (loggedIn && role) {
    if (pathname.startsWith("/camionero") && role === "dador") {
      return NextResponse.redirect(new URL("/dador", req.url));
    }
    if (pathname.startsWith("/dador") && (role === "camionero" || role === "flota")) {
      return NextResponse.redirect(new URL("/camionero", req.url));
    }
  }

  // ── 3. Si ya está logueado y va al login → mandarlo a su dashboard ─────────
  if (pathname === "/login" && loggedIn && role) {
    const dest = role === "dador" ? "/dador" : "/camionero";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/camionero/:path*", "/dador/:path*", "/dashboard/:path*", "/dashboard", "/login"],
};
