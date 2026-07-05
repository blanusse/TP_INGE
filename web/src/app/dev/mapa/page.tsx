import MapaClient from "./MapaClient";

// Forzamos render dinámico para que esta página NO se cachee como estática en el
// edge (antes se servía HTML viejo con s-maxage de 1 año aunque el deploy fuera
// nuevo). Así siempre se ve la última versión.
export const dynamic = "force-dynamic";

export default function DevMapaPage() {
  return <MapaClient />;
}
