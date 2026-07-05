"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Step = {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  optional: boolean;
  cta_label: string;
  cta_path: string;
};

type Status = {
  role_kind: string;
  steps: Step[];
  completed_count: number;
  required_count: number;
  total_count: number;
  percent_complete: number;
  next_step: Step | null;
  ready_to_operate: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  transportista_individual: "Transportista individual",
  transportista_flota: "Dueño de flota",
  transportista_empleado: "Empleado de flota",
  dador_persona: "Dador de carga (persona física)",
  dador_empresa: "Dador de carga (empresa)",
};

const HOME_BY_KIND: Record<string, string> = {
  transportista_individual: "/transportista",
  transportista_flota: "/flota",
  transportista_empleado: "/empleado",
  dador_persona: "/dador",
  dador_empresa: "/dador",
};

export default function OnboardingPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  async function load() {
    try {
      const res = await fetch("/api/onboarding/status", { cache: "no-store" });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        setError("No pudimos cargar tu progreso. Reintentá en unos segundos.");
        setLoading(false);
        return;
      }
      const data: Status = await res.json();
      setStatus(data);
      setLoading(false);
    } catch {
      setError("Error de conexión.");
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!status) return;
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (loading) {
    return (
      <Centered>
        <p style={{ color: "rgba(255,255,255,0.7)" }}>Cargando tu progreso…</p>
      </Centered>
    );
  }

  if (error || !status) {
    return (
      <Centered>
        <p style={{ color: "#ef4444", marginBottom: 16 }}>{error || "Sin datos"}</p>
        <button onClick={load} style={primaryBtn}>Reintentar</button>
      </Centered>
    );
  }

  const home = HOME_BY_KIND[status.role_kind] ?? "/";
  const roleLabel = ROLE_LABELS[status.role_kind] ?? "Tu cuenta";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", padding: "48px 20px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Configuración inicial</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>
              {status.ready_to_operate ? "¡Estás listo para operar!" : "Completá tu cuenta"}
            </h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginTop: 6 }}>{roleLabel}</p>
          </div>
          <Link href={home} style={{ ...linkBtn, textDecoration: "none" }}>
            Ir al panel →
          </Link>
        </div>

        <ProgressBar percent={status.percent_complete} />
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "8px 0 32px" }}>
          {status.steps.filter((s) => s.completed).length} de {status.total_count} pasos completados
          {" "}({status.percent_complete}% obligatorios)
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {status.steps.map((s, i) => (
            <StepRow key={s.key} step={s} index={i + 1} />
          ))}
        </div>

        {status.ready_to_operate && (
          <div style={{
            marginTop: 32, padding: 20, borderRadius: 14,
            background: "rgba(58,128,107,0.15)", border: "1px solid rgba(58,128,107,0.4)",
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#3a806b", marginBottom: 6 }}>
              Tu cuenta está verificada ✓
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 14 }}>
              Ya podés operar en la plataforma. Te llevamos a tu panel.
            </p>
            <Link href={home} style={{ ...primaryBtn, textDecoration: "none", display: "inline-block" }}>
              Ir al panel →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function StepRow({ step, index }: { step: Step; index: number }) {
  const done = step.completed;
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 16,
      padding: 18, borderRadius: 14,
      background: done ? "rgba(58,128,107,0.08)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${done ? "rgba(58,128,107,0.4)" : "rgba(255,255,255,0.12)"}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: done ? "#3a806b" : "rgba(255,255,255,0.08)",
        color: done ? "#fff" : "rgba(255,255,255,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: 14, flexShrink: 0,
      }}>
        {done ? "✓" : index}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{step.label}</span>
          {step.optional && (
            <span style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 999,
              background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)",
              fontWeight: 600, letterSpacing: 0.3,
            }}>OPCIONAL</span>
          )}
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: done ? 0 : 12, lineHeight: 1.5 }}>
          {step.description}
        </p>
        {!done && (
          <Link href={step.cta_path} style={{ ...primaryBtn, fontSize: 13, padding: "8px 14px", textDecoration: "none", display: "inline-block" }}>
            {step.cta_label} →
          </Link>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div style={{
      height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden",
    }}>
      <div style={{
        width: `${percent}%`, height: "100%",
        background: "linear-gradient(90deg, #3a806b, #4ca888)",
        transition: "width 300ms ease",
      }} />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", padding: 20,
    }}>
      {children}
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  fontSize: 14, fontWeight: 600, padding: "10px 16px", borderRadius: 10,
  background: "#3a806b", color: "#fff", border: "none", cursor: "pointer",
};

const linkBtn: React.CSSProperties = {
  fontSize: 13, color: "rgba(255,255,255,0.7)", padding: "8px 12px",
  borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer",
  background: "transparent",
};
