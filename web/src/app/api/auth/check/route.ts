import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const field = searchParams.get("field");
  const value = searchParams.get("value")?.trim();

  if (!field || !value) {
    return NextResponse.json({ available: false }, { status: 400 });
  }

  if (field === "email") {
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("email", value)
      .maybeSingle();
    return NextResponse.json({ available: !data });
  }

  if (field === "phone") {
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("phone", value)
      .maybeSingle();
    return NextResponse.json({ available: !data });
  }

  return NextResponse.json({ available: false }, { status: 400 });
}
