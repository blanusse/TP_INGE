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

export const authConfig: NextAuthConfig = {
  providers: [],
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id)                        token.sub                          = user.id;
      if (user?.role)                      (token as any).role                = user.role;
      if (user?.backendToken)              (token as any).backendToken        = user.backendToken;
      if (user?.fleetId !== undefined)     (token as any).fleetId             = user.fleetId;
      if (user?.isFleetOwner !== undefined)(token as any).isFleetOwner        = user.isFleetOwner;
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
