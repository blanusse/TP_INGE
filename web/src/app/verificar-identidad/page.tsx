"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Phase = "intro" | "doc" | "selfie" | "processing" | "approved" | "declined";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Si llegan a /verificar-identidad sin session en la URL, arrancamos una.
  useEffect(() => {
    const fromUrl = params.get("session");
    if (fromUrl) {
      setSessionId(fromUrl);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/verification/start", { method: "POST" });
        if (!res.ok) {
          setError("No pudimos iniciar la verificación. Intentá de nuevo.");
          return;
        }
        const data = await res.json();
        // El backend devuelve { url, sessionId }. La URL apunta acá, pero ya estamos
        // acá — solo necesitamos el sessionId.
        setSessionId(data.sessionId);
      } catch {
        setError("Error de conexión.");
      }
    })();
  }, [params]);

  async function simulateAndComplete(decision: "approved" | "declined") {
    if (!sessionId) return;
    setPhase("processing");
    await new Promise((r) => setTimeout(r, 2500));

    try {
      const res = await fetch("/api/verification/mock-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, status: decision }),
      });
      if (!res.ok) {
        setError("El backend rechazó la verificación.");
        setPhase("intro");
        return;
      }
      setPhase(decision);
      if (decision === "approved") {
        // Esperamos un toque y volvemos al onboarding
        setTimeout(() => router.push("/onboarding"), 1800);
      }
    } catch {
      setError("Error al completar la verificación.");
      setPhase("intro");
    }
  }

  return (
    <div style={shell}>
      <style>{`@keyframes verifSpin { to { transform: rotate(360deg); } }`}</style>
      <div style={card}>
        <Header />

        {error && (
          <div style={errorBox}>
            <strong>⚠ Error:</strong> {error}
          </div>
        )}

        {phase === "intro" && <IntroPhase onStart={() => setPhase("doc")} />}
        {phase === "doc" && <DocPhase onNext={() => setPhase("selfie")} />}
        {phase === "selfie" && (
          <SelfiePhase
            onApprove={() => simulateAndComplete("approved")}
            onDecline={() => simulateAndComplete("declined")}
          />
        )}
        {phase === "processing" && <ProcessingPhase />}
        {phase === "approved" && <ApprovedPhase />}
        {phase === "declined" && <DeclinedPhase onRetry={() => setPhase("intro")} />}

        <Footer />
      </div>
    </div>
  );
}

export default function VerificarIdentidadPage() {
  return (
    <Suspense fallback={<div style={shell}><div style={card}>Cargando…</div></div>}>
      <Inner />
    </Suspense>
  );
}

function Header() {
  return (
    <div style={{ textAlign: "center", marginBottom: 24 }}>
      <div style={{ fontSize: 11, color: "#3a806b", letterSpacing: 1.5, fontWeight: 700, marginBottom: 6 }}>
        VERIFICACIÓN DE IDENTIDAD
      </div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
        Powered by Veriff{" "}
        <span style={{ background: "rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 999, fontSize: 10, marginLeft: 4 }}>
          SANDBOX
        </span>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div style={{ marginTop: 28, textAlign: "center" }}>
      <Link href="/onboarding" style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textDecoration: "underline" }}>
        Cancelar y volver al onboarding
      </Link>
    </div>
  );
}

function IntroPhase({ onStart }: { onStart: () => void }) {
  return (
    <div>
      <h2 style={h2Style}>Verifiquemos que sos vos</h2>
      <p style={pStyle}>
        Vas a hacer dos cosas: sacarle una foto a tu DNI y una selfie. Nuestro proveedor compara
        ambas imágenes y confirma que la persona en el DNI es la que está usando la cuenta.
      </p>
      <Steps current={0} />
      <button onClick={onStart} style={btnPrimary}>Empezar verificación →</button>
    </div>
  );
}

function DocPhase({ onNext }: { onNext: () => void }) {
  return (
    <div>
      <h2 style={h2Style}>1. Foto del DNI</h2>
      <p style={pStyle}>Sacale una foto al frente del documento. Asegurate que se lea con claridad.</p>
      <div style={cameraFrame}>
        <div style={{ ...placeholderDoc }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#3a806b", marginBottom: 8, letterSpacing: 0.5 }}>
            DOCUMENTO NACIONAL DE IDENTIDAD
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 4 }}>JUAN HUMPHREYS</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>DNI 12.345.678</div>
          <div style={{ marginTop: 16, fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
            (vista simulada — sandbox)
          </div>
        </div>
      </div>
      <button onClick={onNext} style={btnPrimary}>Foto OK, continuar →</button>
    </div>
  );
}

function SelfiePhase({
  onApprove,
  onDecline,
}: {
  onApprove: () => void;
  onDecline: () => void;
}) {
  return (
    <div>
      <h2 style={h2Style}>2. Selfie con prueba de vida</h2>
      <p style={pStyle}>
        Posicioná tu cara dentro del círculo. Nuestro proveedor detectará movimiento natural para
        confirmar que sos una persona real.
      </p>
      <div style={cameraFrame}>
        <div style={{
          width: 180, height: 180, borderRadius: "50%",
          background: "radial-gradient(circle at 50% 40%, rgba(58,128,107,0.35), rgba(58,128,107,0))",
          border: "2px dashed rgba(58,128,107,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto", fontSize: 14, color: "rgba(255,255,255,0.5)",
        }}>
          rostro detectado
        </div>
      </div>
      <div style={{ background: "rgba(255,255,255,0.04)", padding: 14, borderRadius: 10, marginTop: 20 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 700, marginBottom: 8, letterSpacing: 0.5 }}>
          SIMULACIÓN — VERDICT DE VERIFF
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onApprove} style={btnApprove}>
            ✓ Approved
          </button>
          <button onClick={onDecline} style={btnDecline}>
            ✗ Declined
          </button>
        </div>
      </div>
    </div>
  );
}

function ProcessingPhase() {
  return (
    <div style={{ padding: "30px 0", textAlign: "center" }}>
      <div style={spinner} />
      <h2 style={h2Style}>Veriff está procesando…</h2>
      <p style={pStyle}>
        Comparando la selfie con la foto del DNI, validando liveness y cruzando con la base de
        datos de documentos. Esto demora segundos.
      </p>
    </div>
  );
}

function ApprovedPhase() {
  return (
    <div style={{ padding: "30px 0", textAlign: "center" }}>
      <div style={checkMark}>✓</div>
      <h2 style={{ ...h2Style, color: "#3a806b" }}>¡Identidad verificada!</h2>
      <p style={pStyle}>Te llevamos de vuelta al onboarding…</p>
    </div>
  );
}

function DeclinedPhase({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ padding: "30px 0", textAlign: "center" }}>
      <div style={{ ...checkMark, background: "#ef4444" }}>✗</div>
      <h2 style={{ ...h2Style, color: "#ef4444" }}>Verificación rechazada</h2>
      <p style={pStyle}>
        El verdict simulado fue <strong>declined</strong>. En producción, Veriff te diría el motivo
        (foto borrosa, no coincide el rostro, documento no detectable, etc.).
      </p>
      <button onClick={onRetry} style={btnPrimary}>Reintentar</button>
    </div>
  );
}

function Steps({ current }: { current: number }) {
  const labels = ["Foto del DNI", "Selfie", "Procesamiento"];
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
      {labels.map((label, i) => (
        <div key={label} style={{ flex: 1 }}>
          <div style={{
            height: 4, borderRadius: 999,
            background: i <= current ? "#3a806b" : "rgba(255,255,255,0.1)",
          }} />
          <div style={{ fontSize: 11, color: i <= current ? "#fff" : "rgba(255,255,255,0.4)", marginTop: 6, fontWeight: 600 }}>
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

const shell: React.CSSProperties = {
  minHeight: "100vh", background: "#0a0a0a",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 20,
};

const card: React.CSSProperties = {
  background: "#0f0f0f",
  borderRadius: 18,
  paddingTop: 32, paddingBottom: 32, paddingLeft: 28, paddingRight: 28,
  maxWidth: 480, width: "100%",
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 30px 70px rgba(0,0,0,0.55)",
};

const h2Style: React.CSSProperties = {
  fontSize: 22, fontWeight: 800, color: "#fff",
  marginTop: 4, marginBottom: 10, letterSpacing: -0.3,
};

const pStyle: React.CSSProperties = {
  fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.55, marginBottom: 20,
};

const btnPrimary: React.CSSProperties = {
  width: "100%", background: "#3a806b", color: "#fff",
  border: "none", borderRadius: 12, padding: 14,
  fontSize: 14, fontWeight: 700, cursor: "pointer",
};

const btnApprove: React.CSSProperties = {
  flex: 1, background: "rgba(58,128,107,0.2)", color: "#3a806b",
  border: "1px solid rgba(58,128,107,0.5)", borderRadius: 10,
  padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
};

const btnDecline: React.CSSProperties = {
  flex: 1, background: "rgba(239,68,68,0.12)", color: "#ef4444",
  border: "1px solid rgba(239,68,68,0.4)", borderRadius: 10,
  padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
};

const cameraFrame: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  paddingTop: 24, paddingBottom: 24, paddingLeft: 20, paddingRight: 20,
  marginBottom: 20,
  display: "flex", alignItems: "center", justifyContent: "center",
  minHeight: 220,
};

const placeholderDoc: React.CSSProperties = {
  background: "linear-gradient(135deg, #1a1a1a, #0f0f0f)",
  border: "1px solid rgba(58,128,107,0.3)",
  borderRadius: 10,
  paddingTop: 18, paddingBottom: 18, paddingLeft: 18, paddingRight: 18,
  width: "100%", maxWidth: 280,
  textAlign: "center",
};

const errorBox: React.CSSProperties = {
  background: "rgba(239,68,68,0.12)", color: "#ef4444",
  border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10,
  padding: 12, marginBottom: 16, fontSize: 13,
};

const spinner: React.CSSProperties = {
  width: 60, height: 60,
  border: "4px solid rgba(58,128,107,0.2)",
  borderTopColor: "#3a806b",
  borderRadius: "50%",
  margin: "0 auto 20px",
  animation: "verifSpin 0.9s linear infinite",
};

const checkMark: React.CSSProperties = {
  width: 70, height: 70, borderRadius: "50%",
  background: "#3a806b", color: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 36, fontWeight: 800,
  margin: "0 auto 18px",
};
