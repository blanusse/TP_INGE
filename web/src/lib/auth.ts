import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";

// Roles en la DB → roles del frontend
const dbRoleToFrontend: Record<string, "camionero" | "dador"> = {
  driver: "camionero",
  shipper: "dador",
};

export type UserRole = "camionero" | "dador" | "flota";

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const { data: user } = await supabase
          .from("users")
          .select("id, email, name, role, password_hash")
          .eq("email", credentials.email)
          .single();

        if (!user?.password_hash) return null;

        const passwordOk = await bcrypt.compare(
          credentials.password as string,
          user.password_hash
        );
        if (!passwordOk) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: dbRoleToFrontend[user.role] ?? "camionero",
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.role) {
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.role) {
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    // Sesión expira en 8 horas — balance entre seguridad y UX para logística
    maxAge: 8 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,   // JS del browser no puede leer la cookie
        sameSite: "lax",  // Protección CSRF
        secure: process.env.NODE_ENV === "production", // HTTPS solo en prod
        path: "/",
      },
    },
  },
});
