import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

/**
 * Mengambil encryption key 32-byte (256-bit) dari parameter override atau process.env.
 */
function getEncryptionKey(overrideKey?: string | Buffer): Buffer {
  if (overrideKey) {
    if (typeof overrideKey === "string") {
      const buf = Buffer.from(overrideKey, "hex");
      if (buf.length !== 32) {
        throw new Error("Encryption key must be exactly 32 bytes (64 hex characters)");
      }
      return buf;
    }
    if (overrideKey.length !== 32) {
      throw new Error("Encryption key must be exactly 32 bytes");
    }
    return overrideKey;
  }

  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("TOKEN_ENCRYPTION_KEY environment variable is not defined");
  }

  const keyBuf = Buffer.from(keyHex, "hex");
  if (keyBuf.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }

  return keyBuf;
}

/**
 * Mengenkripsi plaintext menggunakan AES-256-GCM.
 * Menghasilkan string berformat: iv:authTag:encrypted (dalam representasi hex).
 */
export function encrypt(plaintext: string, overrideKey?: string | Buffer): string {
  const key = getEncryptionKey(overrideKey);
  const iv = randomBytes(12); // 96-bit IV standar untuk GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Mendekripsi ciphertext berformat iv:authTag:encrypted menggunakan AES-256-GCM.
 * Melempar error jika authTag tidak cocok atau data telah dimanipulasi.
 */
export function decrypt(ciphertext: string, overrideKey?: string | Buffer): string {
  const key = getEncryptionKey(overrideKey);
  const parts = ciphertext.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format. Expected iv:authTag:encrypted");
  }

  const [ivHex, authTagHex, encryptedHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  if (iv.length !== 12) {
    throw new Error("Invalid IV length. Expected 12 bytes");
  }

  if (authTag.length !== 16) {
    throw new Error("Invalid AuthTag length. Expected 16 bytes");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString("utf8");
}
