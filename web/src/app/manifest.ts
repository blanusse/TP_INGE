import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CargaBack",
    short_name: "CargaBack",
    description:
      "Conectamos camioneros con dadores de carga. Eliminá el viaje vacío de vuelta.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#3a806b",
    orientation: "portrait",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
