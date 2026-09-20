/**
 * themeColor.ts
 *
 * Converts a hex accent color into the 11 Tailwind v4 emerald shade slots
 * (50–950) expressed in oklch(), then injects them as CSS custom properties
 * on :root so that every `bg-emerald-*`, `text-emerald-*`, etc. utility
 * picks up the new palette immediately — no page reload needed.
 *
 * Approach:
 *   1. Parse hex → linear-light RGB
 *   2. Convert to OKLab (https://bottosson.github.io/posts/oklab/)
 *   3. Build a 11-stop palette by interpolating L (lightness) and keeping
 *      the hue/chroma of the input color, scaling chroma down for extremes
 *   4. Convert each stop back to oklch() string
 *   5. Inject / update a <style id="theme-override"> block in <head>
 */

// ─── Colour math ─────────────────────────────────────────────────────────────

function hexToLinearRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return [toLinear(r), toLinear(g), toLinear(b)];
}

function linearRgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  ];
}

/** Returns [L, C, H] in the oklch model (L 0–1, C 0–0.4, H 0–360) */
function oklabToOklch(L: number, a: number, b: number): [number, number, number] {
  const C = Math.sqrt(a * a + b * b);
  const H = (Math.atan2(b, a) * 180) / Math.PI;
  return [L, C, H < 0 ? H + 360 : H];
}

function hexToOklch(hex: string): [number, number, number] {
  const [r, g, b] = hexToLinearRgb(hex);
  const [L, a, ob] = linearRgbToOklab(r, g, b);
  return oklabToOklch(L, a, ob);
}

// Tailwind v4 default emerald L values (extracted from the oklch defaults)
// These define the lightness curve; we keep the hue/chroma of the user color.
const SHADE_L: Record<number, number> = {
  50:  0.979,
  100: 0.950,
  200: 0.905,
  300: 0.845,
  400: 0.765,
  500: 0.696,
  600: 0.596,
  700: 0.508,
  800: 0.432,
  900: 0.378,
  950: 0.262,
};

// Chroma scale factor per shade — lighter/darker shades have less chroma
const SHADE_C_FACTOR: Record<number, number> = {
  50:  0.13,
  100: 0.32,
  200: 0.57,
  300: 0.88,
  400: 1.08,
  500: 1.04,
  600: 0.89,
  700: 0.72,
  800: 0.58,
  900: 0.47,
  950: 0.31,
};

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

function buildPalette(hex: string): Record<number, string> {
  const [, C, H] = hexToOklch(hex);
  const palette: Record<number, string> = {};
  for (const shade of SHADES) {
    const L = SHADE_L[shade];
    const scaledC = C * SHADE_C_FACTOR[shade];
    // oklch values: L 0–1, C 0–0.4, H 0–360
    palette[shade] = `oklch(${(L * 100).toFixed(1)}% ${scaledC.toFixed(4)} ${H.toFixed(3)})`;
  }
  return palette;
}

// ─── DOM injection ────────────────────────────────────────────────────────────

const STYLE_ID = 'sahakari-theme-override';

/**
 * Call this with any valid 6-digit hex color (e.g. "#0ea5e9") to instantly
 * repaint every emerald utility in the app.
 */
export function applyThemeColor(hex: string): void {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;

  const palette = buildPalette(hex);

  const vars = SHADES.map(
    (s) => `  --color-emerald-${s}: ${palette[s]};`
  ).join('\n');

  const css = `:root {\n${vars}\n}\n`;

  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}
