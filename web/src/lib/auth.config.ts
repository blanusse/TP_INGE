import type { NextAuthConfig } from "next-auth";

export type UserRole = "transportista" | "dador" | "admin";

declare module "next-auth" {
  interface User {
    role?: UserRole;
    backendToken?: string;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: UserRole;
    };
    backendToken: string;
  }
}

export const authConfig: NextAuthConfig = {
  providers: [],
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id)            token.sub                        = user.id;
      if (user?.role)          (token as any).role              = user.role;
      if (user?.backendToken)  (token as any).backendToken      = user.backendToken;
      return token;
    },
    session({ session, token }) {
      if (token.sub)                    session.user.id      = token.sub;
      if ((token as any).role)          session.user.role    = (token as any).role as UserRole;
      if ((token as any).backendToken)  session.backendToken = (token as any).backendToken;
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
