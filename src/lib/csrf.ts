/**
 * Menghasilkan token CSRF acak yang aman secara kriptografi (32 byte dalam hex = 64 karakter).
 */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Memvalidasi token CSRF yang dikirim pada request (misal dari header)
 * terhadap token yang tersimpan (misal dari cookie) menggunakan timing-safe comparison.
 */
export function validateCsrfToken(
  token: string | null | undefined,
  stored: string | null | undefined
): boolean {
  if (!token || !stored) {
    return false;
  }

  // Jika panjang tidak sama, token pasti tidak cocok
  if (token.length !== stored.length) {
    return false;
  }

  // Constant-time comparison untuk mencegah timing attack
  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ stored.charCodeAt(i);
  }

  return mismatch === 0;
}
