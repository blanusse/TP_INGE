"use client";

import { useState, useEffect, useRef, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

const MAX_ATTEMPTS = 3;
const RESEND_COOLDOWN = 60;

function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [isPending, startTransition] = useTransition();
  const [verified, setVerified] = useState(false);

  const [cooldown, setCooldown] = useState(0);
  const [resendPending, startResendTransition] = useTransition();
  const [resendMessage, setResendMessage] = useState("");

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!email) router.replace("/login");
  }, [email, router]);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const code = digits.join("");

  const handleDigit = (index: number, value: string) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setError("");
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    // Auto-submit when all 6 digits entered
    if (char && index === 5) {
      const full = [...next].join("");
      if (full.length === 6) submitCode(full);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(""));
      setError("");
      submitCode(pasted);
    }
  };

  const submitCode = (codeToSubmit: string) => {
    if (attemptsLeft <= 0) return;
    startTransition(async () => {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: codeToSubmit }),
      });
      const data = await res.json();
      if (res.ok) {
        const raw = sessionStorage.getItem("pending_auth");
        if (raw) {
          const { email: e, password: p } = JSON.parse(raw);
          sessionStorage.removeItem("pending_auth");
          const result = await signIn("credentials", { email: e, password: p, redirect: false });
          if (!result?.error) { router.push("/dashboard"); router.refresh(); return; }
        }
        setVerified(true);
      } else {
        setError(data.message ?? "Código incorrecto.");
        setDigits(Array(6).fill(""));
        inputRefs.current[0]?.focus();
        if (data.message?.includes("intento")) {
          const match = data.message.match(/(\d+)/);
          if (match) setAttemptsLeft(parseInt(match[1]));
        } else if (data.message?.includes("Demasiados") || data.message?.includes("expiró")) {
          setAttemptsLeft(0);
        }
      }
    });
  };

  const handleResend = () => {
    setResendMessage("");
    startResendTransition(async () => {
      const res = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setDigits(Array(6).fill(""));
        setError("");
        setAttemptsLeft(MAX_ATTEMPTS);
        setCooldown(RESEND_COOLDOWN);
        setResendMessage("Nuevo código enviado. Revisá tu bandeja de entrada.");
        inputRefs.current[0]?.focus();
      } else {
        const data = await res.json();
        setResendMessage(data.message ?? "No se pudo reenviar el código.");
      }
    });
  };

  if (!email) return null;

  if (verified) {
    return (
      <div style={wrapStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(92,184,153,0.15)", border: "2px solid #5cb899", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5cb899" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 8 }}>¡Email verificado!</h1>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", marginBottom: 32 }}>Tu cuenta está activa. Podés iniciar sesión.</p>
            <button onClick={() => router.push("/login?modo=login")} style={btnPrimaryStyle}>
              Iniciar sesión →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <div style={cardStyle}>
        {/* Logo */}
        <button onClick={() => router.push("/")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 32, display: "block" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: -1 }}>
            Carga<span style={{ color: "#5cb899" }}>Back</span>
          </div>
        </button>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 8, letterSpacing: -0.5 }}>
          Verificá tu email
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 6, lineHeight: 1.5 }}>
          Enviamos un código de 6 dígitos a
        </p>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#5cb899", marginBottom: 32, wordBreak: "break-all" }}>
          {email}
        </p>

        {/* OTP inputs */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 24 }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              autoFocus={i === 0}
              style={{
                width: 46, height: 56, textAlign: "center", fontSize: 24, fontWeight: 700,
                borderRadius: 10, border: `2px solid ${error ? "#ef444460" : d ? "#5cb899" : "rgba(255,255,255,0.2)"}`,
                background: "#111", color: "#fff", outline: "none",
                transition: "border-color 0.15s",
              }}
            />
          ))}
        </div>

        {/* Attempt indicator */}
        {attemptsLeft < MAX_ATTEMPTS && attemptsLeft > 0 && (
          <p style={{ textAlign: "center", fontSize: 13, color: "#f59e0b", marginBottom: 12 }}>
            ⚠ Te queda{attemptsLeft === 1 ? "" : "n"} {attemptsLeft} intento{attemptsLeft === 1 ? "" : "s"}.
          </p>
        )}

        {/* Error message */}
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#b91c1c", fontWeight: 500 }}>
            ⚠ {error}
          </div>
        )}

        {/* Resend success message */}
        {resendMessage && !error && (
          <div style={{ background: "rgba(92,184,153,0.1)", border: "1px solid rgba(92,184,153,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#5cb899", fontWeight: 500 }}>
            ✓ {resendMessage}
          </div>
        )}

        {/* Verify button (shown when all digits filled and not auto-submitting) */}
        {code.length === 6 && !verified && (
          <button
            onClick={() => submitCode(code)}
            disabled={isPending || attemptsLeft <= 0}
            style={{ ...btnPrimaryStyle, marginBottom: 16, opacity: isPending ? 0.7 : 1 }}
          >
            {isPending ? "Verificando..." : "Verificar código"}
          </button>
        )}

        {/* Resend section */}
        <div style={{ textAlign: "center", marginTop: 8 }}>
          {cooldown > 0 ? (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
              Podés reenviar el código en {cooldown}s
            </p>
          ) : (
            <button
              onClick={handleResend}
              disabled={resendPending}
              style={{ background: "none", border: "none", fontSize: 13, color: "#5cb899", cursor: "pointer", fontWeight: 600, padding: 0, opacity: resendPending ? 0.7 : 1 }}
            >
              {resendPending ? "Enviando..." : "Reenviar código"}
            </button>
          )}
        </div>

        <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.1)", marginTop: 28, paddingTop: 20 }}>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
            ¿Email equivocado?{" "}
            <button onClick={() => router.push("/login?modo=registro")} style={{ background: "none", border: "none", color: "#5cb899", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0 }}>
              Registrate de nuevo
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  );
}

const wrapStyle: React.CSSProperties = {
  minHeight: "100vh", background: "#000",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "24px 16px",
};

const cardStyle: React.CSSProperties = {
  background: "#0a0a0a", border: "0.5px solid rgba(255,255,255,0.12)",
  borderRadius: 20, padding: "40px 40px 32px", width: "100%", maxWidth: 440,
};

const btnPrimaryStyle: React.CSSProperties = {
  width: "100%", fontSize: 15, padding: "13px",
  borderRadius: 12, background: "#3a806b", border: "none",
  color: "#fff", fontWeight: 700, cursor: "pointer",
  letterSpacing: 0.2, boxShadow: "0 4px 14px #3a806b30",
};
