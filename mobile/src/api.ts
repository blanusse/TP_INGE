const BASE_URL = "https://cargaback.up.railway.app";

export async function login(email: string, password: string) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? data.error ?? "Error al iniciar sesión.");
  return data; // { access_token, user }
}

export async function register(payload: {
  email: string;
  password: string;
  name: string;
  role: "transportista" | "empleado";
  phone: string;
  dni: string;
  invitation_token?: string;
}) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? data.error ?? "Error al crear la cuenta.");
  return data;
}

export async function checkField(field: "email" | "dni" | "phone", value: string) {
  const res = await fetch(
    `${BASE_URL}/api/auth/check?field=${field}&value=${encodeURIComponent(value)}`
  );
  return res.json() as Promise<{ available: boolean }>;
}

export async function verifyInvitationToken(token: string) {
  const res = await fetch(`${BASE_URL}/api/fleet/invitations/${token.trim()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Código de invitación no válido.");
  return data as { token: string; ownerName: string; email: string };
}
