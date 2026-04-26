import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ loadId: string }> },
) {
  const { loadId } = await params;

  const backendRes = await fetch(`${BACKEND_URL}/location/${loadId}/stream`, {
    headers: { Accept: "text/event-stream", "Cache-Control": "no-cache" },
  });

  if (!backendRes.body) {
    return new NextResponse("Stream unavailable", { status: 502 });
  }

  return new NextResponse(backendRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
