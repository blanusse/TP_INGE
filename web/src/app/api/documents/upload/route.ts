import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES  = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

// POST /api/documents/upload
// Sube un documento (foto DNI, VTV, seguro) a Supabase Storage y devuelve la URL pública.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.backendToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const formData = await req.formData();
  const file     = formData.get("file") as File | null;
  const bucket   = (formData.get("bucket") as string) || "documentos";
  const folder   = (formData.get("folder") as string) || "general";

  if (!file) return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Tipo de archivo no permitido. Usá JPG, PNG, WEBP o PDF." }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "El archivo no puede superar los 5 MB." }, { status: 400 });
  }

  const ext       = file.name.split(".").pop() ?? "jpg";
  const userId    = session.user?.id ?? "anon";
  const filename  = `${folder}/${userId}_${Date.now()}.${ext}`;
  const arrayBuf  = await file.arrayBuffer();

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(filename, arrayBuf, { contentType: file.type, upsert: false });

  if (error) {
    console.error("[documents/upload]", error);
    return NextResponse.json({ error: "Error al subir el archivo." }, { status: 500 });
  }

  const { data: { publicUrl } } = supabaseAdmin.storage.from(bucket).getPublicUrl(filename);

  return NextResponse.json({ url: publicUrl });
}
