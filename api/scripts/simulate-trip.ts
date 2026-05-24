/**
 * Simula el viaje "prueba mapas": Buenos Aires → Rosario por ruta real (OSRM).
 *
 * Uso:
 *   npx ts-node scripts/simulate-trip.ts
 *
 * Requiere que el backend esté corriendo en localhost:3001.
 * Ver el mapa en: http://localhost:3000/dev/mapa
 */

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3001';
const LOAD_ID = 'prueba-mapas';

// Buenos Aires → Rosario
const ORIGIN = { lat: -34.6037, lng: -58.3816 };
const DEST   = { lat: -32.9468, lng: -60.6393 };

// Intervalo entre cada punto (ms). Con ~300 waypoints OSRM y 800ms ≈ 4 minutos de simulación.
const DELAY_MS = 800;

async function main() {
  console.log(`Iniciando simulación "${LOAD_ID}"...`);
  console.log(`Ruta: Buenos Aires → Rosario`);
  console.log(`Backend: ${BACKEND}`);
  console.log(`Ver en: http://localhost:3000/dev/mapa\n`);

  const res = await fetch(`${BACKEND}/location/${LOAD_ID}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
