export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax" | "none";
  maxAge: number;
  path: string;
}

export const SESSION_COOKIE_NAME = "session";
export const CSRF_COOKIE_NAME = "csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";

export const SESSION_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 60 * 60 * 24, // 24 jam (86400 detik)
  path: "/",
};

export const CSRF_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: false, // Harus dapat dibaca oleh client-side JavaScript untuk dikirim ke header
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 60 * 60 * 24, // 24 jam
  path: "/",
};
