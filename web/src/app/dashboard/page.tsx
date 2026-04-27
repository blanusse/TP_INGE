import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

// Punto de entrada único post-login.
// El middleware ya garantiza que el usuario esté autenticado antes de llegar acá.
export default async function DashboardPage() {
  const session = await auth();
  const role = session?.user?.role;

  if (role === "dador") redirect("/dador");
  if (role === "admin") redirect("/admin");

  // Transportistas: ruta según sub-tipo
  const fleetId      = (session?.user as any)?.fleetId ?? null;
  const isFleetOwner = (session?.user as any)?.isFleetOwner ?? false;
  if (fleetId)      redirect("/empleado");
  if (isFleetOwner) redirect("/flota");
  redirect("/transportista");
}
