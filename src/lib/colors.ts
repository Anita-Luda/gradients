import { formatHex, oklch } from 'culori';

export interface ColorData {
  hex: string;
  l: number; // 0 to 1
  c: number; // 0 to 0.4 approx
  h: number | undefined; // 0 to 360
  weight: number; // 0 (brightest/white) to 1000 (darkest/black)
}

export function parseHexList(input: string): ColorData[] {
  const hexRegex = /#([0-9a-f]{3,6})/gi;
  const matches = input.match(hexRegex) || [];

  return matches.map(hex => {
    const color = oklch(hex);
    if (!color) return null;

    // Weight: Map L (1 to 0) to 0 to 1000
    // L=1 -> 0, L=0 -> 1000
    const weight = Math.round((1 - color.l) * 1000);

    return {
      hex: formatHex(hex) as string,
      l: color.l,
      c: color.c,
      h: color.h,
      weight
    };
  }).filter((c): c is ColorData => c !== null);
}

export function groupHues(colors: ColorData[]): Map<number, ColorData[]> {
  const groups = new Map<number, ColorData[]>();

  colors.forEach(color => {
    const h = color.h ?? 0;
    // Group hues within 30 degrees
    let found = false;
    for (const [hue, group] of groups.entries()) {
      const diff = Math.min(Math.abs(h - hue), 360 - Math.abs(h - hue));
      if (diff < 30) {
        group.push(color);
        found = true;
        break;
      }
    }
    if (!found) {
      groups.set(h, [color]);
    }
  });

  return groups;
}
