import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Tipos de perfil de usuario
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
    // Credentials solo para desarrollo/demo.
    // En producción: reemplazar por Auth0Provider.
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
        role: { label: "Rol", type: "text" },
      },
      async authorize(credentials) {
        // TODO: validar contra la base de datos con hashing bcrypt
        // Este bloque es solo para demo — nunca comparar contraseñas en texto plano en producción
        if (!credentials?.email || !credentials?.password || !credentials?.role) {
          return null;
        }
        // Simulación de usuario demo
        return {
          id: "demo-user-1",
          email: credentials.email as string,
          name: "Usuario Demo",
          role: credentials.role as UserRole,
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
