import type { Metadata, Viewport } from "next";
import { Geist, Bebas_Neue, IBM_Plex_Sans } from "next/font/google";
import { Providers } from "./providers";
import { ServiceWorkerInit } from "./_components/ServiceWorkerInit";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas",
  weight: "400",
  subsets: ["latin"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#3a806b",
};

export const metadata: Metadata = {
  title: "CargaBack — Bolsa de Cargas Digital",
  description:
    "Conectamos camioneros con dadores de carga. Eliminá el viaje vacío de vuelta.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CargaBack",
  },
  formatDetection: { telephone: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${bebasNeue.variable} ${ibmPlexSans.variable} h-full`}>
      <head>
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
      </head>
      <body className="min-h-full">
        <ServiceWorkerInit />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
