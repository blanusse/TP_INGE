import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

export async function POST() {
  const session = await auth();
  if (!session) return Response.json({ error: "No autorizado" }, { status: 401 });

  const res = await apiFetch("/documents/verify-identity", session.backendToken, {
    method: "POST",
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
