export const BASE_URL = "https://tpinge-production-d38f.up.railway.app";

const COMMISSION_RATE = 0.10;
const grossToNet = (gross: number) =>
  Math.round(gross * (1 - COMMISSION_RATE) * 100) / 100;
const netToGross = (net: number) =>
  Math.round((net / (1 - COMMISSION_RATE)) * 100) / 100;

// ─── Auth state ─────────────────────────────────────────────────────────────

let _token: string | null = null;
let _user: {
  id: string;
  name: string;
  email: string;
  role: string;
  fleet_id: string | null;
  is_fleet_owner: boolean;
} | null = null;

export function setAuth(
  token: string,
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    fleet_id: string | null;
    is_fleet_owner: boolean;
  }
) {
  _token = token;
  _user = user;
}

export function getUser() { return _user; }
export function isFleetEmployee() {
  return _user?.role === "transportista" && !!_user.fleet_id && !_user.is_fleet_owner;
}
export function isShipper() {
  return _user?.role === "shipper";
}
export function getToken() { return _token; }

export function clearAuth() {
  _token = null;
  _user = null;
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (_token) h["Authorization"] = `Bearer ${_token}`;
  return h;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? data.error ?? "Error al iniciar sesión.");
  return data as {
    access_token: string;
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      fleet_id: string | null;
      is_fleet_owner: boolean;
    };
  };
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
  const res = await fetch(`${BASE_URL}/auth/register`, {
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
    `${BASE_URL}/auth/check?field=${field}&value=${encodeURIComponent(value)}`
  );
  return res.json() as Promise<{ available: boolean }>;
}

export async function verifyInvitationToken(token: string) {
  const res = await fetch(`${BASE_URL}/fleet/invitations/${token.trim()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Código de invitación no válido.");
  return data as { token: string; ownerName: string; email: string };
}

// ─── Viajes ──────────────────────────────────────────────────────────────────

export type Viaje = {
  offerId: string;
  loadId: string;
  titulo: string;
  empresa: string;
  empresaUserId: string | null;
  precio: number;
  fechaRetiro: string;
  pickupCity: string;
  dropoffCity: string;
  pickupExact: string | null;
  dropoffExact: string | null;
  pickupLat: number | null;
  pickupLon: number | null;
  dropoffLat: number | null;
  dropoffLon: number | null;
  status: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toViaje(o: any): Viaje {
  return {
    offerId: o.id,
    loadId: o.load_id,
    titulo: o.load?.cargo_type ?? "Transporte",
    empresa: o.load?.shipper?.razon_social ?? "Dador de carga",
    empresaUserId: o.load?.shipper?.user_id ?? null,
    precio: grossToNet(Number(o.price)),
    fechaRetiro: o.load?.ready_at
      ? new Date(o.load.ready_at).toLocaleDateString("es-AR", {
          day: "2-digit", month: "2-digit", year: "numeric",
        })
      : "-",
    pickupCity: o.load?.pickup_city ?? "",
    dropoffCity: o.load?.dropoff_city ?? "",
    pickupExact: o.load?.pickup_exact ?? null,
    dropoffExact: o.load?.dropoff_exact ?? null,
    pickupLat: o.load?.pickup_lat ? Number(o.load.pickup_lat) : null,
    pickupLon: o.load?.pickup_lon ? Number(o.load.pickup_lon) : null,
    dropoffLat: o.load?.dropoff_lat ? Number(o.load.dropoff_lat) : null,
    dropoffLon: o.load?.dropoff_lon ? Number(o.load.dropoff_lon) : null,
    status: o.load?.status ?? "unknown",
  };
}

export async function getMyTrips(): Promise<{
  enCurso: Viaje[];
  proximos: Viaje[];
  completados: Viaje[];
}> {
  const res = await fetch(`${BASE_URL}/offers/mine`, { headers: authHeaders() });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const offers: any[] = await res.json();
  if (!res.ok || !Array.isArray(offers)) return { enCurso: [], proximos: [], completados: [] };

  const now = new Date();

  const enCurso = offers
    .filter((o) =>
      o.status === "accepted" && o.load?.status === "in_transit" &&
      (!o.load.ready_at || new Date(o.load.ready_at) <= now)
    )
    .map(toViaje);

  const proximos = offers
    .filter((o) =>
      o.status === "accepted" &&
      (o.load?.status === "matched" ||
        (o.load?.status === "in_transit" && o.load.ready_at && new Date(o.load.ready_at) > now))
    )
    .map(toViaje);

  const completados = offers
    .filter((o) => o.status === "accepted" && o.load?.status === "delivered")
    .map(toViaje);

  return { enCurso, proximos, completados };
}

// ─── Cargas disponibles ───────────────────────────────────────────────────────

export type Carga = {
  id: string;
  cargo_type: string;
  pickup_city: string;
  dropoff_city: string;
  pickup_exact?: string;
  dropoff_exact?: string;
  pickup_lat?: number;
  pickup_lon?: number;
  dropoff_lat?: number;
  dropoff_lon?: number;
  price_base: number;
  weight_kg?: number;
  distance_km?: number;
  ready_at?: string;
  truck_type_required?: string;
  shipper?: { razon_social?: string };
};

export async function getAvailableLoads(): Promise<Carga[]> {
  const res = await fetch(`${BASE_URL}/loads/available`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error("Error al cargar cargas.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any[] = Array.isArray(data) ? data : (data.loads ?? []);
  return raw.map((l) => ({
    ...l,
    pickup_lat: l.pickup_lat ? Number(l.pickup_lat) : undefined,
    pickup_lon: l.pickup_lon ? Number(l.pickup_lon) : undefined,
    dropoff_lat: l.dropoff_lat ? Number(l.dropoff_lat) : undefined,
    dropoff_lon: l.dropoff_lon ? Number(l.dropoff_lon) : undefined,
    price_base: l.price_base != null ? grossToNet(Number(l.price_base)) : l.price_base,
  }));
}

// ─── Mensajes ────────────────────────────────────────────────────────────────

export type Mensaje = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export async function getMessages(offerId: string): Promise<Mensaje[]> {
  const res = await fetch(
    `${BASE_URL}/messages?offerId=${offerId}`,
    { headers: authHeaders() }
  );
  const data = await res.json();
  return Array.isArray(data) ? data : (data.messages ?? []);
}

export async function sendMessage(offerId: string, content: string): Promise<Mensaje> {
  const res = await fetch(`${BASE_URL}/messages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ offer_id: offerId, content }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Error al enviar el mensaje.");
  return data as Mensaje;
}

// ─── Mis Cargas (dador) ───────────────────────────────────────────────────────

export type MiCarga = {
  id: string;
  pickup_city: string;
  dropoff_city: string;
  pickup_exact?: string;
  dropoff_exact?: string;
  cargo_type?: string;
  truck_type_required?: string;
  weight_kg?: number;
  price_base?: number;
  distance_km?: number;
  ready_at?: string;
  description?: string;
  status: "available" | "matched" | "in_transit" | "delivered" | "cancelled";
  offer_count: number;
  accepted_offer?: { offerId: string; precio: number; driverName: string } | null;
};

export async function getMyLoads(): Promise<MiCarga[]> {
  const res = await fetch(`${BASE_URL}/loads`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error("Error al cargar tus cargas.");
  return Array.isArray(data) ? data : [];
}

export type Oferta = {
  id: string;
  load_id: string;
  driver_id: string;
  price: number;
  counter_price?: number | null;
  note?: string | null;
  status: "pending" | "accepted" | "rejected" | "countered" | "withdrawn";
  driver: { id: string; name: string };
  avg_rating: number | null;
  rating_count: number;
};

export async function createLoad(fields: {
  pickup_city: string;
  dropoff_city: string;
  cargo_type?: string;
  truck_type_required?: string;
  weight_kg?: number;
  price_base?: number;
  ready_at?: string;
  description?: string;
}): Promise<void> {
  const res = await fetch(`${BASE_URL}/loads`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(fields),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Error al publicar la carga.");
}

export async function updateLoad(
  loadId: string,
  fields: {
    cargo_type?: string;
    truck_type_required?: string;
    weight_kg?: number;
    price_base?: number;
    description?: string;
  }
): Promise<void> {
  const res = await fetch(`${BASE_URL}/loads/${loadId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(fields),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Error al actualizar la carga.");
}

export async function deleteLoad(loadId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/loads/${loadId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message ?? "Error al eliminar la carga.");
  }
}

export async function getOffersForLoad(loadId: string): Promise<Oferta[]> {
  const res = await fetch(`${BASE_URL}/offers?loadId=${loadId}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error("Error al cargar ofertas.");
  return Array.isArray(data) ? data : [];
}

export async function updateOffer(
  offerId: string,
  action: "accept" | "reject" | "counter",
  counter_price?: number
): Promise<void> {
  const res = await fetch(`${BASE_URL}/offers/${offerId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ action, counter_price: counter_price ?? null }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Error al actualizar la oferta.");
}

export async function getDeliveryCode(
  loadId: string
): Promise<{ delivery_code: string; delivery_code_used: boolean } | null> {
  const res = await fetch(
    `${BASE_URL}/payments/delivery-code?loadId=${loadId}`,
    { headers: authHeaders() }
  );
  if (!res.ok) return null;
  return res.json();
}

// ─── Ubicación ───────────────────────────────────────────────────────────────

export async function updateLocation(loadId: string, lat: number, lng: number): Promise<void> {
  await fetch(`${BASE_URL}/location/${loadId}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ lat, lng }),
  });
}

// ─── Ofertas ─────────────────────────────────────────────────────────────────

export async function createOffer(payload: {
  loadId: string;
  price: number; // net price (what the driver wants to receive)
  note?: string;
}): Promise<void> {
  const res = await fetch(`${BASE_URL}/offers`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      load_id: payload.loadId,
      price: netToGross(payload.price),
      note: payload.note || undefined,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? data.error ?? "Error al enviar la oferta.");
}

// ─── Documentos ──────────────────────────────────────────────────────────────

export async function verifyDocument(endpoint: string, imageUri: string) {
  const { uploadDocumentImage } = await import("./utils/documentUpload");
  return uploadDocumentImage(imageUri, endpoint);
}

export async function getUserProfile() {
  const res = await fetch(`${BASE_URL}/auth/profile`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Error al obtener perfil.");
  return data;
}

export async function getMyTrucks() {
  const res = await fetch(`${BASE_URL}/fleet/trucks`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Error al obtener camiones.");
  return Array.isArray(data) ? data : [];
}
