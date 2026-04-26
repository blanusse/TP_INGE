import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Límites estrictos para uploads sin autenticación
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES  = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_FOLDERS = ["dni-pendientes"]; // solo carpetas permitidas para anon

// POST /api/documents/upload-public
// Permite subir la foto del DNI ANTES de crear la cuenta (sin sesión).
// Solo acepta imágenes y solo a la carpeta dni-pendientes.
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file     = formData.get("file") as File | null;
  const folder   = (formData.get("folder") as string) || "dni-pendientes";

  if (!ALLOWED_FOLDERS.includes(folder)) {
    return NextResponse.json({ error: "Carpeta no permitida." }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Solo se permiten imágenes JPG, PNG o WEBP." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "La imagen no puede superar los 5 MB." }, { status: 400 });
  }

  const ext      = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const filename = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const buf      = await file.arrayBuffer();

  const { error } = await supabaseAdmin.storage
    .from("documentos")
    .upload(filename, buf, { contentType: file.type, upsert: false });

  if (error) {
    console.error("[upload-public]", error);
    return NextResponse.json({ error: "Error al subir la imagen." }, { status: 500 });
  }

  const { data: { publicUrl } } = supabaseAdmin.storage.from("documentos").getPublicUrl(filename);
  return NextResponse.json({ url: publicUrl });
}
