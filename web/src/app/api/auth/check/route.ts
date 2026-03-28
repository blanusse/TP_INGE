import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/models/User";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const field = searchParams.get("field");
  const value = searchParams.get("value")?.trim();

  if (!field || !value) return NextResponse.json({ available: false }, { status: 400 });

  await connectDB();

  if (field === "email") {
    const exists = await User.exists({ email: value.toLowerCase() });
    return NextResponse.json({ available: !exists });
  }

  if (field === "phone") {
    const exists = await User.exists({ phone: value });
    return NextResponse.json({ available: !exists });
  }

  return NextResponse.json({ available: false }, { status: 400 });
}
