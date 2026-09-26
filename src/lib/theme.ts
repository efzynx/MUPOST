export type ThemeMode = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "mupost-theme";

export const SUPPORTED_THEMES: readonly ThemeMode[] = ["light", "dark", "system"] as const;

export const THEME_VIEWPORT_COLORS = [
  { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  { media: "(prefers-color-scheme: dark)", color: "#09090b" },
];

export interface ThemeMetadata {
  value: ThemeMode;
  label: string;
  fullLabel: string;
  description: string;
}

export const THEME_METADATA: ThemeMetadata[] = [
  {
    value: "light",
    label: "Terang",
    fullLabel: "Terang (Light)",
    description: "Tampilan cerah dengan kontras tinggi untuk kenyamanan di siang hari.",
  },
  {
    value: "dark",
    label: "Gelap",
    fullLabel: "Gelap (Dark)",
    description: "Tampilan gelap yang elegan dan ramah di mata untuk kondisi minim cahaya.",
  },
  {
    value: "system",
    label: "Auto",
    fullLabel: "Otomatis (Sistem)",
    description: "Mengikuti pengaturan preferensi tema perangkat atau sistem operasi Anda.",
  },
];

/**
 * Mengambil tema berikutnya dalam siklus untuk tombol toggle ringkas.
 * Urutan: system -> light -> dark -> system
 */
export function getNextTheme(current: ThemeMode | string | undefined): ThemeMode {
  if (current === "system") return "light";
  if (current === "light") return "dark";
  return "system";
}

/**
 * Menghitung index tema berikutnya saat navigasi keyboard (ArrowRight/ArrowLeft)
 */
export function getNextThemeIndex(currentIndex: number, direction: "next" | "prev"): number {
  const len = SUPPORTED_THEMES.length;
  if (direction === "next") {
    return (currentIndex + 1) % len;
  }
  return (currentIndex - 1 + len) % len;
}

/**
 * Menentukan tema efektif (apakah terang atau gelap) berdasarkan preferensi sistem operasi.
 */
export function resolveEffectiveTheme(
  theme: ThemeMode | string | undefined,
  systemPrefersDark: boolean
): "light" | "dark" {
  if (theme === "system" || !theme) {
    return systemPrefersDark ? "dark" : "light";
  }
  return theme === "dark" ? "dark" : "light";
}
