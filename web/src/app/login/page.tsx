"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Perfil = "camionero" | "flota" | "dador";
type Paso = "perfil" | "credenciales";

const PERFILES: { id: Perfil; titulo: string; subtitulo: string; icono: string }[] = [
  {
    id: "camionero",
    titulo: "Soy camionero independiente",
    subtitulo: "Busco cargas para mis rutas y gestiono mis viajes",
    icono: "🚛",
  },
  {
    id: "flota",
    titulo: "Tengo una empresa de flota",
    subtitulo: "Gestiono múltiples camiones y conductores",
    icono: "🏢",
  },
  {
    id: "dador",
    titulo: "Tengo cargas para enviar",
    subtitulo: "Publico cargas y elijo el mejor camionero",
    icono: "📦",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>("perfil");
  const [perfilSeleccionado, setPerfilSeleccionado] = useState<Perfil | null>(null);
  const [esRegistro, setEsRegistro] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const destino =
    perfilSeleccionado === "dador" ? "/dador" : "/camionero";

  const handleSeleccionarPerfil = (perfil: Perfil) => {
    setPerfilSeleccionado(perfil);
    setPaso("credenciales");
    setError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password || !perfilSeleccionado) return;

    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValido) {
      setError("Ingresá un email válido.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (esRegistro && !nombre.trim()) {
      setError("Ingresá tu nombre completo.");
      return;
    }
    if (esRegistro && !aceptaTerminos) {
      setError("Tenés que aceptar los términos para continuar.");
      return;
    }

    startTransition(async () => {
      const result = await signIn("credentials", {
        email,
        password,
        role: perfilSeleccionado,
        redirect: false,
      });

      if (result?.error) {
        setError("Email o contraseña incorrectos. Intentá de nuevo.");
      } else {
        router.push(destino);
        router.refresh();
      }
    });
  };

  const perfilInfo = PERFILES.find((p) => p.id === perfilSeleccionado);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-background-tertiary)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <Link
        href="/"
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: "var(--color-text-primary)",
          textDecoration: "none",
          marginBottom: 32,
        }}
      >
        Carga<span style={{ color: "var(--color-brand)" }}>Back</span>
      </Link>

      <div
        style={{
          background: "var(--color-background-primary)",
          border: "0.5px solid var(--color-border-tertiary)",
          borderRadius: "var(--border-radius-lg)",
          padding: 32,
          width: "100%",
          maxWidth: paso === "perfil" ? 520 : 400,
          transition: "max-width 0.2s ease",
        }}
      >
        {/* ── PASO 1: Selección de perfil ── */}
        {paso === "perfil" && (
          <>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "var(--color-text-primary)",
                marginBottom: 4,
              }}
            >
              {esRegistro ? "Crear cuenta" : "Bienvenido de vuelta"}
            </h1>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 24 }}>
              ¿Cuál describe mejor tu rol?
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {PERFILES.map((perfil) => (
                <button
                  key={perfil.id}
                  onClick={() => handleSeleccionarPerfil(perfil.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 16px",
                    borderRadius: "var(--border-radius-md)",
                    border: "0.5px solid var(--color-border-secondary)",
                    background: "var(--color-background-secondary)",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-brand)";
                    e.currentTarget.style.background = "var(--color-brand-light)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-border-secondary)";
                    e.currentTarget.style.background = "var(--color-background-secondary)";
                  }}
                >
                  <span style={{ fontSize: 24 }}>{perfil.icono}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>
                      {perfil.titulo}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
                      {perfil.subtitulo}
                    </div>
                  </div>
                  <span style={{ color: "var(--color-text-tertiary)", fontSize: 16 }}>→</span>
                </button>
              ))}
            </div>

            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", textAlign: "center", marginTop: 20 }}>
              {esRegistro ? "¿Ya tenés cuenta?" : "¿No tenés cuenta?"}{" "}
              <button
                onClick={() => setEsRegistro(!esRegistro)}
                style={{
                  background: "none", border: "none",
                  color: "var(--color-brand)", fontWeight: 500,
                  cursor: "pointer", fontSize: 13, padding: 0,
                }}
              >
                {esRegistro ? "Iniciá sesión" : "Registrate gratis"}
              </button>
            </p>
          </>
        )}

        {/* ── PASO 2: Credenciales ── */}
        {paso === "credenciales" && perfilInfo && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <button
                onClick={() => { setPaso("perfil"); setError(""); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--color-text-tertiary)", fontSize: 20, padding: 0, lineHeight: 1,
                }}
              >
                ←
              </button>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)" }}>
                  {esRegistro ? "Crear cuenta" : "Iniciá sesión"}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
                  {perfilInfo.icono} {perfilInfo.titulo}
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              {/* Nombre (solo registro) */}
              {esRegistro && (
                <div style={{ marginBottom: 14 }}>
                  <label htmlFor="nombre" style={labelStyle}>Nombre completo</label>
                  <input
                    id="nombre"
                    type="text"
                    autoComplete="name"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Juan Rodríguez"
                    style={inputStyle}
                  />
                </div>
              )}

              {/* Email */}
              <div style={{ marginBottom: 14 }}>
                <label htmlFor="email" style={labelStyle}>Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  style={inputStyle}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: esRegistro ? 14 : 6 }}>
                <label htmlFor="password" style={labelStyle}>Contraseña</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="password"
                    type={mostrarPassword ? "text" : "password"}
                    autoComplete={esRegistro ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={esRegistro ? "Mínimo 8 caracteres" : "Tu contraseña"}
                    style={{ ...inputStyle, paddingRight: 56 }}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword(!mostrarPassword)}
                    style={{
                      position: "absolute", right: 10, top: "50%",
                      transform: "translateY(-50%)", background: "none",
                      border: "none", cursor: "pointer",
                      color: "var(--color-text-tertiary)", fontSize: 12, padding: 0,
                    }}
                  >
                    {mostrarPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </div>

              {/* Fuerza de contraseña (solo registro) */}
              {esRegistro && password.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                    {[1, 2, 3, 4].map((n) => (
                      <div
                        key={n}
                        style={{
                          flex: 1, height: 3, borderRadius: 2,
                          background: passwordStrength(password) >= n
                            ? strengthColor(passwordStrength(password))
                            : "var(--color-border-secondary)",
                          transition: "background 0.2s",
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: 11, color: strengthColor(passwordStrength(password)) }}>
                    {strengthLabel(passwordStrength(password))}
                  </span>
                </div>
              )}

              {/* Olvidé contraseña */}
              {!esRegistro && (
                <div style={{ textAlign: "right", marginBottom: 16 }}>
                  <button
                    type="button"
                    style={{
                      background: "none", border: "none",
                      fontSize: 12, color: "var(--color-brand)",
                      cursor: "pointer", padding: 0,
                    }}
                    onClick={() => alert("Próximamente: recuperación de contraseña por email.")}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{
                  fontSize: 13, color: "#b91c1c",
                  background: "#fef2f2",
                  border: "0.5px solid #fecaca",
                  borderRadius: "var(--border-radius-md)",
                  padding: "8px 12px", marginBottom: 14,
                }}>
                  {error}
                </div>
              )}

              {/* Términos */}
              {esRegistro && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 16 }}>
                  <input
                    type="checkbox"
                    id="terminos"
                    checked={aceptaTerminos}
                    onChange={(e) => setAceptaTerminos(e.target.checked)}
                    style={{ marginTop: 2, accentColor: "var(--color-brand)", cursor: "pointer" }}
                  />
                  <label htmlFor="terminos" style={{ fontSize: 12, color: "var(--color-text-secondary)", cursor: "pointer" }}>
                    Acepto los{" "}
                    <span style={{ color: "var(--color-brand)" }}>términos y condiciones</span>
                    {" "}y la{" "}
                    <span style={{ color: "var(--color-brand)" }}>política de privacidad</span>
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                style={{
                  width: "100%", fontSize: 14, padding: "10px",
                  borderRadius: "var(--border-radius-md)",
                  background: isPending ? "#a7d7c5" : "var(--color-brand)",
                  border: "none", color: "#fff", fontWeight: 600,
                  cursor: isPending ? "not-allowed" : "pointer",
                }}
              >
                {isPending ? "Verificando..." : esRegistro ? "Crear cuenta" : "Ingresar"}
              </button>
            </form>

            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", textAlign: "center", marginTop: 16 }}>
              {esRegistro ? "¿Ya tenés cuenta?" : "¿No tenés cuenta?"}{" "}
              <button
                onClick={() => { setEsRegistro(!esRegistro); setError(""); }}
                style={{
                  background: "none", border: "none",
                  color: "var(--color-brand)", fontWeight: 500,
                  cursor: "pointer", fontSize: 13, padding: 0,
                }}
              >
                {esRegistro ? "Iniciá sesión" : "Registrate gratis"}
              </button>
            </p>
          </>
        )}
      </div>

      <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 20, textAlign: "center" }}>
        🔒 Conexión segura · Tus datos están protegidos
      </p>
    </div>
  );
}

// ── Estilos compartidos ──────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 500,
  color: "var(--color-text-secondary)", marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%", fontSize: 14, padding: "9px 12px",
  borderRadius: "var(--border-radius-md)",
  border: "0.5px solid var(--color-border-secondary)",
  background: "var(--color-background-secondary)",
  color: "var(--color-text-primary)", outline: "none",
  boxSizing: "border-box",
};

// ── Fuerza de contraseña ─────────────────────────────────────────────────────
function passwordStrength(pwd: string): number {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.max(1, score);
}

function strengthColor(score: number) {
  return ["", "#ef4444", "#f97316", "#eab308", "#22c55e"][score];
}

function strengthLabel(score: number) {
  return ["", "Muy débil", "Débil", "Buena", "Muy segura"][score];
}
