"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type InvitationData = {
  token: string;
  email: string;
  ownerName: string;
  expiresAt: string;
};

type PageState = "loading" | "ok" | "used" | "expired" | "error" | "accepting" | "done";

export default function InvitacionPage() {
  const { token } = useParams<{ token: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();

  const [state, setState] = useState<PageState>("loading");
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch(`/api/fleet/invitations/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.token) { setInvitation(d); setState("ok"); }
        else if (d.statusCode === 410) setState(d.message?.includes("utilizada") ? "used" : "expired");
        else setState("error");
      })
      .catch(() => setState("error"));
  }, [token]);

  const handleAceptar = async () => {
    if (status === "unauthenticated") {
      router.push(`/login?callbackUrl=/invitacion/${token}`);
      return;
    }
    setState("accepting");
    const res = await fetch(`/api/fleet/invitations/${token}`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setState("done");
    } else {
      setErrorMsg(data.message ?? "Error al aceptar la invitación.");
      setState("ok");
    }
  };

  const card: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f4f7f5",
    fontFamily: "Arial, sans-serif",
  };

  const box: React.CSSProperties = {
    background: "#ffffff",
    borderRadius: 16,
    boxShadow: "0 4px 32px rgba(0,0,0,0.08)",
    padding: "48px 40px",
    maxWidth: 480,
    width: "100%",
    textAlign: "center",
  };

  const logo = (
    <div style={{ fontSize: 22, fontWeight: 700, color: "#0f1f19", marginBottom: 32 }}>
      Carga<span style={{ color: "#3a806b" }}>Back</span>
    </div>
  );

  if (state === "loading") return (
    <div style={card}><div style={box}>{logo}<p style={{ color: "#4a6b5e" }}>Verificando invitación...</p></div></div>
  );

  if (state === "used") return (
    <div style={card}><div style={box}>
      {logo}
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f1f19", marginBottom: 8 }}>Invitación ya utilizada</h2>
      <p style={{ color: "#4a6b5e", fontSize: 14 }}>Este enlace ya fue usado y no puede volver a abrirse.</p>
    </div></div>
  );

  if (state === "expired") return (
    <div style={card}><div style={box}>
      {logo}
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f1f19", marginBottom: 8 }}>Invitación vencida</h2>
      <p style={{ color: "#4a6b5e", fontSize: 14 }}>Esta invitación venció. Pedile al administrador de flota que te envíe una nueva.</p>
    </div></div>
  );

  if (state === "error") return (
    <div style={card}><div style={box}>
      {logo}
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f1f19", marginBottom: 8 }}>Invitación no válida</h2>
      <p style={{ color: "#4a6b5e", fontSize: 14 }}>No encontramos esta invitación. Verificá el enlace.</p>
    </div></div>
  );

  if (state === "done") return (
    <div style={card}><div style={box}>
      {logo}
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f1f19", marginBottom: 8 }}>Bienvenido a la flota</h2>
      <p style={{ color: "#4a6b5e", fontSize: 14, marginBottom: 28 }}>Tu cuenta quedó vinculada a la flota de <strong>{invitation?.ownerName}</strong>.</p>
      <button onClick={() => router.push("/transportista")} style={{ background: "#3a806b", color: "#fff", border: "none", borderRadius: 8, padding: "12px 28px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
        Ir a mi cuenta
      </button>
    </div></div>
  );

  return (
    <div style={card}>
      <div style={box}>
        {logo}
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1f19", marginBottom: 8 }}>Invitación a flota</h2>
        <p style={{ color: "#4a6b5e", fontSize: 14, marginBottom: 24 }}>
          <strong>{invitation?.ownerName}</strong> te invita a unirte a su flota como conductor en CargaBack.
        </p>

        <div style={{ background: "#f4f7f5", border: "1px solid #ddeae4", borderRadius: 10, padding: "14px 18px", marginBottom: 24, textAlign: "left" }}>
          <div style={{ fontSize: 12, color: "#8aab9e", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Administrador de flota</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#0f1f19" }}>{invitation?.ownerName}</div>
        </div>

        <div style={{ background: "#e0f0ea", border: "1px solid #b0d4c8", borderRadius: 8, padding: "10px 14px", marginBottom: 24, fontSize: 12, color: "#2e6656", textAlign: "left" }}>
          Este enlace es de <strong>uso único</strong> y vence el{" "}
          {invitation?.expiresAt ? new Date(invitation.expiresAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}.
          Una vez abierto, no podrá usarse nuevamente.
        </div>

        {errorMsg && (
          <div style={{ background: "rgba(220,38,38,0.08)", border: "0.5px solid rgba(220,38,38,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#dc2626" }}>
            {errorMsg}
          </div>
        )}

        {status === "unauthenticated" && (
          <p style={{ fontSize: 13, color: "#4a6b5e", marginBottom: 16 }}>
            Necesitás iniciar sesión o registrarte para aceptar esta invitación.
          </p>
        )}

        <button
          onClick={handleAceptar}
          disabled={state === "accepting"}
          style={{ width: "100%", background: state === "accepting" ? "#8aab9e" : "#3a806b", color: "#fff", border: "none", borderRadius: 8, padding: "13px", fontSize: 15, fontWeight: 600, cursor: state === "accepting" ? "not-allowed" : "pointer" }}
        >
          {state === "accepting" ? "Procesando..." : status === "unauthenticated" ? "Iniciar sesión para aceptar" : "Aceptar invitación"}
        </button>
      </div>
    </div>
  );
}
