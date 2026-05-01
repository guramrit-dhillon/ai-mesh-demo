import { useStore } from '../store';

export type AccentRGB = [number, number, number];

// Mirror of [data-accent='…'] in src/styles/index.css. When CSS adds an accent
// option, mirror it here so the 3D scenes can retint to match.
export const ACCENT_RGB: Record<string, AccentRGB> = {
  cyan:    [124, 228, 255],
  violet:  [167, 139, 250],
  emerald: [110, 231, 183],
  amber:   [251, 191, 36]
};

// Slate-toned floor color (matches --mesh-mute) used by `shade()` so even
// dim/pruned tokens stay readable on the dark canvas background.
const FLOOR: AccentRGB = [78, 102, 128];

// Mix the slate floor toward `rgb` by `factor`, then optionally toward white
// by `mixWhite`. factor=0 → floor (always visible), factor=1 → pure accent,
// mixWhite=1 → pure white. Replaces the previous multiply-only formula which
// made amber-tinted dim tokens nearly invisible on a dark background.
export function shade(rgb: AccentRGB, factor: number, mixWhite = 0): string {
  const [r, g, b] = rgb;
  const f = Math.max(0, Math.min(1, factor));
  const m = Math.max(0, Math.min(1, mixWhite));
  const baseR = FLOOR[0] + (r - FLOOR[0]) * f;
  const baseG = FLOOR[1] + (g - FLOOR[1]) * f;
  const baseB = FLOOR[2] + (b - FLOOR[2]) * f;
  const rr = Math.round(baseR + (255 - baseR) * m);
  const gg = Math.round(baseG + (255 - baseG) * m);
  const bb = Math.round(baseB + (255 - baseB) * m);
  return `rgb(${Math.min(255, rr)}, ${Math.min(255, gg)}, ${Math.min(255, bb)})`;
}

// Render an `rgba(r, g, b, a)` from an accent tuple — useful where SpriteText/
// CanvasTexture gradients need an alpha channel.
export function rgba(rgb: AccentRGB, alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

// Hook: read the current accent and return its RGB tuple. Components subscribe
// to changes so closures rebuild and three.js scenes can retint.
export function useAccentRGB(): AccentRGB {
  const accent = useStore((s) => s.accent);
  return ACCENT_RGB[accent] ?? ACCENT_RGB.cyan;
}
