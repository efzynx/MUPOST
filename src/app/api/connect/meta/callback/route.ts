import { NextResponse, type NextRequest } from "next/server";
import { platformConnector, PlatformError } from "@/lib/services/platform-connector";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const appBase = process.env.NEXT_PUBLIC_APP_URL || request.url;
  const baseUrl = new URL("/settings/connections", appBase);

  // Penanganan pembatalan atau error dari Meta (Requirement 4.5 & 4.6)
  if (error) {
    baseUrl.searchParams.set("error", error === "access_denied" ? "access_denied" : error);
    if (errorDescription) {
      baseUrl.searchParams.set("message", errorDescription);
    }
    return NextResponse.redirect(baseUrl);
  }

  if (!code || !state) {
    baseUrl.searchParams.set("error", "missing_parameters");
    return NextResponse.redirect(baseUrl);
  }

  try {
    const saved = await platformConnector.handleMetaCallback(code, state);
    if (!saved || saved.length === 0) {
      baseUrl.searchParams.set("error", "NO_PAGES_FOUND");
      baseUrl.searchParams.set(
        "message",
        "Tidak ada Facebook Page yang ditemukan atau dipilih. Pastikan akun Anda memiliki Facebook Page dan Anda mencentangnya saat login Meta."
      );
      return NextResponse.redirect(baseUrl);
    }
    baseUrl.searchParams.set("success", "meta");
    return NextResponse.redirect(baseUrl);
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    console.error("[Meta Callback Error]", err);
    if (err instanceof PlatformError) {
      baseUrl.searchParams.set("error", err.code);
      baseUrl.searchParams.set("message", err.message);
    } else {
      baseUrl.searchParams.set("error", "meta_connection_failed");
    }
    return NextResponse.redirect(baseUrl);
  }
}
