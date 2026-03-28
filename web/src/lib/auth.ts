import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { supabase } from "@/lib/supabase";

// Roles en la DB → roles del frontend
const dbRoleToFrontend: Record<string, "camionero" | "dador" | "flota"> = {
  driver:         "camionero",
  shipper:        "dador",
  carrier_admin:  "flota",
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

        // Supabase Auth valida email + password
        const { data: { user: authUser }, error } = await supabase.auth.signInWithPassword({
          email: credentials.email as string,
          password: credentials.password as string,
        });

        if (error || !authUser) return null;

        // Leer nombre y rol desde public.users
        const { data: userData } = await supabase
          .from("users")
          .select("name, role")
          .eq("id", authUser.id)
          .single();

        if (!userData) return null;

        return {
          id: authUser.id,
          email: authUser.email,
          name: userData.name,
          role: dbRoleToFrontend[userData.role] ?? "camionero",
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
