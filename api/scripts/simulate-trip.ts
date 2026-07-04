/**
 * Simula el viaje "prueba mapas": Buenos Aires → Rosario por ruta real (OSRM).
 *
 * Uso:
 *   SIM_EMAIL=tu@mail.com SIM_PASSWORD=tuPass npx ts-node scripts/simulate-trip.ts
 *
 * O si ya tenés un JWT a mano (p. ej. copiado del front):
 *   AUTH_TOKEN="eyJhbG..." npx ts-node scripts/simulate-trip.ts
 *
 * Requiere que el backend esté corriendo en localhost:3001 y una cuenta
 * con el email ya verificado. Ver el mapa en: http://localhost:3000/dev/mapa
 */

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3001';
// Carga real (UUID) propiedad del dador de prueba. Overridable por env.
const LOAD_ID = process.env.LOAD_ID ?? 'dd89af02-cbe8-4cc9-ba98-5b3e614553e1';

// Buenos Aires → Rosario
const ORIGIN = { lat: -34.6037, lng: -58.3816 };
const DEST   = { lat: -32.9468, lng: -60.6393 };

// Intervalo entre cada punto (ms). Con ~300 waypoints OSRM y 800ms ≈ 4 minutos de simulación.
const DELAY_MS = 800;

/** Obtiene un JWT: usa AUTH_TOKEN si está, si no hace login con SIM_EMAIL/SIM_PASSWORD. */
async function getToken(): Promise<string> {
  if (process.env.AUTH_TOKEN) {
    return process.env.AUTH_TOKEN;
  }

  const email = process.env.SIM_EMAIL;
  const password = process.env.SIM_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Falta autenticación. Definí AUTH_TOKEN, o SIM_EMAIL y SIM_PASSWORD ' +
        '(la cuenta debe tener el email verificado).',
    );
  }

  const res = await fetch(`${BACKEND}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = (await res.json()) as {
    access_token?: string;
    message?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(
      `Login falló (${res.status}): ${data.message ?? JSON.stringify(data)}`,
    );
  }

  console.log(`Logueado como ${email}.`);
  return data.access_token;
}

async function main() {
  console.log(`Iniciando simulación "${LOAD_ID}"...`);
  console.log(`Ruta: Buenos Aires → Rosario`);
  console.log(`Backend: ${BACKEND}`);
  console.log(`Ver en: http://localhost:3000/dev/mapa\n`);

  const token = await getToken();

  const res = await fetch(`${BACKEND}/location/${LOAD_ID}/simulate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      originLat: ORIGIN.lat,
      originLng: ORIGIN.lng,
      destLat:   DEST.lat,
      destLng:   DEST.lng,
      delayMs:   DELAY_MS,
      useOsrm:   true,
    }),
  });

  const data = await res.json();

  if (data.ok) {
    console.log('Simulación iniciada en el servidor.');
    console.log('El camión se moverá por la Ruta Nacional 9.');
    console.log(`Delay por waypoint: ${DELAY_MS}ms`);
  } else {
    console.error('Error al iniciar la simulación:', data);
  }
}

main().catch(console.error);
