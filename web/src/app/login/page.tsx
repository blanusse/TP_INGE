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
  const [dniDisponible, setDniDisponible]             = useState<boolean | null>(null);
  const [cuitDisponible, setCuitDisponible]           = useState<boolean | null>(null);
  const [dniFile, setDniFile]                         = useState<File | null>(null);
  const [uploadingDni, setUploadingDni]               = useState(false);

  // Verificación en tiempo real: DNI
  useEffect(() => {
    if (paso !== "registro") return;
    const necesitaDni = perfil === "transportista" || (perfil === "dador" && tipoDador === "personal");
    if (!necesitaDni || !/^\d{7,8}$/.test(dni)) { setDniDisponible(null); return; }
    setDniDisponible(null);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check?field=dni&value=${encodeURIComponent(dni)}`);
        const { available } = await res.json();
        setDniDisponible(available);
      } catch { /* ignorar */ }
    }, 700);
    return () => clearTimeout(timer);
  }, [dni, paso, perfil, tipoDador]); // eslint-disable-line react-hooks/exhaustive-deps

  // Verificación en tiempo real: CUIT
  useEffect(() => {
    if (paso !== "registro" || perfil !== "dador" || tipoDador !== "empresa") return;
    const digitos = cuit.replace(/\D/g, "");
    if (digitos.length < 11) { setCuitDisponible(null); return; }
    setCuitDisponible(null);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check?field=cuit&value=${encodeURIComponent(cuit)}`);
        const { available } = await res.json();
        setCuitDisponible(available);
      } catch { /* ignorar */ }
    }, 700);
    return () => clearTimeout(timer);
  }, [cuit, paso, perfil, tipoDador]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const necesitaDni = perfil === "transportista" || (perfil === "dador" && tipoDador === "personal");
    if (necesitaDni) {
      const dniLimpio = dni.replace(/\./g, "");
      if (!/^\d{7,8}$/.test(dniLimpio)) return "El DNI debe tener 7 u 8 dígitos numéricos.";
      const num = parseInt(dniLimpio);
      if (num < 1_000_000 || num > 99_999_999) return "El DNI ingresado no está en el rango argentino válido.";
      if (dniDisponible === false) return "Ya existe una cuenta registrada con ese DNI.";
      if (!dniFile) return "Adjuntá una foto de tu DNI para verificar tu identidad.";
    }

    if (!telefono.trim()) return "El teléfono es obligatorio.";
    if (!/^\+?\d{8,15}$/.test(telefono.replace(/\s/g, ""))) return "El teléfono debe tener entre 8 y 15 dígitos.";
    if (telefonoDisponible === false) return "Ya existe una cuenta registrada con ese teléfono.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Email inválido.";
    if (emailDisponible === false) return "Ya existe una cuenta registrada con ese email.";
    if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    if (perfil === "dador" && tipoDador === "empresa") {
      if (!razonSocial.trim()) return "Ingresá la razón social.";
      if (!/^\d{2}-\d{8}-\d$/.test(cuit)) return "El CUIT debe tener el formato XX-XXXXXXXX-X.";
      if (!validarCuitChecksum(cuit)) return "El CUIT ingresado no es válido. Verificá el dígito verificador.";
      if (cuitDisponible === false) return "Ya existe una empresa registrada con ese CUIT.";
    }
    if (!aceptaTerminos) return "Aceptá los términos para continuar.";
    return null;
  };

  const handleRegistro = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const err = validarPersonal();
    if (err) { setError(err); return; }

    startTransition(async () => {
      // 1. Subir foto DNI si se seleccionó
      let dniPhotoUrl: string | null = null;
      if (dniFile) {
        setUploadingDni(true);
        try {
          const fd = new FormData();
          fd.append("file", dniFile);
          fd.append("folder", "dni-pendientes");
          const upRes = await fetch("/api/documents/upload-public", { method: "POST", body: fd });
          const upData = await upRes.json();
          if (!upRes.ok) { setError(upData.error ?? "Error al subir la foto del DNI."); setUploadingDni(false); return; }
          dniPhotoUrl = upData.url;
        } catch {
          setError("Error de conexión al subir la foto. Intentá de nuevo.");
          setUploadingDni(false);
          return;
        }
        setUploadingDni(false);
      }

      // 2. Registrar el usuario
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email, password, name: nombre, role: perfil,
          tipo_dador: tipoDador || null, phone: telefono || null, dni: dni || null,
          dni_photo_url: dniPhotoUrl,
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
    <div style={{ background: "linear-gradient(160deg, #0a1510 0%, #3a806b 70%, #3a806b 100%)", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "40px 36px", height: "100%" }}>
      <button onClick={handleBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
        <div style={{ fontSize: 36, fontWeight: 800, color: "#fff", letterSpacing: -1 }}>
          Carga<span style={{ color: "#5cb899" }}>Back</span>
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
              <div style={{ fontSize: 26, fontWeight: 800, color: "#5cb899", letterSpacing: -1, lineHeight: 1 }}>{s.valor}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 5, lineHeight: 1.3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "20px 18px" }}>
          <div style={{ fontSize: 22, color: "#5cb899", marginBottom: 10, lineHeight: 1 }}>"</div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.65, margin: "0 0 16px", fontStyle: "italic" }}>
            Antes volvía vacío de Buenos Aires siempre. Ahora en 20 minutos encuentro carga para el regreso. Cambió todo.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#3a806b,#5cb899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>C</div>
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
    <div style={{ background: "#000", display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "40px 64px" }}>

        {/* ── Inicio ── */}
        {paso === "inicio" && (
          <div style={{ maxWidth: 380, width: "100%" }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 8, letterSpacing: -0.5 }}>Bienvenido</h1>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", marginBottom: 32 }}>¿Qué querés hacer?</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button onClick={() => { resetForm(); setPaso("login"); }}
                style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", borderRadius: 12, border: "1.5px solid rgba(255,255,255,0.2)", background: "#000", cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#3a806b"; e.currentTarget.style.boxShadow = "0 0 0 3px #3a806b15"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#3a806b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Iniciar sesión</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Ya tengo una cuenta</div>
                </div>
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 18 }}>→</span>
              </button>

              <button onClick={() => { resetForm(); setPaso("perfil"); }}
                style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", borderRadius: 12, border: "1.5px solid rgba(255,255,255,0.2)", background: "#000", cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#3a806b"; e.currentTarget.style.boxShadow = "0 0 0 3px #3a806b15"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#3a806b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Registrarse gratis</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>Crear cuenta nueva</div>
                </div>
                <span style={{ color: "#3a806b", fontSize: 18 }}>→</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Login ── */}
        {paso === "login" && (
          <div style={{ maxWidth: 400, width: "100%" }}>
            <BtnVolver onClick={irAInicio} />
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginBottom: 4, letterSpacing: -0.5 }}>Iniciá sesión</h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginBottom: 28 }}>Ingresá con tu email y contraseña</p>

            <form onSubmit={handleLogin} noValidate style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <Campo label="Email" id="email" type="email" autoComplete="email" value={email} onChange={setEmail} placeholder="tu@email.com" />
              <CampoPassword label="Contraseña" value={password} onChange={setPassword} mostrar={mostrarPwd} onToggle={() => setMostrarPwd(!mostrarPwd)} placeholder="Tu contraseña" />
              <div style={{ textAlign: "right", marginBottom: 20 }}>
                <button type="button" style={{ background: "none", border: "none", fontSize: 13, color: "#3a806b", cursor: "pointer", padding: 0, fontWeight: 500 }}
                  onClick={() => alert("Próximamente: recuperación de contraseña.")}>
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              {error && <MensajeError mensaje={error} />}
              <BtnPrimario isPending={isPending} label="Ingresar" labelPending="Verificando..." />
            </form>

            <Divider />
            <p style={{ textAlign: "center", fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
              ¿No tenés cuenta?{" "}
              <button onClick={() => { resetForm(); setPaso("perfil"); }} style={linkBtnStyle}>Registrate gratis</button>
            </p>
          </div>
        )}

        {/* ── Selección de perfil ── */}
        {paso === "perfil" && (
          <div style={{ maxWidth: 560, width: "100%" }}>
            <BtnVolver onClick={irAInicio} />
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginBottom: 4, letterSpacing: -0.5 }}>Crear cuenta</h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginBottom: 24 }}>¿Cuál describe mejor tu rol?</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {([
                {
                  id: "transportista" as Perfil,
                  icono: (<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3a806b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>),
                  titulo: "Soy transportista",
                  color: "#3a806b",
                  features: ["Encontrá cargas para tu vuelta en minutos", "Ofertá tu precio directamente", "Gestioná tu flota desde un panel unificado"],
                },
                {
                  id: "dador" as Perfil,
                  icono: (<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3a806b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><line x1="12" y1="22" x2="12" y2="12"/></svg>),
                  titulo: "Tengo cargas para enviar",
                  color: "#3a806b",
                  features: ["Publicá tu carga en menos de 2 minutos", "Recibí ofertas de transportistas verificados", "Seguimiento en tiempo real de cada envío"],
                },
              ]).map((p) => (
                <div key={p.id} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, border: "0.5px solid rgba(255,255,255,0.2)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "20px 20px 14px" }}>
                    <div style={{ marginBottom: 12 }}>{p.icono}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: p.color, marginBottom: 14, lineHeight: 1.3 }}>{p.titulo}</div>
                    {p.features.map((f) => (
                      <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                        <span style={{ color: p.color, flexShrink: 0, marginTop: 1 }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: "12px 20px 20px", marginTop: "auto" }}>
                    <button onClick={() => handleSeleccionarPerfil(p.id)}
                      style={{ width: "100%", fontSize: 12, fontWeight: 600, padding: "8px", borderRadius: 8, background: p.color, color: "#fff", border: "none", cursor: "pointer", textAlign: "center" as const }}>
                      Registrarme →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <Divider />
            <p style={{ textAlign: "center", fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
              ¿Ya tenés cuenta?{" "}
              <button onClick={() => { resetForm(); setPaso("login"); }} style={linkBtnStyle}>Iniciá sesión</button>
            </p>
          </div>
        )}

        {/* ── Dador: personal o empresa ── */}
        {paso === "dador-tipo" && (
          <div style={{ maxWidth: 420, width: "100%" }}>
            <BtnVolver onClick={irAPerfil} />
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginBottom: 4, letterSpacing: -0.5 }}>Dador de carga</h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginBottom: 28 }}>¿Cómo vas a operar?</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {([
                { id: "personal" as TipoDador, icono: (<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>), titulo: "Persona física",   sub: "Publico cargas a título personal" },
                { id: "empresa"  as TipoDador, icono: (<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>), titulo: "Empresa / S.R.L.", sub: "Opero con razón social y CUIT" },
              ] as const).map((op) => (
                <button key={op.id} onClick={() => handleSeleccionarTipoDador(op.id)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 12, border: "1.5px solid rgba(255,255,255,0.2)", background: "#000", cursor: "pointer", textAlign: "left", width: "100%" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#3a806b"; e.currentTarget.style.background = "rgba(58,128,107,0.15)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.background = "#000"; }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: "#3a806b", display: "flex", alignItems: "center", justifyContent: "center" }}>{op.icono}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{op.titulo}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{op.sub}</div>
                  </div>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 18 }}>→</span>
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
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginBottom: 8, letterSpacing: -0.5 }}>Crear cuenta</h1>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(58,128,107,0.15)", color: "#3a806b", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                {perfil === "transportista" ? (
                  <><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> Transportista</>
                ) : (
                  <><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><line x1="12" y1="22" x2="12" y2="12"/></svg> Dador de carga</>
                )}
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
                  <Campo label="DNI" id="dni" type="text" value={dni} onChange={(v) => setDni(v.replace(/\D/g, ""))} placeholder="12345678" maxLength={8} inputMode="numeric" required
                    hint={dniDisponible === false ? { text: "⚠ Ya existe una cuenta con ese DNI.", color: "#ef4444" } : dniDisponible === true ? { text: "✓ DNI disponible.", color: "#16a34a" } : undefined} />
                )}
                {(perfil === "transportista" || (perfil === "dador" && tipoDador === "personal")) && (
                  <CampoDniPhoto file={dniFile} onFile={setDniFile} />
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
                  <Campo label="CUIT" id="cuit" type="text" value={cuit} onChange={(v) => setCuit(formatCuit(v))} placeholder="20-12345678-9" maxLength={13} inputMode="numeric" required
                    hint={cuitDisponible === false ? { text: "⚠ Ya existe una empresa con ese CUIT.", color: "#ef4444" } : cuitDisponible === true ? { text: "✓ CUIT disponible.", color: "#16a34a" } : undefined} />
                  <Campo label="Dirección" id="dir" type="text" value={direccion} onChange={setDireccion} placeholder="Av. Corrientes 1234" />
                </div>
              </>}

              {perfil === "transportista" && (
                <div style={{ background: "rgba(58,128,107,0.15)", border: "0.5px solid #3a806b", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                  <p style={{ fontSize: 13, color: "#3a806b", margin: 0, lineHeight: 1.5 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }}><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> <strong>Una vez que ingreses</strong>, vas a poder agregar tus camiones y conductores desde la sección <strong>Mi flota</strong>.
                  </p>
                </div>
              )}

              <Separador label="Contraseña" />
              <CampoPassword label="Contraseña" value={password} onChange={setPassword} mostrar={mostrarPwd} onToggle={() => setMostrarPwd(!mostrarPwd)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" required />
              {password.length > 0 && <IndicadorFuerza password={password} />}

              {error && <MensajeError mensaje={error} />}

              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 20 }}>
                <input type="checkbox" id="terminos" checked={aceptaTerminos} onChange={(e) => setAceptaTerminos(e.target.checked)} style={{ marginTop: 3, accentColor: "#3a806b", cursor: "pointer", width: 15, height: 15 }} />
                <label htmlFor="terminos" style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", cursor: "pointer", lineHeight: 1.4 }}>
                  Acepto los <span style={{ color: "#3a806b", fontWeight: 600 }}>términos y condiciones</span> y la <span style={{ color: "#3a806b", fontWeight: 600 }}>política de privacidad</span>
                </label>
              </div>

              <BtnPrimario isPending={isPending || uploadingDni} label="Crear cuenta" labelPending={uploadingDni ? "Subiendo foto DNI..." : "Procesando..."} />
            </form>

            <Divider />
            <p style={{ textAlign: "center", fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
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
        .login-panel-der input {
          border: 1.5px solid rgba(255,255,255,0.2) !important;
          outline: none !important;
        }
        .login-panel-der input:focus {
          border: 1.5px solid rgba(255,255,255,0.4) !important;
        }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          border: 1.5px solid rgba(255,255,255,0.2) !important;
          -webkit-box-shadow: 0 0 0 1000px #111 inset !important;
          -webkit-text-fill-color: #fff !important;
        }
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
    <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.2)", cursor: "pointer", color: "#fff", fontSize: 14, padding: "8px 16px", marginBottom: 24, fontWeight: 600, borderRadius: 8 }}>
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
      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
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
        <button type="button" onClick={onToggle} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#3a806b", fontSize: 12, padding: 0, fontWeight: 600 }}>
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
    <button type="submit" disabled={isPending} style={{ width: "100%", fontSize: 15, padding: "13px", borderRadius: 12, background: isPending ? "#a7d7c5" : "#3a806b", border: "none", color: "#fff", fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer", letterSpacing: 0.2, boxShadow: isPending ? "none" : "0 4px 14px #3a806b30" }}>
      {isPending ? labelPending : label}
    </button>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const linkBtnStyle: React.CSSProperties = { background: "none", border: "none", color: "#3a806b", fontWeight: 700, cursor: "pointer", fontSize: 14, padding: 0 };

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 13, fontWeight: 700,
  color: "#fff", marginBottom: 7, letterSpacing: 0.1,
};

const inputStyle: React.CSSProperties = {
  width: "100%", fontSize: 15, padding: "11px 14px",
  borderRadius: 10, border: "1.5px solid rgba(255,255,255,0.2)",
  background: "#111", color: "#fff", outline: "none",
  boxSizing: "border-box", transition: "border-color 0.15s",
};

function formatCuit(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2)  return digits;
  if (digits.length <= 10) return `${digits.slice(0,2)}-${digits.slice(2)}`;
  return `${digits.slice(0,2)}-${digits.slice(2,10)}-${digits.slice(10)}`;
}

/** Dígito verificador CUIT argentino — misma lógica que el backend */
function validarCuitChecksum(cuit: string): boolean {
  const limpio = cuit.replace(/[-\s]/g, "");
  if (!/^\d{11}$/.test(limpio)) return false;
  const factores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = factores.reduce((acc, f, i) => acc + f * parseInt(limpio[i]), 0);
  const resto = 11 - (suma % 11);
  if (resto === 11) return parseInt(limpio[10]) === 0;
  if (resto === 10) return false;
  return parseInt(limpio[10]) === resto;
}

function CampoDniPhoto({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
  const inputId = "dni-photo";
  return (
    <div style={{ marginBottom: 16, gridColumn: "1 / -1" }}>
      <label htmlFor={inputId} style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3a806b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/><path d="M7 15h2"/><path d="M13 15h4"/></svg>
        Foto del DNI <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>
      </label>
      <label htmlFor={inputId} style={{ display: "block", cursor: "pointer" }}>
        <div style={{
          border: `1.5px dashed ${file ? "#3a806b" : "rgba(255,255,255,0.3)"}`,
          borderRadius: 10,
          padding: "14px 16px",
          background: file ? "rgba(58,128,107,0.1)" : "#111",
          textAlign: "center",
          transition: "all 0.15s",
        }}>
          {file ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3a806b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{ fontSize: 13, color: "#3a806b", fontWeight: 600 }}>{file.name}</span>
              <button type="button" onClick={(e) => { e.preventDefault(); onFile(null); }} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
            </div>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "0 auto 8px" }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>Subí una foto del frente de tu DNI</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>JPG, PNG o WEBP · máx. 5 MB</div>
            </>
          )}
        </div>
      </label>
      <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "5px 0 0" }}>
        La imagen se usa únicamente para verificar tu identidad.
      </p>
    </div>
  );
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

