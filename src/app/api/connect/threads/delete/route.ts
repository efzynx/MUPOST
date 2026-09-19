import { NextResponse, type NextRequest } from "next/server";

// Endpoint untuk menangani ping permintaan penghapusan data Threads (Data Deletion Callback)
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/privacy`,
      confirmation_code: "mupost_data_deletion_confirmed",
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.text();
    // eslint-disable-next-line no-console
    console.log("[Threads Data Deletion Request received]:", body);
  } catch {
    // Abaikan error parsing
  }

  // Sesuai spesifikasi Meta Data Deletion Callback: kembalikan URL status dan confirmation_code
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.json(
    {
      url: `${baseUrl}/privacy`,
      confirmation_code: `deletion_${Date.now()}`,
    },
    { status: 200 }
  );
}
