import { createHash, randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { SignJWT, jwtVerify } from "jose";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, sessions, type User } from "@/lib/db/schema";
import { getRedisClient } from "@/lib/redis";
import { env } from "@/lib/env";

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
  ipAddress: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  lockedUntil?: Date;
}

export interface SafeUser {
  id: string;
  fullName: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

function getJwtSecret(): Uint8Array {
  const secretStr =
    process.env.NEXTAUTH_SECRET ||
    (typeof env !== "undefined" ? env.NEXTAUTH_SECRET : "super-secret-jwt-key-minimum-16-chars");
  return new TextEncoder().encode(secretStr);
}

export class AuthError extends Error {
  constructor(
    public code:
      | "EMAIL_UNAVAILABLE"
      | "VALIDATION_ERROR"
      | "INVALID_CREDENTIALS"
      | "ACCOUNT_LOCKED"
      | "SESSION_EXPIRED",
    public statusCode: number,
    message: string,
    public details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Validasi alamat email sesuai standar RFC 5322 dan panjang maksimal 254 karakter.
 */
export function validateEmailRFC5322(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  if (email.length > 254) return false;

  const atIndex = email.lastIndexOf("@");
  if (atIndex <= 0 || atIndex !== email.indexOf("@") || atIndex === email.length - 1) {
    return false;
  }

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  if (local.length === 0 || local.length > 64) return false;
  if (domain.length === 0 || domain.length > 253) return false;

  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  const localRegex = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]+$/;
  if (!localRegex.test(local)) return false;

  const domainLabels = domain.split(".");
  if (domainLabels.length < 2) return false;

  for (const label of domainLabels) {
    if (label.length === 0 || label.length > 63) return false;
    if (label.startsWith("-") || label.endsWith("-")) return false;
    if (!/^[a-zA-Z0-9-]+$/.test(label)) return false;
  }

  const tld = domainLabels[domainLabels.length - 1]!;
  if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) return false;

  return true;
}

/**
 * Validasi panjang kata sandi dalam rentang [8, 128] karakter.
 */
export function validatePasswordLength(password: string): boolean {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

/**
 * Menghasilkan SHA-256 hash dari string token.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class AuthService {
  /**
   * Mendaftarkan pengguna baru ke platform.
   */
  async register(data: RegisterInput): Promise<{ userId: string; user: SafeUser }> {
    const errors: Record<string, string[]> = {};

    if (!data.fullName || typeof data.fullName !== "string" || data.fullName.trim().length === 0) {
      errors.fullName = ["Nama lengkap wajib diisi"];
    } else if (data.fullName.length > 100) {
      errors.fullName = ["Nama lengkap maksimal 100 karakter"];
    }

    if (!data.email || !validateEmailRFC5322(data.email)) {
      errors.email = ["Format email tidak valid"];
    }

    if (!data.password || !validatePasswordLength(data.password)) {
      errors.password = ["Kata sandi harus 8–128 karakter"];
    }

    if (Object.keys(errors).length > 0) {
      throw new AuthError("VALIDATION_ERROR", 400, "Data registrasi tidak valid", errors);
    }

    const normalizedEmail = data.email.trim().toLowerCase();

    // Pastikan email belum terdaftar
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser.length > 0) {
      throw new AuthError(
        "EMAIL_UNAVAILABLE",
        409,
        "Email tidak dapat digunakan. Silakan gunakan email lain atau login."
      );
    }

    // Hash kata sandi dengan bcrypt cost 12
    const passwordHash = await bcrypt.hash(data.password, 12);

    const [newUser] = await db
      .insert(users)
      .values({
        fullName: data.fullName.trim(),
        email: normalizedEmail,
        passwordHash,
      })
      .returning({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    if (!newUser) {
      throw new Error("Gagal membuat akun pengguna");
    }

    return {
      userId: newUser.id,
      user: newUser,
    };
  }

  /**
   * Autentikasi pengguna, memeriksa rate limit IP, dan menghasilkan token sesi JWT.
   */
  async login(
    data: LoginInput
  ): Promise<{ sessionToken: string; expiresAt: Date; user: SafeUser }> {
    const rateLimit = await this.checkRateLimit(data.ipAddress);
    if (!rateLimit.allowed) {
      throw new AuthError(
        "ACCOUNT_LOCKED",
        429,
        "Terlalu banyak percobaan. Coba lagi dalam 15 menit."
      );
    }

    const normalizedEmail = (data.email || "").trim().toLowerCase();

    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!userRecord) {
      await this.recordFailedLogin(data.ipAddress);
      throw new AuthError("INVALID_CREDENTIALS", 401, "Email atau kata sandi tidak valid.");
    }

    const isPasswordMatch = await bcrypt.compare(data.password || "", userRecord.passwordHash);
    if (!isPasswordMatch) {
      await this.recordFailedLogin(data.ipAddress);
      throw new AuthError("INVALID_CREDENTIALS", 401, "Email atau kata sandi tidak valid.");
    }

    // Login berhasil: reset counter rate limit untuk IP ini
    await this.resetRateLimit(data.ipAddress);

    // Buat JWT token dengan masa berlaku 24 jam
    const secret = getJwtSecret();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const sessionToken = await new SignJWT({ sub: userRecord.id })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(secret);

    // Simpan SHA-256 hash dari token ke tabel sessions
    const tokenHash = hashToken(sessionToken);
    await db.insert(sessions).values({
      userId: userRecord.id,
      tokenHash,
      expiresAt,
    });

    const safeUser: SafeUser = {
      id: userRecord.id,
      fullName: userRecord.fullName,
      email: userRecord.email,
      createdAt: userRecord.createdAt,
      updatedAt: userRecord.updatedAt,
    };

    return {
      sessionToken,
      expiresAt,
      user: safeUser,
    };
  }

  /**
   * Menghapus atau membatalkan sesi pengguna di server.
   */
  async logout(sessionToken: string): Promise<void> {
    if (!sessionToken) return;

    const tokenHash = hashToken(sessionToken);
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.tokenHash, tokenHash));
  }

  /**
   * Memvalidasi token sesi dari cookie: verifikasi JWT, cek hash di database,
   * pastikan sesi belum di-revoke dan belum kedaluwarsa.
   */
  async validateSession(sessionToken: string): Promise<User | null> {
    if (!sessionToken) return null;

    try {
      const secret = getJwtSecret();
      const { payload } = await jwtVerify(sessionToken, secret);

      if (!payload.sub) {
        return null;
      }

      const tokenHash = hashToken(sessionToken);

      const [result] = await db
        .select({
          user: users,
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(
          and(
            eq(sessions.tokenHash, tokenHash),
            isNull(sessions.revokedAt),
            gt(sessions.expiresAt, new Date())
          )
        )
        .limit(1);

      return result?.user ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Redis Sliding Window Counter untuk rate limiting login:
   * Key: rate_limit:login:{ip}, window 10 menit, max 5 attempts, lock 15 menit.
   */
  async checkRateLimit(ipAddress: string): Promise<RateLimitResult> {
    const ip = ipAddress || "unknown";
    const redis = getRedisClient();

    const lockKey = `rate_limit:login:lock:${ip}`;
    const windowKey = `rate_limit:login:${ip}`;

    try {
      // 1. Cek apakah IP sedang dalam status terkunci
      const lockExpiryStr = await redis.get(lockKey);
      if (lockExpiryStr) {
        const lockExpiryTime = parseInt(lockExpiryStr, 10);
        if (lockExpiryTime > Date.now()) {
          return {
            allowed: false,
            remainingAttempts: 0,
            lockedUntil: new Date(lockExpiryTime),
          };
        }
      }

      const now = Date.now();
      const windowMs = 10 * 60 * 1000; // 10 menit

      // Hapus percobaan di luar jendela 10 menit
      await redis.zremrangebyscore(windowKey, 0, now - windowMs);

      // Hitung jumlah percobaan dalam jendela
      const count = await redis.zcard(windowKey);
      const maxAttempts = 5;

      if (count >= maxAttempts) {
        const lockDurationMs = 15 * 60 * 1000; // 15 menit
        const lockedUntilTime = now + lockDurationMs;
        await redis.set(lockKey, lockedUntilTime.toString(), "PX", lockDurationMs);

        return {
          allowed: false,
          remainingAttempts: 0,
          lockedUntil: new Date(lockedUntilTime),
        };
      }

      return {
        allowed: true,
        remainingAttempts: Math.max(0, maxAttempts - count),
      };
    } catch (err) {
      // Fallback jika Redis tidak dapat diakses (agar tidak memblokir user secara salah)
      // eslint-disable-next-line no-console
      console.warn("[RateLimit Warning] Gagal memeriksa Redis:", err);
      return { allowed: true, remainingAttempts: 5 };
    }
  }

  /**
   * Mencatat percobaan login gagal ke Redis sliding window.
   */
  async recordFailedLogin(ipAddress: string): Promise<void> {
    const ip = ipAddress || "unknown";
    const redis = getRedisClient();
    const windowKey = `rate_limit:login:${ip}`;
    const lockKey = `rate_limit:login:lock:${ip}`;

    try {
      const now = Date.now();
      const windowMs = 10 * 60 * 1000; // 10 menit
      const uniqueId = `${now}:${randomUUID()}`;

      // Tambahkan percobaan ke sorted set
      await redis.zadd(windowKey, now, uniqueId);
      // Set TTL 10 menit pada sorted set
      await redis.expire(windowKey, 600);

      // Bersihkan percobaan lama
      await redis.zremrangebyscore(windowKey, 0, now - windowMs);

      // Hitung total percobaan saat ini
      const count = await redis.zcard(windowKey);
      if (count >= 5) {
        const lockDurationMs = 15 * 60 * 1000; // 15 menit
        const lockedUntilTime = now + lockDurationMs;
        await redis.set(lockKey, lockedUntilTime.toString(), "PX", lockDurationMs);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[RateLimit Warning] Gagal mencatat login gagal di Redis:", err);
    }
  }

  /**
   * Mereset counter rate limit untuk IP tertentu setelah login berhasil.
   */
  async resetRateLimit(ipAddress: string): Promise<void> {
    const ip = ipAddress || "unknown";
    const redis = getRedisClient();
    const windowKey = `rate_limit:login:${ip}`;
    const lockKey = `rate_limit:login:lock:${ip}`;

    try {
      await redis.del(windowKey, lockKey);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[RateLimit Warning] Gagal mereset rate limit di Redis:", err);
    }
  }
}

export const authService = new AuthService();
