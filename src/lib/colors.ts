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

  // Sort colors by hue to find gaps
  const sorted = [...colors].filter(c => c.h !== undefined).sort((a, b) => a.h! - b.h!);
  if (sorted.length === 0) return groups;

  let currentGroup: ColorData[] = [sorted[0]];
  groups.set(sorted[0].h!, currentGroup);

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const diff = curr.h! - prev.h!;

    // If gap is larger than 15 degrees, start new family
    if (diff > 15) {
      currentGroup = [curr];
      groups.set(curr.h!, currentGroup);
    } else {
      currentGroup.push(curr);
    }
  }

  // Final pass: merge first and last if they wrap around 360
  const keys = Array.from(groups.keys()).sort((a, b) => a - b);
  if (keys.length > 1) {
    const firstKey = keys[0];
    const lastKey = keys[keys.length - 1];
    const wrapDiff = (360 - lastKey) + firstKey;
    if (wrapDiff <= 15) {
      const lastGroup = groups.get(lastKey)!;
      const firstGroup = groups.get(firstKey)!;
      firstGroup.push(...lastGroup);
      groups.delete(lastKey);
    }
  }

  return groups;
}
