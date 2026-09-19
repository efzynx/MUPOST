import { NextResponse, type NextRequest } from "next/server";

// Endpoint untuk menangani ping pembatalan otorisasi Threads (Deauthorize Callback)
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.text();
    // eslint-disable-next-line no-console
    console.log("[Threads Deauthorize Callback received]:", body);
  } catch {
    // Abaikan error parsing
  }
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
