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

interface CustomToken {
  sub?: string;
  role?: UserRole;
  backendToken?: string;
  backendTokenExp?: number | null;
  fleetId?: string | null;
  isFleetOwner?: boolean;
}

export const authConfig: NextAuthConfig = {
  providers: [],
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      const t = token as CustomToken;
      if (user?.id)                        t.sub              = user.id;
      if (user?.role)                      t.role             = user.role;
      if (user?.backendToken) {
        t.backendToken    = user.backendToken;
        t.backendTokenExp = readJwtExp(user.backendToken);
      }
      if (user?.fleetId !== undefined)     t.fleetId          = user.fleetId;
      if (user?.isFleetOwner !== undefined) t.isFleetOwner    = user.isFleetOwner;

      // Si el JWT del backend ya expiró, invalidamos la sesión de NextAuth.
      // Devolver null hace que el middleware vea loggedIn=false y redirija a /login.
      const exp = t.backendTokenExp;
      if (typeof exp === "number" && Math.floor(Date.now() / 1000) >= exp) {
        return null;
      }

      return token;
    },
    session({ session, token }) {
      const t = token as CustomToken;
      if (t.sub)                      session.user.id           = t.sub;
      if (t.role)                     session.user.role         = t.role;
      if (t.backendToken)             session.backendToken      = t.backendToken;
      if (t.fleetId !== undefined)    session.user.fleetId      = t.fleetId;
      if (t.isFleetOwner !== undefined) session.user.isFleetOwner = t.isFleetOwner;
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
