import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

// Punto de entrada único post-login.
// El middleware ya garantiza que el usuario esté autenticado antes de llegar acá.
export default async function DashboardPage() {
  const session = await auth();
  const role = session?.user?.role;

  if (role === "dador") redirect("/dador");
  redirect("/transportista"); // transportistas (camioneros independientes y empresas de flota)
}
