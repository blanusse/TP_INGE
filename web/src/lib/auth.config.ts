import type { NextAuthConfig } from "next-auth";

export type UserRole = "transportista" | "dador" | "admin";

declare module "next-auth" {
  interface User {
    role?: UserRole;
    backendToken?: string;
    fleetId?: string | null;
    isFleetOwner?: boolean;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: UserRole;
      fleetId?: string | null;
      isFleetOwner?: boolean;
    };
    backendToken: string;
  }
}

function readJwtExp(jwt: string): number | null {
  try {
    const part = jwt.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export const authConfig: NextAuthConfig = {
  providers: [],
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id)                        token.sub                          = user.id;
      if (user?.role)                      (token as any).role                = user.role;
      if (user?.backendToken) {
        (token as any).backendToken    = user.backendToken;
        (token as any).backendTokenExp = readJwtExp(user.backendToken);
      }
      if (user?.fleetId !== undefined)     (token as any).fleetId             = user.fleetId;
      if (user?.isFleetOwner !== undefined)(token as any).isFleetOwner        = user.isFleetOwner;

      // Si el JWT del backend ya expiró, invalidamos la sesión de NextAuth.
      // Devolver null hace que el middleware vea loggedIn=false y redirija a /login.
      const exp = (token as any).backendTokenExp;
      if (typeof exp === "number" && Math.floor(Date.now() / 1000) >= exp) {
        return null;
      }

      return token;
    },
    session({ session, token }) {
      if (token.sub)                      session.user.id           = token.sub;
      if ((token as any).role)            session.user.role         = (token as any).role as UserRole;
      if ((token as any).backendToken)    session.backendToken      = (token as any).backendToken;
      if ((token as any).fleetId !== undefined)    session.user.fleetId     = (token as any).fleetId;
      if ((token as any).isFleetOwner !== undefined) session.user.isFleetOwner = (token as any).isFleetOwner;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error:  "/login",
  },
  session: {
    strategy: "jwt",
    maxAge:   8 * 60 * 60,
  },
};
