"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Phase = "starting" | "waiting" | "approved" | "declined" | "timeout";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const done = params.get("done") === "1";
  const [phase, setPhase] = useState<Phase>(done ? "waiting" : "starting");
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  // Arranque: si NO viene ?done=1, pedimos start y redirigimos al widget de Veriff.
  useEffect(() => {
    if (done || startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/verification/start", { method: "POST" });
        if (!res.ok) {
          setError("No pudimos iniciar la verificación. Intentá de nuevo.");
          return;
        }
        const data = await res.json();
        if (!data?.url) {
          setError("Respuesta inválida del servidor.");
          return;
        }
        window.location.href = data.url;
      } catch {
        setError("Error de conexión.");
      }
    })();
  }, [done]);

  // Retorno desde Veriff: polling a /verification/status hasta ver aprobación o timeout.
  useEffect(() => {
    if (!done) return;
    let cancelled = false;
    const deadline = Date.now() + 60_000;

    async function poll() {
      while (!cancelled && Date.now() < deadline) {
        try {
          const res = await fetch("/api/verification/status");
          if (res.ok) {
            const data = await res.json();
            if (data.identity_verified) {
              if (cancelled) return;
              setPhase("approved");
              setTimeout(() => router.push("/onboarding?verified=1"), 1800);
              return;
            }
            if (data.last_session_status === "declined") {
              if (cancelled) return;
              setPhase("declined");
              return;
            }
          }
        } catch {
          /* seguimos intentando */
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) setPhase("timeout");
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [done, router]);

  async function retry() {
    setError("");
    setPhase("starting");
    try {
      const res = await fetch("/api/verification/start", { method: "POST" });
      if (!res.ok) {
        setError("No pudimos reiniciar la verificación.");
        return;
      }
      const data = await res.json();
      if (data?.url) window.location.href = data.url;
    } catch {
      setError("Error de conexión.");
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

        {phase === "starting" && <StartingPhase />}
        {phase === "waiting" && <WaitingPhase />}
        {phase === "approved" && <ApprovedPhase />}
        {phase === "declined" && <DeclinedPhase onRetry={retry} />}
        {phase === "timeout" && <TimeoutPhase />}

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

function StartingPhase() {
  return (
    <div style={{ padding: "30px 0", textAlign: "center" }}>
      <div style={spinner} />
      <h2 style={h2Style}>Iniciando verificación…</h2>
      <p style={pStyle}>
        Te vamos a redirigir al widget de Veriff para que saques la foto de tu DNI y una selfie.
      </p>
    </div>
  );
}

function WaitingPhase() {
  return (
    <div style={{ padding: "30px 0", textAlign: "center" }}>
      <div style={spinner} />
      <h2 style={h2Style}>Esperando decisión de Veriff…</h2>
      <p style={pStyle}>
        Recibimos tu verificación. Estamos esperando el resultado final. Esto puede tardar unos segundos.
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
        Veriff rechazó la verificación. Puede ser por foto borrosa, documento no detectable, o el
        rostro no coincide con el DNI.
      </p>
      <button onClick={onRetry} style={btnPrimary}>Reintentar</button>
    </div>
  );
}

function TimeoutPhase() {
  return (
    <div style={{ padding: "30px 0", textAlign: "center" }}>
      <div style={spinner} />
      <h2 style={h2Style}>Estamos procesando tu verificación</h2>
      <p style={pStyle}>
        La decisión de Veriff está tardando más de lo habitual. Te avisamos por email en cuanto esté
        lista — podés cerrar esta ventana y volver más tarde.
      </p>
      <Link href="/onboarding" style={{ ...btnPrimary, display: "inline-block", textDecoration: "none", textAlign: "center" }}>
        Volver al onboarding
      </Link>
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
