import type { NextAuthConfig } from "next-auth";

export type UserRole = "transportista" | "dador";

declare module "next-auth" {
  interface User {
    role?: UserRole;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: UserRole;
    };
  }
}

/**
 * Config liviana — sin imports de Node.js (mongoose, bcrypt).
 * Solo JWT/session callbacks. Usada por el middleware (Edge Runtime).
 */
export const authConfig: NextAuthConfig = {
  providers: [], // los providers con bcrypt/mongoose van en auth.ts
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id)   token.sub  = user.id;
      if (user?.role) token.role = user.role;
      return token;
    },
    session({ session, token }) {
      if (token.sub)  session.user.id   = token.sub;
      if (token.role) session.user.role = token.role as UserRole;
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
