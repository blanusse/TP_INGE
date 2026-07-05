"use client";

import { Suspense } from "react";
import TransportistaDashboard from "@/app/transportista/page";

export default function EmpleadoDashboard() {
  return (
    <Suspense fallback={null}>
      <TransportistaDashboard mode="empleado" />
    </Suspense>
  );
}
