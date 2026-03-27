import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Rutas que requieren autenticación
const PROTECTED = ["/camionero", "/dador"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));

  if (isProtected && !req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirigir al dashboard correcto según el rol si ya está logueado y va a /login
  if (pathname === "/login" && req.auth?.user?.role) {
    const role = req.auth.user.role;
    const dest = role === "camionero" ? "/camionero" : role === "flota" ? "/camionero" : "/dador";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/camionero/:path*", "/dador/:path*", "/login"],
};
