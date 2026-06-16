import { auth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";

// Solo se usa cuando el backend está en VERIFF_PROVIDER=mock.
// El frontend "simula" el verdict de Veriff (approved/declined/resubmission)
// y nosotros lo posteamos al backend como si fuera el webhook real.
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { sessionId, status } = body as { sessionId: string; status: string };

  if (!sessionId || !status) {
    return Response.json({ error: "sessionId y status son requeridos" }, { status: 400 });
  }

  const webhookBody = JSON.stringify({
    sessionId,
    status,
    vendorData: session.user?.id,
  });

  const res = await apiFetch("/verification/webhook", session.backendToken, {
    method: "POST",
    body: webhookBody,
  });

  return Response.json({ ok: res.ok }, { status: res.status });
}
