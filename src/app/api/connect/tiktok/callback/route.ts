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

  // Penanganan pembatalan atau error dari TikTok (Requirement 5.4)
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
    await platformConnector.handleTikTokCallback(code, state);
    baseUrl.searchParams.set("success", "tiktok");
    return NextResponse.redirect(baseUrl);
  } catch (err: unknown) {
    if (err instanceof PlatformError) {
      baseUrl.searchParams.set("error", err.code);
      baseUrl.searchParams.set("message", err.message);
    } else {
      baseUrl.searchParams.set("error", "tiktok_connection_failed");
    }
    return NextResponse.redirect(baseUrl);
  }
}
