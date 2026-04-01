import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/lib/auth.config";

export type { UserRole } from "@/lib/auth.config";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email:    { label: "Email",      type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const res = await fetch(`${BACKEND_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email:    credentials.email,
            password: credentials.password,
          }),
        });

        if (!res.ok) return null;

        const data = await res.json();
        return {
          id:           data.user.id,
          email:        data.user.email,
          name:         data.user.name,
          role:         data.user.role === "shipper" ? "dador" : "transportista",
          backendToken: data.access_token,
        };
      },
    }),
  ],
});
