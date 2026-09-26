import {
  THEME_STORAGE_KEY,
  SUPPORTED_THEMES,
  THEME_VIEWPORT_COLORS,
  THEME_METADATA,
  getNextTheme,
  getNextThemeIndex,
  resolveEffectiveTheme,
} from "@/lib/theme";

describe("Theme System (Light, Dark, Auto/System)", () => {
  describe("Viewport Theme Color Configuration", () => {
    it("configures responsive theme colors for light and dark modes", () => {
      expect(Array.isArray(THEME_VIEWPORT_COLORS)).toBe(true);

      const lightConfig = THEME_VIEWPORT_COLORS.find(
        (c) => c.media === "(prefers-color-scheme: light)"
      );
      const darkConfig = THEME_VIEWPORT_COLORS.find(
        (c) => c.media === "(prefers-color-scheme: dark)"
      );

      expect(lightConfig).toBeDefined();
      expect(lightConfig?.color).toBe("#fafafa");

      expect(darkConfig).toBeDefined();
      expect(darkConfig?.color).toBe("#09090b");
    });
  });

  describe("Theme Mode Cycling & Transitions", () => {
    it("cycles through system -> light -> dark -> system correctly", () => {
      expect(getNextTheme("system")).toBe("light");
      expect(getNextTheme("light")).toBe("dark");
      expect(getNextTheme("dark")).toBe("system");
      expect(getNextTheme(undefined)).toBe("system");
    });

    it("correctly resolves effective theme when system preference changes", () => {
      // When theme is system
      expect(resolveEffectiveTheme("system", true)).toBe("dark");
      expect(resolveEffectiveTheme("system", false)).toBe("light");
      expect(resolveEffectiveTheme(undefined, true)).toBe("dark");
      expect(resolveEffectiveTheme(undefined, false)).toBe("light");

      // When theme is explicitly dark
      expect(resolveEffectiveTheme("dark", false)).toBe("dark");
      expect(resolveEffectiveTheme("dark", true)).toBe("dark");

      // When theme is explicitly light
      expect(resolveEffectiveTheme("light", true)).toBe("light");
      expect(resolveEffectiveTheme("light", false)).toBe("light");
    });
  });

  describe("Supported Theme Options & Storage", () => {
    it("validates all required themes are supported", () => {
      expect(SUPPORTED_THEMES).toContain("light");
      expect(SUPPORTED_THEMES).toContain("dark");
      expect(SUPPORTED_THEMES).toContain("system");
      expect(SUPPORTED_THEMES).toHaveLength(3);
    });

    it("uses consistent storage key for local storage persistence", () => {
      expect(THEME_STORAGE_KEY).toBe("mupost-theme");
    });
  });

  describe("Minimal 3-Icon Theme Selector & ARIA Accessibility", () => {
    it("defines 3 options: light, dark, and auto/system", () => {
      expect(THEME_METADATA).toHaveLength(3);
      const values = THEME_METADATA.map((o) => o.value);
      expect(values).toEqual(["light", "dark", "system"]);
    });

    it("has descriptive labels and tooltips for all 3 modes", () => {
      const lightOpt = THEME_METADATA.find((o) => o.value === "light");
      const darkOpt = THEME_METADATA.find((o) => o.value === "dark");
      const systemOpt = THEME_METADATA.find((o) => o.value === "system");

      expect(lightOpt?.label).toBe("Terang");
      expect(lightOpt?.fullLabel).toContain("Terang");
      expect(lightOpt?.description).toBeTruthy();

      expect(darkOpt?.label).toBe("Gelap");
      expect(darkOpt?.fullLabel).toContain("Gelap");
      expect(darkOpt?.description).toBeTruthy();

      expect(systemOpt?.label).toBe("Auto");
      expect(systemOpt?.fullLabel).toContain("Otomatis (Sistem)");
      expect(systemOpt?.description).toBeTruthy();
    });

    it("correctly computes next index on ArrowRight and ArrowLeft keyboard navigation", () => {
      // 0: Light, 1: Dark, 2: System
      expect(getNextThemeIndex(0, "next")).toBe(1); // Light -> Dark
      expect(getNextThemeIndex(1, "next")).toBe(2); // Dark -> System
      expect(getNextThemeIndex(2, "next")).toBe(0); // System -> Light (wraps)

      expect(getNextThemeIndex(0, "prev")).toBe(2); // Light -> System (wraps)
      expect(getNextThemeIndex(2, "prev")).toBe(1); // System -> Dark
      expect(getNextThemeIndex(1, "prev")).toBe(0); // Dark -> Light
    });
  });
});
