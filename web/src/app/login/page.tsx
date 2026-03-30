"use client";

import { useState, useTransition, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Perfil    = "transportista" | "dador";
type Paso      = "inicio" | "perfil" | "dador-tipo" | "login" | "registro";
type TipoDador = "personal" | "empresa";

function LoginInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [paso, setPaso]     = useState<Paso>("inicio");
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [tipoDador, setTipoDador] = useState<TipoDador | null>(null);
  const [from, setFrom]     = useState<string | null>(null);

  useEffect(() => {
    const modo      = searchParams.get("modo");
    const perfilP   = searchParams.get("perfil") as Perfil | null;
    const fromP     = searchParams.get("from");
    if (fromP) setFrom(fromP);
    if (perfilP) setPerfil(perfilP);
    if (modo === "login")                         setPaso("login");
    else if (modo === "registro" && perfilP)      setPaso(perfilP === "dador" ? "dador-tipo" : "registro");
    else if (modo === "registro")                 setPaso("perfil");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [nombre, setNombre]       = useState("");
  const [dni, setDni]             = useState("");
  const [telefono, setTelefono]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [mostrarPwd, setMostrarPwd]       = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [razonSocial, setRazonSocial] = useState("");
  const [cuit, setCuit]               = useState("");
  const [direccion, setDireccion]     = useState("");
  const [error, setError]             = useState("");
  const [isPending, startTransition]  = useTransition();
  const [emailDisponible, setEmailDisponible]         = useState<boolean | null>(null);
  const [telefonoDisponible, setTelefonoDisponible]   = useState<boolean | null>(null);

  // Verificación en tiempo real: email
  useEffect(() => {
    if (paso !== "registro") return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailDisponible(null); return; }
    setEmailDisponible(null);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check?field=email&value=${encodeURIComponent(email)}`);
        const { available } = await res.json();
        setEmailDisponible(available);
      } catch { /* ignorar errores de red */ }
    }, 600);
    return () => clearTimeout(timer);
  }, [email, paso]); // eslint-disable-line react-hooks/exhaustive-deps

  // Verificación en tiempo real: celular
  useEffect(() => {
    if (paso !== "registro") return;
    if (!telefono || !/^\+?\d{8,15}$/.test(telefono.replace(/\s/g, ""))) { setTelefonoDisponible(null); return; }
    setTelefonoDisponible(null);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check?field=phone&value=${encodeURIComponent(telefono)}`);
        const { available } = await res.json();
        setTelefonoDisponible(available);
      } catch { /* ignorar errores de red */ }
    }, 600);
    return () => clearTimeout(timer);
  }, [telefono, paso]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBack = () => from === "dashboard" ? router.push("/dashboard") : router.push("/");

  const resetForm = () => {
    setNombre(""); setDni(""); setTelefono(""); setEmail(""); setPassword("");
    setRazonSocial(""); setCuit(""); setDireccion("");
    setAceptaTerminos(false); setError("");
  };

  const irAInicio  = () => { setPaso("inicio"); setPerfil(null); setTipoDador(null); setError(""); };
  const irAPerfil  = () => { setPaso("perfil"); setTipoDador(null); setError(""); };

  const handleSeleccionarPerfil = (p: Perfil) => {
    setPerfil(p); setTipoDador(null); setError("");
    setPaso(p === "dador" ? "dador-tipo" : "registro");
  };

  const handleSeleccionarTipoDador = (tipo: TipoDador) => {
    setTipoDador(tipo); setPaso("registro"); setError("");
  };

  const validarPersonal = (): string | null => {
    if (!nombre.trim())  return "Ingresá tu nombre completo.";
    if (perfil === "transportista") {
      if (!/^\d{7,8}$/.test(dni.replace(/\./g, ""))) return "El DNI debe tener 7 u 8 dígitos numéricos.";
    }
    if (perfil === "dador" && tipoDador === "personal") {
      if (!/^\d{7,8}$/.test(dni.replace(/\./g, ""))) return "El DNI debe tener 7 u 8 dígitos numéricos.";
    }
    if (!telefono.trim()) return "El teléfono es obligatorio.";
    if (!/^\+?\d{8,15}$/.test(telefono.replace(/\s/g, ""))) return "El teléfono debe tener entre 8 y 15 dígitos.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Email inválido.";
    if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    if (perfil === "dador" && tipoDador === "empresa" && !razonSocial.trim()) return "Ingresá la razón social.";
    if (perfil === "dador" && tipoDador === "empresa" && !/^\d{2}-\d{8}-\d$/.test(cuit)) return "El CUIT debe tener el formato XX-XXXXXXXX-X.";
    if (!aceptaTerminos) return "Aceptá los términos para continuar.";
    return null;
  };

  const handleRegistro = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const err = validarPersonal();
    if (err) { setError(err); return; }

    startTransition(async () => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email, password, name: nombre, role: perfil,
          tipo_dador: tipoDador || null, phone: telefono || null, dni: dni || null,
          razon_social: razonSocial || null, cuit: cuit || null, address: direccion || null,
        }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        setError(msg ?? "Error al crear la cuenta.");
        return;
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) setError("Cuenta creada. Iniciá sesión.");
      else { router.push("/dashboard"); router.refresh(); }
    });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Email inválido."); return; }
    startTransition(async () => {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) setError("Email o contraseña incorrectos.");
      else { router.push("/dashboard"); router.refresh(); }
    });
  };

  // ── Panel izquierdo (branding) ─────────────────────────────────────────────
  const panelIzq = (
    <div style={{ background: "linear-gradient(160deg, #0a1510 0%, #0f6e56 70%, #1d9e75 100%)", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "40px 36px", height: "100%" }}>
      <button onClick={handleBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
        <div style={{ fontSize: 36, fontWeight: 800, color: "#fff", letterSpacing: -1 }}>
          Carga<span style={{ color: "#6ee7b7" }}>Back</span>
        </div>
      </button>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 36 }}>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, margin: 0 }}>
          La red logística más grande de Argentina.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { valor: "3.400+", label: "Transportistas activos" },
            { valor: "1.200+", label: "Cargas por mes" },
            { valor: "94%",    label: "Viajes con retorno" },
            { valor: "12 min", label: "Tiempo de match" },
          ].map((s) => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "16px 14px" }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#6ee7b7", letterSpacing: -1, lineHeight: 1 }}>{s.valor}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 5, lineHeight: 1.3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "20px 18px" }}>
          <div style={{ fontSize: 22, color: "#6ee7b7", marginBottom: 10, lineHeight: 1 }}>"</div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.65, margin: "0 0 16px", fontStyle: "italic" }}>
            Antes volvía vacío de Buenos Aires siempre. Ahora en 20 minutos encuentro carga para el regreso. Cambió todo.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#1d9e75,#6ee7b7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>C</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Carlos M.</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Transportista · Rosario</div>
            </div>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>© 2026 CargaBack · Argentina</p>
    </div>
  );

  const panelDer = (
    <div style={{ background: "#fff", display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "40px 64px" }}>

        {/* ── Inicio ── */}
        {paso === "inicio" && (
          <div style={{ maxWidth: 380, width: "100%" }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0a1510", marginBottom: 8, letterSpacing: -0.5 }}>Bienvenido</h1>
            <p style={{ fontSize: 15, color: "var(--color-text-secondary)", marginBottom: 32 }}>¿Qué querés hacer?</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button onClick={() => { resetForm(); setPaso("login"); }}
                style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", borderRadius: 12, border: "1.5px solid var(--color-border-secondary)", background: "#fff", cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-brand)"; e.currentTarget.style.boxShadow = "0 0 0 3px #1d9e7515"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border-secondary)"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--color-brand-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>👤</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#0a1510" }}>Iniciar sesión</div>
                  <div style={{ fontSize: 13, color: "var(--color-text-tertiary)", marginTop: 2 }}>Ya tengo una cuenta</div>
                </div>
                <span style={{ color: "var(--color-text-secondary)", fontSize: 18 }}>→</span>
              </button>

              <button onClick={() => { resetForm(); setPaso("perfil"); }}
                style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", borderRadius: 12, border: "1.5px solid var(--color-border-secundary)", background: "#fff", cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.15s"  }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-brand)"; e.currentTarget.style.boxShadow = "0 0 0 3px #1d9e7515"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border-secondary)"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--color-brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✨</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#0a1510" }}>Registrarse gratis</div>
                  <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>Crear cuenta nueva</div>
                </div>
                <span style={{ color: "var(--color-brand)", fontSize: 18 }}>→</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Login ── */}
        {paso === "login" && (
          <div style={{ maxWidth: 400, width: "100%" }}>
            <BtnVolver onClick={irAInicio} />
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0a1510", marginBottom: 4, letterSpacing: -0.5 }}>Iniciá sesión</h1>
            <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 28 }}>Ingresá con tu email y contraseña</p>

            <form onSubmit={handleLogin} noValidate style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <Campo label="Email" id="email" type="email" autoComplete="email" value={email} onChange={setEmail} placeholder="tu@email.com" />
              <CampoPassword label="Contraseña" value={password} onChange={setPassword} mostrar={mostrarPwd} onToggle={() => setMostrarPwd(!mostrarPwd)} placeholder="Tu contraseña" />
              <div style={{ textAlign: "right", marginBottom: 20 }}>
                <button type="button" style={{ background: "none", border: "none", fontSize: 13, color: "var(--color-brand)", cursor: "pointer", padding: 0, fontWeight: 500 }}
                  onClick={() => alert("Próximamente: recuperación de contraseña.")}>
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              {error && <MensajeError mensaje={error} />}
              <BtnPrimario isPending={isPending} label="Ingresar" labelPending="Verificando..." />
            </form>

            <Divider />
            <p style={{ textAlign: "center", fontSize: 14, color: "var(--color-text-secondary)" }}>
              ¿No tenés cuenta?{" "}
              <button onClick={() => { resetForm(); setPaso("perfil"); }} style={linkBtnStyle}>Registrate gratis</button>
            </p>
          </div>
        )}

        {/* ── Selección de perfil ── */}
        {paso === "perfil" && (
          <div style={{ maxWidth: 520, width: "100%" }}>
            <BtnVolver onClick={irAInicio} />
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0a1510", marginBottom: 4, letterSpacing: -0.5 }}>Crear cuenta</h1>
            <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 24 }}>¿Cuál describe mejor tu rol?</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {([
                {
                  id: "transportista" as Perfil,
                  icono: "🚛", titulo: "Soy transportista",
                  subtitulo: "Camionero independiente o empresa de flota",
                  color: "#0f6e56", bg: "#e1f5ee", border: "#1d9e75",
                  features: ["Encontrá cargas para tu vuelta en minutos", "Ofertá tu precio directamente", "Gestioná tu flota desde un panel unificado"],
                },
                {
                  id: "dador" as Perfil,
                  icono: "📦", titulo: "Tengo cargas para enviar",
                  subtitulo: "Empresa o persona que necesita transporte",
                  color: "#7c3aed", bg: "#f3f0ff", border: "#7c3aed",
                  features: ["Publicá tu carga en menos de 2 minutos", "Recibí ofertas de transportistas verificados", "Seguimiento en tiempo real de cada envío"],
                },
              ]).map((p) => (
                <button key={p.id} onClick={() => handleSeleccionarPerfil(p.id)}
                  style={{ display: "block", padding: 0, borderRadius: 14, border: `1.5px solid ${p.border}33`, background: "#fff", cursor: "pointer", textAlign: "left", width: "100%", overflow: "hidden", transition: "box-shadow 0.15s, border-color 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 4px 20px ${p.border}22`; e.currentTarget.style.borderColor = p.border; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = `${p.border}33`; }}>
                  <div style={{ background: p.bg, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 28 }}>{p.icono}</span>
                      <div>
                        <span style={{ fontSize: 16, fontWeight: 800, color: p.color, display: "block" }}>{p.titulo}</span>
                        <span style={{ fontSize: 12, color: p.color, opacity: 0.7 }}>{p.subtitulo}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 18, color: p.color, opacity: 0.7 }}>→</span>
                  </div>
                  <div style={{ padding: "14px 20px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {p.features.map((f) => (
                      <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: p.color, fontSize: 12, flexShrink: 0 }}>✓</span>
                        <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            <Divider />
            <p style={{ textAlign: "center", fontSize: 14, color: "var(--color-text-secondary)" }}>
              ¿Ya tenés cuenta?{" "}
              <button onClick={() => { resetForm(); setPaso("login"); }} style={linkBtnStyle}>Iniciá sesión</button>
            </p>
          </div>
        )}

        {/* ── Dador: personal o empresa ── */}
        {paso === "dador-tipo" && (
          <div style={{ maxWidth: 420, width: "100%" }}>
            <BtnVolver onClick={irAPerfil} />
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0a1510", marginBottom: 4, letterSpacing: -0.5 }}>Dador de carga</h1>
            <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 28 }}>¿Cómo vas a operar?</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {([
                { id: "personal" as TipoDador, icono: "👤", titulo: "Persona física",   sub: "Publico cargas a título personal" },
                { id: "empresa"  as TipoDador, icono: "🏢", titulo: "Empresa / S.R.L.", sub: "Opero con razón social y CUIT" },
              ] as const).map((op) => (
                <button key={op.id} onClick={() => handleSeleccionarTipoDador(op.id)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 12, border: "1.5px solid var(--color-border-secondary)", background: "#fff", cursor: "pointer", textAlign: "left", width: "100%" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-brand)"; e.currentTarget.style.background = "var(--color-brand-light)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border-secondary)"; e.currentTarget.style.background = "#fff"; }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: "var(--color-background-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{op.icono}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0a1510" }}>{op.titulo}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 2 }}>{op.sub}</div>
                  </div>
                  <span style={{ color: "var(--color-text-tertiary)", fontSize: 18 }}>→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Registro ── */}
        {paso === "registro" && perfil && (
          <div style={{ maxWidth: 520, width: "100%" }}>
            <BtnVolver onClick={perfil === "dador" ? () => setPaso("dador-tipo") : irAPerfil} />
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0a1510", marginBottom: 8, letterSpacing: -0.5 }}>Crear cuenta</h1>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--color-brand-light)", color: "var(--color-brand-dark)", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                {perfil === "transportista" ? "🚛 Transportista" : "📦 Dador de carga"}
                {perfil === "dador" && tipoDador === "empresa" ? " · Empresa" : perfil === "dador" ? " · Personal" : ""}
              </div>
            </div>

            <form onSubmit={handleRegistro} noValidate>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <Campo
                  label={perfil === "dador" && tipoDador === "empresa" ? "Nombre del responsable" : "Nombre y apellido"}
                  id="nombre" type="text" autoComplete="name" value={nombre} onChange={setNombre}
                  placeholder="Juan Rodríguez"
                  style={{ gridColumn: "1 / -1" }} required />
                {(perfil === "transportista" || (perfil === "dador" && tipoDador === "personal")) && (
                  <Campo label="DNI" id="dni" type="text" value={dni} onChange={(v) => setDni(v.replace(/\D/g, ""))} placeholder="12345678" maxLength={8} inputMode="numeric" required />
                )}
                <Campo label="Celular" id="tel" type="tel" value={telefono} onChange={(v) => setTelefono(v.replace(/[^\d+\s]/g, ""))} placeholder="+54 9 11 1234-5678" maxLength={15} inputMode="tel" required
                  hint={telefonoDisponible === false ? { text: "⚠ Este celular ya está registrado.", color: "#ef4444" } : telefonoDisponible === true ? { text: "✓ Celular disponible.", color: "#16a34a" } : undefined} />
                <Campo label="Email" id="email" type="email" autoComplete="email" value={email} onChange={setEmail} placeholder="tu@email.com" style={{ gridColumn: "1 / -1" }} required
                  hint={emailDisponible === false ? { text: "⚠ Este email ya está registrado.", color: "#ef4444" } : emailDisponible === true ? { text: "✓ Email disponible.", color: "#16a34a" } : undefined} />
              </div>

              {perfil === "dador" && tipoDador === "empresa" && <>
                <Separador label="Empresa" />
                <Campo label="Razón social" id="rs" type="text" value={razonSocial} onChange={setRazonSocial} placeholder="Mi Empresa S.R.L." required />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                  <Campo label="CUIT" id="cuit" type="text" value={cuit} onChange={(v) => setCuit(formatCuit(v))} placeholder="20-12345678-9" maxLength={13} inputMode="numeric" required />
                  <Campo label="Dirección" id="dir" type="text" value={direccion} onChange={setDireccion} placeholder="Av. Corrientes 1234" />
                </div>
              </>}

              {perfil === "transportista" && (
                <div style={{ background: "var(--color-brand-light)", border: "0.5px solid var(--color-brand)", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                  <p style={{ fontSize: 13, color: "var(--color-brand-dark)", margin: 0, lineHeight: 1.5 }}>
                    🚛 <strong>Una vez que ingreses</strong>, vas a poder agregar tus camiones y conductores desde la sección <strong>Mi flota</strong>.
                  </p>
                </div>
              )}

              <Separador label="Contraseña" />
              <CampoPassword label="Contraseña" value={password} onChange={setPassword} mostrar={mostrarPwd} onToggle={() => setMostrarPwd(!mostrarPwd)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" required />
              {password.length > 0 && <IndicadorFuerza password={password} />}

              {error && <MensajeError mensaje={error} />}

              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 20 }}>
                <input type="checkbox" id="terminos" checked={aceptaTerminos} onChange={(e) => setAceptaTerminos(e.target.checked)} style={{ marginTop: 3, accentColor: "var(--color-brand)", cursor: "pointer", width: 15, height: 15 }} />
                <label htmlFor="terminos" style={{ fontSize: 13, color: "var(--color-text-secondary)", cursor: "pointer", lineHeight: 1.4 }}>
                  Acepto los <span style={{ color: "var(--color-brand)", fontWeight: 600 }}>términos y condiciones</span> y la <span style={{ color: "var(--color-brand)", fontWeight: 600 }}>política de privacidad</span>
                </label>
              </div>

              <BtnPrimario isPending={isPending} label="Crear cuenta" labelPending="Procesando..." />
            </form>

            <Divider />
            <p style={{ textAlign: "center", fontSize: 14, color: "var(--color-text-secondary)" }}>
              ¿Ya tenés cuenta?{" "}
              <button onClick={() => { resetForm(); setPaso("login"); }} style={linkBtnStyle}>Iniciá sesión</button>
            </p>
          </div>
        )}

      </div>
    </div>
  );

  return (
    <>
      <style>{`
        .login-grid { display: grid; grid-template-columns: 400px 1fr; height: 100vh; overflow: hidden; }
        @media (max-width: 768px) {
          .login-grid { grid-template-columns: 1fr; }
          .login-panel-izq { display: none !important; }
        }
        .login-panel-izq { height: 100vh; overflow-y: auto; position: sticky; top: 0; }
        .login-panel-der { height: 100vh; overflow-y: auto; }
      `}</style>
      <div className="login-grid">
        <div className="login-panel-izq">{panelIzq}</div>
        <div className="login-panel-der">{panelDer}</div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function BtnVolver({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--color-background-secondary)", border: "1.5px solid var(--color-border-secondary)", cursor: "pointer", color: "var(--color-text-primary)", fontSize: 14, padding: "8px 16px", marginBottom: 24, fontWeight: 600, borderRadius: 8 }}>
      ← Volver
    </button>
  );
}

function Divider() {
  return <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", margin: "24px 0" }} />;
}

function Separador({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 16px" }}>
      <div style={{ flex: 1, height: "0.5px", background: "var(--color-border-tertiary)" }} />
      <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", whiteSpace: "nowrap", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
      <div style={{ flex: 1, height: "0.5px", background: "var(--color-border-tertiary)" }} />
    </div>
  );
}

function Campo({ label, id, type, value, onChange, placeholder, autoComplete, maxLength, inputMode, style: extraStyle, required, hint }: {
  label: string; id: string; type: string; value: string;
  onChange: (v: string) => void; placeholder?: string; autoComplete?: string;
  maxLength?: number; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  style?: React.CSSProperties; required?: boolean;
  hint?: { text: string; color: string };
}) {
  return (
    <div style={{ marginBottom: hint ? 8 : 16, ...extraStyle }}>
      <label htmlFor={id} style={labelStyle}>
        {label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
      </label>
      <input id={id} type={type} autoComplete={autoComplete} value={value} maxLength={maxLength} inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ ...inputStyle, borderColor: hint?.color === "#ef4444" ? "#fca5a5" : hint?.color === "#16a34a" ? "#86efac" : undefined }} />
      {hint && <p style={{ fontSize: 12, color: hint.color, margin: "4px 0 8px", fontWeight: 500 }}>{hint.text}</p>}
    </div>
  );
}

function CampoPassword({ label, value, onChange, mostrar, onToggle, placeholder, autoComplete = "current-password", required }: {
  label: string; value: string; onChange: (v: string) => void;
  mostrar: boolean; onToggle: () => void; placeholder?: string; autoComplete?: string; required?: boolean;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}</label>
      <div style={{ position: "relative" }}>
        <input type={mostrar ? "text" : "password"} autoComplete={autoComplete} value={value}
          onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          style={{ ...inputStyle, paddingRight: 64 }} />
        <button type="button" onClick={onToggle} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-brand)", fontSize: 12, padding: 0, fontWeight: 600 }}>
          {mostrar ? "Ocultar" : "Mostrar"}
        </button>
      </div>
    </div>
  );
}

function IndicadorFuerza({ password }: { password: string }) {
  const score = passwordStrength(password);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map((n) => <div key={n} style={{ flex: 1, height: 4, borderRadius: 2, background: score >= n ? strengthColor(score) : "var(--color-border-secondary)" }} />)}
      </div>
      <span style={{ fontSize: 12, color: strengthColor(score), fontWeight: 600 }}>{strengthLabel(score)}</span>
    </div>
  );
}

function MensajeError({ mensaje }: { mensaje: string }) {
  return (
    <div style={{ fontSize: 13, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontWeight: 500 }}>
      ⚠ {mensaje}
    </div>
  );
}

function BtnPrimario({ isPending, label, labelPending }: { isPending: boolean; label: string; labelPending: string }) {
  return (
    <button type="submit" disabled={isPending} style={{ width: "100%", fontSize: 15, padding: "13px", borderRadius: 12, background: isPending ? "#a7d7c5" : "var(--color-brand)", border: "none", color: "#fff", fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer", letterSpacing: 0.2, boxShadow: isPending ? "none" : "0 4px 14px #1d9e7530" }}>
      {isPending ? labelPending : label}
    </button>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const linkBtnStyle: React.CSSProperties = { background: "none", border: "none", color: "var(--color-brand)", fontWeight: 700, cursor: "pointer", fontSize: 14, padding: 0 };

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 13, fontWeight: 700,
  color: "#0a1510", marginBottom: 7, letterSpacing: 0.1,
};

const inputStyle: React.CSSProperties = {
  width: "100%", fontSize: 15, padding: "11px 14px",
  borderRadius: 10, border: "1.5px solid var(--color-border-secondary)",
  background: "#fff", color: "#0a1510", outline: "none",
  boxSizing: "border-box", transition: "border-color 0.15s",
};

function formatCuit(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2)  return digits;
  if (digits.length <= 10) return `${digits.slice(0,2)}-${digits.slice(2)}`;
  return `${digits.slice(0,2)}-${digits.slice(2,10)}-${digits.slice(10)}`;
}

function passwordStrength(pwd: string): number {
  let s = 0;
  if (pwd.length >= 8) s++;
  if (pwd.length >= 12) s++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) s++;
  return s;
}

function strengthColor(s: number): string {
  return ["#d1d5db", "#ef4444", "#f59e0b", "#3b82f6", "#16a34a"][s] ?? "#d1d5db";
}

function strengthLabel(s: number): string {
  return ["", "Muy débil", "Débil", "Buena", "Muy segura"][s] ?? "";
}

