"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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
  ready_to_operate: boolean;
  required_count: number;
  completed_count: number;
  percent_complete: number;
  next_step: Step | null;
  steps: Step[];
  role_kind: string;
};

const PROTECTED_PREFIXES = ["/transportista", "/flota", "/empleado", "/dador", "/dashboard"];

function isProtected(pathname: string | null): boolean {
  if (!pathname) return false;
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

async function fetchStatus(): Promise<Status | null> {
  try {
    const res = await fetch("/api/onboarding/status", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Status;
  } catch {
    return null;
  }
}

export function OnboardingGate() {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isProtected(pathname)) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    fetchStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!isProtected(pathname)) return;
    const onFocus = async () => {
      const s = await fetchStatus();
      if (s) setStatus(s);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [pathname]);

  // Interceptor global: si cualquier llamada del frontend recibe un 403 con
  // code "ONBOARDING_INCOMPLETE", reabre el modal y refresca el status.
  // Esto cubre el caso del guard RequireOnboardingComplete (hard mode) cuando
  // el usuario intentó ofertar/publicar y el backend lo rechazó.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const original = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await original(input, init);
      if (res.status === 403) {
        try {
          const clone = res.clone();
          const data = await clone.json();
          const code = data?.message?.code ?? data?.code;
          if (code === "ONBOARDING_INCOMPLETE") {
            window.dispatchEvent(new CustomEvent("onboarding-incomplete"));
          }
        } catch {
          // body no era JSON; ignorar
        }
      }
      return res;
    };
    return () => {
      window.fetch = original;
    };
  }, []);

  useEffect(() => {
    const onBlocked = async () => {
      setDismissed(false);
      const s = await fetchStatus();
      if (s) setStatus(s);
    };
    window.addEventListener("onboarding-incomplete", onBlocked);
    return () => window.removeEventListener("onboarding-incomplete", onBlocked);
  }, []);

  const visible =
    isProtected(pathname) && !!status && !status.ready_to_operate && !dismissed;

  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  if (!visible || !status) return null;

  const missing = status.required_count - status.completed_count;
  const requiredSteps = status.steps.filter((s) => !s.optional);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        animation: "onbFadeIn 200ms ease-out",
      }}
    >
      <style>{`
        @keyframes onbFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes onbSlideUp { from { transform: translateY(24px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
      <div
        style={{
          background: "#0a0a0a",
          borderRadius: 18,
          padding: "32px 28px",
          maxWidth: 560,
          width: "100%",
          maxHeight: "88vh",
          overflow: "auto",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 30px 70px rgba(0,0,0,0.6), 0 0 0 1px rgba(58,128,107,0.18)",
          animation: "onbSlideUp 280ms ease-out",
        }}
      >
        <div style={{ marginBottom: 22 }}>
          <div
            style={{
              fontSize: 11,
              color: "#3a806b",
              letterSpacing: 1.5,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            CONFIGURACIÓN INICIAL
          </div>
          <h2
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: -0.5,
              marginBottom: 8,
              lineHeight: 1.2,
            }}
          >
            Completá tu cuenta para empezar
          </h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
            Te {missing === 1 ? "falta" : "faltan"} <strong style={{ color: "#fff" }}>{missing} paso{missing === 1 ? "" : "s"}</strong> obligatorio{missing === 1 ? "" : "s"} para poder operar en la plataforma.
          </p>
        </div>

        <div
          style={{
            height: 8,
            background: "rgba(255,255,255,0.08)",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${status.percent_complete}%`,
              height: "100%",
              background: "linear-gradient(90deg, #3a806b, #4ca888)",
              transition: "width 300ms ease",
            }}
          />
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "8px 0 22px" }}>
          {status.completed_count} de {status.required_count} pasos completados ({status.percent_complete}%)
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
          {requiredSteps.map((s, i) => (
            <StepRow
              key={s.key}
              step={s}
              index={i + 1}
              onCtaClick={() => setDismissed(true)}
            />
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          <Link
            href="/onboarding"
            onClick={() => setDismissed(true)}
            style={{
              width: "100%",
              textAlign: "center",
              background: "#3a806b",
              color: "#fff",
              padding: "13px",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Ver todos los pasos →
          </Link>
          <button
            onClick={() => setDismissed(true)}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.4)",
              fontSize: 12,
              cursor: "pointer",
              padding: "6px 8px",
            }}
          >
            Mirar la app por ahora (no podrás operar)
          </button>
        </div>
      </div>
    </div>
  );
}

function StepRow({
  step,
  index,
  onCtaClick,
}: {
  step: Step;
  index: number;
  onCtaClick: () => void;
}) {
  const done = step.completed;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 10,
        background: done ? "rgba(58,128,107,0.1)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${done ? "rgba(58,128,107,0.4)" : "rgba(255,255,255,0.1)"}`,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: done ? "#3a806b" : "rgba(255,255,255,0.08)",
          color: done ? "#fff" : "rgba(255,255,255,0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        {done ? "✓" : index}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>
          {step.label}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>
          {step.description}
        </div>
      </div>
      {!done && (
        step.key === "mp_conectado" ? (
          <a
            href="/api/auth/mp/connect"
            style={{
              background: "#3a806b",
              color: "#fff",
              padding: "7px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {step.cta_label}
          </a>
        ) : (
          <Link
            href={step.cta_path}
            onClick={onCtaClick}
            style={{
              background: "#3a806b",
              color: "#fff",
              padding: "7px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {step.cta_label}
          </Link>
        )
      )}
    </div>
  );
}
