"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

type Perfil   = "camionero" | "flota" | "dador";
type Paso     = "inicio" | "perfil" | "dador-tipo" | "login" | "registro";
type SubPaso  = "personal" | "camion";
type TipoDador = "personal" | "empresa";

const PERFILES = [
  { id: "camionero" as Perfil, titulo: "Soy camionero independiente", subtitulo: "Busco cargas para mis rutas y gestiono mis viajes", icono: "🚛" },
  { id: "flota"     as Perfil, titulo: "Tengo una empresa de flota",  subtitulo: "Gestiono múltiples camiones y conductores",        icono: "🏢" },
  { id: "dador"     as Perfil, titulo: "Tengo cargas para enviar",    subtitulo: "Publico cargas y elijo el mejor camionero",        icono: "📦" },
];

const TIPO_CAMION = ["camion", "semi", "acoplado", "frigorifico", "cisterna", "otros"] as const;

const emptyTruck = () => ({ patente: "", marca: "", modelo: "", año: "", truck_type: "", capacity_kg: "", vtv_vence: "", seguro_poliza: "", seguro_vence: "" });

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modoInicial = searchParams.get("modo");

  const [paso, setPaso]       = useState<Paso>(modoInicial === "login" ? "login" : modoInicial === "registro" ? "perfil" : "inicio");
  const [subPaso, setSubPaso] = useState<SubPaso>("personal");
  const [perfil, setPerfil]   = useState<Perfil | null>(null);
  const [tipoDador, setTipoDador] = useState<TipoDador | null>(null);

  // Datos personales
  const [nombre, setNombre]     = useState("");
  const [dni, setDni]           = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPwd, setMostrarPwd]       = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);

  // Datos empresa
  const [razonSocial, setRazonSocial] = useState("");
  const [cuit, setCuit]               = useState("");
  const [direccion, setDireccion]     = useState("");

  // Camiones (array para flota)
  const [trucks, setTrucks] = useState([emptyTruck()]);

  const [error, setError]            = useState("");
  const [isPending, startTransition] = useTransition();

  const perfilInfo = PERFILES.find((p) => p.id === perfil);
  const esCamion   = perfil === "camionero" || perfil === "flota";

  const resetForm = () => {
    setNombre(""); setDni(""); setTelefono(""); setEmail(""); setPassword("");
    setRazonSocial(""); setCuit(""); setDireccion(""); setTrucks([emptyTruck()]);
    setAceptaTerminos(false); setError("");
  };

  // ── Navegación ───────────────────────────────────────────────────────────
  const irAInicio   = () => { setPaso("inicio"); setPerfil(null); setTipoDador(null); setSubPaso("personal"); setError(""); };
  const irAPerfil   = () => { setPaso("perfil"); setTipoDador(null); setSubPaso("personal"); setError(""); };

  const handleSeleccionarPerfil = (p: Perfil) => {
    setPerfil(p); setTipoDador(null); setSubPaso("personal"); setError("");
    setPaso(p === "dador" ? "dador-tipo" : "registro");
  };

  const handleSeleccionarTipoDador = (tipo: TipoDador) => {
    setTipoDador(tipo); setPaso("registro"); setError("");
  };

  // ── Validar paso personal ─────────────────────────────────────────────────
  const validarPersonal = (): string | null => {
    if (!nombre.trim())  return "Ingresá tu nombre completo.";
    if (esCamion && !dni.trim()) return "Ingresá tu DNI.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Ingresá un email válido.";
    if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    if (perfil === "flota" && !razonSocial.trim()) return "Ingresá la razón social de la empresa.";
    if (perfil === "flota" && !cuit.trim()) return "Ingresá el CUIT de la empresa.";
    if (perfil === "dador" && tipoDador === "empresa" && !razonSocial.trim()) return "Ingresá la razón social.";
    if (perfil === "dador" && tipoDador === "empresa" && !cuit.trim()) return "Ingresá el CUIT.";
    if (!aceptaTerminos) return "Tenés que aceptar los términos para continuar.";
    return null;
  };

  const handleSiguiente = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validarPersonal();
    if (err) { setError(err); return; }
    setError(""); setSubPaso("camion");
  };

  // ── Registro ──────────────────────────────────────────────────────────────
  const handleRegistro = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validar camiones si aplica
    if (esCamion) {
      for (const t of trucks) {
        if (!t.patente.trim()) { setError("Todos los camiones deben tener patente."); return; }
        if (!t.truck_type)     { setError("Seleccioná el tipo para cada camión."); return; }
      }
    }

    startTransition(async () => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email, password, name: nombre, role: perfil,
          tipo_dador:   tipoDador    || null,
          phone:        telefono     || null,
          dni:          dni          || null,
          razon_social: razonSocial  || null,
          cuit:         cuit         || null,
          address:      direccion    || null,
          trucks:       esCamion ? trucks : undefined,
        }),
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        setError(msg ?? "Error al crear la cuenta.");
        if (esCamion) setSubPaso("personal");
        return;
      }

      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) setError("Cuenta creada, pero hubo un error al ingresar. Intentá desde iniciar sesión.");
      else { router.push("/dashboard"); router.refresh(); }
    });
  };

  // ── Login (sin rol) ───────────────────────────────────────────────────────
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Ingresá un email válido."); return; }
    startTransition(async () => {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) setError("Email o contraseña incorrectos. Intentá de nuevo.");
      else { router.push("/dashboard"); router.refresh(); }
    });
  };

  // ── Truck helpers ─────────────────────────────────────────────────────────
  const updateTruck = (i: number, field: string, value: string) => {
    setTrucks((prev) => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t));
  };
  const addTruck    = () => setTrucks((prev) => [...prev, emptyTruck()]);
  const removeTruck = (i: number) => setTrucks((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background-tertiary)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <Link href="/" style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)", textDecoration: "none", marginBottom: 32 }}>
        Carga<span style={{ color: "var(--color-brand)" }}>Back</span>
      </Link>

      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 32, width: "100%", maxWidth: paso === "inicio" || paso === "perfil" ? 520 : 500, transition: "max-width 0.2s ease" }}>

        {/* ── Pantalla de inicio ── */}
        {paso === "inicio" && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 6 }}>Bienvenido a CargaBack</h1>
            <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 28 }}>¿Qué querés hacer?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => { resetForm(); setPaso("login"); }}
                style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", cursor: "pointer", textAlign: "left", width: "100%" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-brand)"; e.currentTarget.style.background = "var(--color-brand-light)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border-secondary)"; e.currentTarget.style.background = "var(--color-background-secondary)"; }}>
                <span style={{ fontSize: 26 }}>👤</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>Iniciar sesión</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>Ya tengo una cuenta en CargaBack</div>
                </div>
                <span style={{ color: "var(--color-text-tertiary)" }}>→</span>
              </button>
              <button onClick={() => { resetForm(); setPaso("perfil"); }}
                style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-brand)", background: "var(--color-brand-light)", cursor: "pointer", textAlign: "left", width: "100%" }}>
                <span style={{ fontSize: 26 }}>✨</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-brand-dark)" }}>Registrarse gratis</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>Crear una cuenta nueva</div>
                </div>
                <span style={{ color: "var(--color-brand)" }}>→</span>
              </button>
            </div>
          </>
        )}

        {/* ── Login directo (sin selección de rol) ── */}
        {paso === "login" && (
          <>
            <Cabecera titulo="Iniciá sesión" subtitulo="Ingresá con tu email y contraseña" onVolver={irAInicio} />
            <form onSubmit={handleLogin} noValidate>
              <Campo label="Email"      id="email"    type="email"    autoComplete="email"            value={email}    onChange={setEmail}    placeholder="tu@email.com" />
              <CampoPassword label="Contraseña" value={password} onChange={setPassword} mostrar={mostrarPwd} onToggle={() => setMostrarPwd(!mostrarPwd)} placeholder="Tu contraseña" />
              <div style={{ textAlign: "right", marginBottom: 16 }}>
                <button type="button" style={{ background: "none", border: "none", fontSize: 12, color: "var(--color-brand)", cursor: "pointer", padding: 0 }} onClick={() => alert("Próximamente: recuperación de contraseña.")}>
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              {error && <MensajeError mensaje={error} />}
              <BotonSubmit isPending={isPending} label="Ingresar" labelPending="Verificando..." />
            </form>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", textAlign: "center", marginTop: 16 }}>
              ¿No tenés cuenta?{" "}
              <button onClick={() => { resetForm(); setPaso("perfil"); }} style={btnTextoStyle}>Registrate gratis</button>
            </p>
          </>
        )}

        {/* ── Selección de perfil (solo registro) ── */}
        {paso === "perfil" && (
          <>
            <Cabecera titulo="Crear cuenta" subtitulo="¿Cuál describe mejor tu rol?" onVolver={irAInicio} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {PERFILES.map((p) => (
                <button key={p.id} onClick={() => handleSeleccionarPerfil(p.id)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", cursor: "pointer", textAlign: "left", width: "100%" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-brand)"; e.currentTarget.style.background = "var(--color-brand-light)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border-secondary)"; e.currentTarget.style.background = "var(--color-background-secondary)"; }}>
                  <span style={{ fontSize: 24 }}>{p.icono}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{p.titulo}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{p.subtitulo}</div>
                  </div>
                  <span style={{ color: "var(--color-text-tertiary)", fontSize: 16 }}>→</span>
                </button>
              ))}
            </div>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", textAlign: "center", marginTop: 20 }}>
              ¿Ya tenés cuenta?{" "}
              <button onClick={() => { resetForm(); setPaso("login"); }} style={btnTextoStyle}>Iniciá sesión</button>
            </p>
          </>
        )}

        {/* ── Dador: personal o empresa ── */}
        {paso === "dador-tipo" && perfilInfo && (
          <>
            <Cabecera titulo="Crear cuenta" subtitulo="¿Cómo vas a operar?" onVolver={irAPerfil} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {([
                { id: "personal" as TipoDador, icono: "👤", titulo: "Persona física",   subtitulo: "Publico cargas a título personal" },
                { id: "empresa"  as TipoDador, icono: "🏢", titulo: "Empresa / S.R.L.", subtitulo: "Opero con razón social y CUIT empresarial" },
              ] as const).map((op) => (
                <button key={op.id} onClick={() => handleSeleccionarTipoDador(op.id)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", cursor: "pointer", textAlign: "left", width: "100%" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-brand)"; e.currentTarget.style.background = "var(--color-brand-light)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border-secondary)"; e.currentTarget.style.background = "var(--color-background-secondary)"; }}>
                  <span style={{ fontSize: 24 }}>{op.icono}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{op.titulo}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{op.subtitulo}</div>
                  </div>
                  <span style={{ color: "var(--color-text-tertiary)", fontSize: 16 }}>→</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Registro: datos personales ── */}
        {paso === "registro" && perfilInfo && subPaso === "personal" && (
          <>
            <Cabecera
              titulo="Crear cuenta" subtitulo={`${perfilInfo.icono} ${perfilInfo.titulo}`}
              onVolver={perfil === "dador" ? () => setPaso("dador-tipo") : irAPerfil}
              badge={esCamion ? { actual: 1, total: 2 } : undefined}
            />
            <form onSubmit={esCamion ? handleSiguiente : handleRegistro} noValidate>
              <Campo label="Nombre completo" id="nombre"   type="text" autoComplete="name" value={nombre}   onChange={setNombre}   placeholder="Juan Rodríguez" />
              {esCamion && <Campo label="DNI" id="dni" type="text" value={dni} onChange={setDni} placeholder="12345678" />}
              <Campo label="Teléfono" id="telefono" type="tel" autoComplete="tel" value={telefono} onChange={setTelefono} placeholder="+54 9 11 1234-5678" />
              <Campo label="Email"    id="email"    type="email" autoComplete="email" value={email} onChange={setEmail} placeholder="tu@email.com" />

              {perfil === "flota" && (
                <>
                  <Separador label="Empresa" />
                  <Campo label="Razón social" id="razon_social" type="text" value={razonSocial} onChange={setRazonSocial} placeholder="Transportes S.A." />
                  <Campo label="CUIT"         id="cuit"         type="text" value={cuit}         onChange={setCuit}         placeholder="20-12345678-9" />
                </>
              )}

              {perfil === "dador" && tipoDador === "empresa" && (
                <>
                  <Separador label="Empresa" />
                  <Campo label="Razón social" id="razon_social" type="text" value={razonSocial} onChange={setRazonSocial} placeholder="Mi Empresa S.R.L." />
                  <Campo label="CUIT"         id="cuit"         type="text" value={cuit}         onChange={setCuit}         placeholder="20-12345678-9" />
                  <Campo label="Dirección"    id="direccion"    type="text" value={direccion}    onChange={setDireccion}    placeholder="Av. Corrientes 1234, CABA" />
                </>
              )}

              <Separador label="Acceso" />
              <CampoPassword label="Contraseña" value={password} onChange={setPassword} mostrar={mostrarPwd} onToggle={() => setMostrarPwd(!mostrarPwd)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
              {password.length > 0 && <IndicadorFuerza password={password} />}

              {error && <MensajeError mensaje={error} />}

              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 16 }}>
                <input type="checkbox" id="terminos" checked={aceptaTerminos} onChange={(e) => setAceptaTerminos(e.target.checked)} style={{ marginTop: 2, accentColor: "var(--color-brand)", cursor: "pointer" }} />
                <label htmlFor="terminos" style={{ fontSize: 12, color: "var(--color-text-secondary)", cursor: "pointer" }}>
                  Acepto los <span style={{ color: "var(--color-brand)" }}>términos y condiciones</span> y la <span style={{ color: "var(--color-brand)" }}>política de privacidad</span>
                </label>
              </div>

              <BotonSubmit isPending={isPending} label={esCamion ? "Siguiente →" : "Crear cuenta"} labelPending={esCamion ? "Siguiente →" : "Creando cuenta..."} />
            </form>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", textAlign: "center", marginTop: 16 }}>
              ¿Ya tenés cuenta?{" "}
              <button onClick={() => { resetForm(); setPaso("login"); }} style={btnTextoStyle}>Iniciá sesión</button>
            </p>
          </>
        )}

        {/* ── Registro: camiones ── */}
        {paso === "registro" && perfilInfo && subPaso === "camion" && (
          <>
            <Cabecera
              titulo={perfil === "flota" ? "Camiones de la flota" : "Tu camión"}
              subtitulo={`${perfilInfo.icono} ${perfilInfo.titulo}`}
              onVolver={() => { setSubPaso("personal"); setError(""); }}
              badge={{ actual: 2, total: 2 }}
            />

            <form onSubmit={handleRegistro} noValidate>
              {trucks.map((truck, i) => (
                <div key={i} style={{ border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", padding: "16px 16px 8px", marginBottom: 16, position: "relative" }}>
                  {perfil === "flota" && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>Camión {i + 1}</span>
                      {trucks.length > 1 && (
                        <button type="button" onClick={() => removeTruck(i)} style={{ background: "none", border: "none", color: "#ef4444", fontSize: 12, cursor: "pointer", padding: 0 }}>Eliminar</button>
                      )}
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                    <Campo label="Patente" id={`patente-${i}`} type="text" value={truck.patente} onChange={(v) => updateTruck(i, "patente", v)} placeholder="AB 123 CD" />
                    <Campo label="Año"     id={`año-${i}`}     type="number" value={truck.año} onChange={(v) => updateTruck(i, "año", v)} placeholder="2018" />
                    <Campo label="Marca"   id={`marca-${i}`}   type="text" value={truck.marca} onChange={(v) => updateTruck(i, "marca", v)} placeholder="Mercedes-Benz" />
                    <Campo label="Modelo"  id={`modelo-${i}`}  type="text" value={truck.modelo} onChange={(v) => updateTruck(i, "modelo", v)} placeholder="Actros 2651" />
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Tipo de camión</label>
                    <select value={truck.truck_type} onChange={(e) => updateTruck(i, "truck_type", e.target.value)} style={{ ...inputStyle, appearance: "none" as React.CSSProperties["appearance"] }}>
                      <option value="">Seleccioná un tipo</option>
                      {TIPO_CAMION.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                  </div>

                  <Campo label="Capacidad de carga (kg)" id={`cap-${i}`} type="number" value={truck.capacity_kg} onChange={(v) => updateTruck(i, "capacity_kg", v)} placeholder="20000" />

                  <Separador label="Documentación" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                    <Campo label="VTV — vencimiento"   id={`vtv-${i}`}    type="date" value={truck.vtv_vence}     onChange={(v) => updateTruck(i, "vtv_vence", v)} />
                    <Campo label="N° póliza de seguro" id={`poliza-${i}`} type="text" value={truck.seguro_poliza} onChange={(v) => updateTruck(i, "seguro_poliza", v)} placeholder="POL-123456" />
                  </div>
                  <Campo label="Seguro — vencimiento" id={`svence-${i}`} type="date" value={truck.seguro_vence} onChange={(v) => updateTruck(i, "seguro_vence", v)} />
                </div>
              ))}

              {perfil === "flota" && (
                <button type="button" onClick={addTruck} style={{ width: "100%", padding: "9px", borderRadius: "var(--border-radius-md)", border: "0.5px dashed var(--color-border-secondary)", background: "none", color: "var(--color-brand)", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 16 }}>
                  + Agregar otro camión
                </button>
              )}

              {error && <MensajeError mensaje={error} />}
              <BotonSubmit isPending={isPending} label="Crear cuenta" labelPending="Creando cuenta..." />
            </form>
          </>
        )}
      </div>

      <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 20, textAlign: "center" }}>
        🔒 Conexión segura · Tus datos están protegidos
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Cabecera({ titulo, subtitulo, onVolver, badge }: {
  titulo: string; subtitulo: string; onVolver: () => void;
  badge?: { actual: number; total: number };
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: badge ? 12 : 0 }}>
        <button onClick={onVolver} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", fontSize: 20, padding: 0, lineHeight: 1 }}>←</button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)" }}>{titulo}</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{subtitulo}</div>
        </div>
      </div>
      {badge && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {Array.from({ length: badge.total }, (_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < badge.actual ? "var(--color-brand)" : "var(--color-border-secondary)" }} />
          ))}
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginLeft: 4, whiteSpace: "nowrap" }}>{badge.actual}/{badge.total}</span>
        </div>
      )}
    </div>
  );
}

function Separador({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 14px" }}>
      <div style={{ flex: 1, height: "0.5px", background: "var(--color-border-tertiary)" }} />
      <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: "0.5px", background: "var(--color-border-tertiary)" }} />
    </div>
  );
}

function Campo({ label, id, type, value, onChange, placeholder, autoComplete }: {
  label: string; id: string; type: string; value: string;
  onChange: (v: string) => void; placeholder?: string; autoComplete?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <input id={id} type={type} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

function CampoPassword({ label, value, onChange, mostrar, onToggle, placeholder, autoComplete = "current-password" }: {
  label: string; value: string; onChange: (v: string) => void;
  mostrar: boolean; onToggle: () => void; placeholder?: string; autoComplete?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: "relative" }}>
        <input type={mostrar ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, paddingRight: 56 }} />
        <button type="button" onClick={onToggle} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", fontSize: 12, padding: 0 }}>
          {mostrar ? "Ocultar" : "Ver"}
        </button>
      </div>
    </div>
  );
}

function IndicadorFuerza({ password }: { password: string }) {
  const score = passwordStrength(password);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map((n) => <div key={n} style={{ flex: 1, height: 3, borderRadius: 2, background: score >= n ? strengthColor(score) : "var(--color-border-secondary)", transition: "background 0.2s" }} />)}
      </div>
      <span style={{ fontSize: 11, color: strengthColor(score) }}>{strengthLabel(score)}</span>
    </div>
  );
}

function MensajeError({ mensaje }: { mensaje: string }) {
  return (
    <div style={{ fontSize: 13, color: "#b91c1c", background: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: "var(--border-radius-md)", padding: "8px 12px", marginBottom: 14 }}>
      {mensaje}
    </div>
  );
}

function BotonSubmit({ isPending, label, labelPending }: { isPending: boolean; label: string; labelPending: string }) {
  return (
    <button type="submit" disabled={isPending} style={{ width: "100%", fontSize: 14, padding: "10px", borderRadius: "var(--border-radius-md)", background: isPending ? "#a7d7c5" : "var(--color-brand)", border: "none", color: "#fff", fontWeight: 600, cursor: isPending ? "not-allowed" : "pointer" }}>
      {isPending ? labelPending : label}
    </button>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const btnTextoStyle: React.CSSProperties = { background: "none", border: "none", color: "var(--color-brand)", fontWeight: 500, cursor: "pointer", fontSize: 13, padding: 0 };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", fontSize: 14, padding: "9px 12px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box" };

function passwordStrength(pwd: string): number {
  let s = 0;
  if (pwd.length >= 8) s++;
  if (pwd.length >= 12) s++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) s++;
  return Math.max(1, s);
}
function strengthColor(s: number) { return ["", "#ef4444", "#f97316", "#eab308", "#22c55e"][s]; }
function strengthLabel(s: number) { return ["", "Muy débil", "Débil", "Buena", "Muy segura"][s]; }
