import type { ColorData } from './colors';
import { groupHues } from './colors';

export type Geometry = 'linear' | 'radial' | 'conic' | 'mesh';

export interface GradientOptions {
  preset: string;
  mood: number; // 0-1000
  contrast: number; // 0-100
  density: number; // 0-100
  hueLimit: number; // 1-10
  geometry: Geometry;
  angle: number;
  inverted: boolean;
  mirrored: boolean;
  hueSeed: number;
}

interface Stop {
  color: string;
  pos: number; // 0-100
}

export function generateGradient(colors: ColorData[], options: GradientOptions): string {
  if (colors.length === 0) return 'linear-gradient(to right, #333, #333)';

  let stops: Stop[] = [];

  // Get active stops based on preset
  switch (options.preset) {
    case 'hologram':
      // Dynamic Center Logic: Micro-deviations around 250 (range 100-400)
      // We force a weight filter to ensure only light colors are used for this "pearly" effect.
      const hWeights = [250, 300, 200, 280, 250, 220, 300, 250];
      stops = getAtmosphericStops(colors, hWeights, options, [0, 14, 28, 42, 56, 70, 84, 100], true, { min: 0, max: 450 });
      break;
    case 'sunset':
      stops = getAtmosphericStops(colors, [200, 450, 650, 850], options);
      break;
    case 'reflex':
      stops = getAtmosphericStops(colors, [0, 50, 900, 900, 850], options, [0, 3, 6, 40, 100]);
      break;
    case 'ripples':
      stops = getAtmosphericStops(colors, [900, 100, 850, 200, 800, 300, 750], options, [0, 15, 30, 45, 60, 80, 100]);
      break;
    case 'aurora':
      stops = getAtmosphericStops(colors, [950, 950, 400, 300, 500, 1000, 1000], options, [0, 60, 68, 72, 78, 85, 100]);
      break;
    case 'galaxy':
      stops = getAtmosphericStops(colors, [950, 950, 300, 400, 950, 950], options, [0, 65, 70, 75, 80, 100]);
      break;
    case 'magma':
      stops = getAtmosphericStops(colors, [900, 700, 200, 800, 950], options);
      break;
    case 'cyberpunk':
      stops = getAtmosphericStops(colors, [950, 950, 200, 200, 1000, 1000], options, [0, 46, 49, 51, 54, 100]);
      break;
    case 'chrome':
      // Liquid Chrome: classic horizon
      stops = getAtmosphericStops(colors, [1000, 900, 100, 50, 800, 400], options, [0, 48, 49.5, 50.5, 52, 100]);
      break;
    case 'liquid-metal':
      // The "cool" one that was previously chrome
      stops = getAtmosphericStops(colors, [700, 850, 150, 900, 200, 400], options, [0, 49, 49.5, 50.5, 51, 100]);
      break;
    case 'ethereal':
      const eWeights = [500, 520, 480, 510];
      stops = getAtmosphericStops(colors, eWeights, options, [0, 10, 90, 100]);
      break;
    case 'abyss':
      stops = getAtmosphericStops(colors, [950, 800, 900, 600, 1000], options);
      break;
    case 'light-top':
      stops = getAtmosphericStops(colors, [100, 400, 900], options, [0, 50, 100]);
      break;
    case 'light-side':
      stops = getAtmosphericStops(colors, [50, 700, 1000], options, [0, 20, 100]);
      break;
    case 'vignette':
      stops = getAtmosphericStops(colors, [100, 300, 950], options, [0, 40, 100]);
      break;
    default: {
      const linearWeights = colors.length > 1
        ? colors.map((_, i) => (i / (colors.length - 1)) * 1000)
        : [500];
      stops = getAtmosphericStops(colors, linearWeights, options);
      break;
    }
  }

  if (options.inverted) {
    stops = stops.map(s => ({ ...s, color: invertColor(s.color, colors) }));
  }

  if (options.mirrored) {
    const mirroredStops = [...stops].reverse().map(s => ({ ...s, pos: 100 + (100 - s.pos) }));
    stops = [...stops.map(s => ({ ...s, pos: s.pos / 2 })), ...mirroredStops.map(s => ({ ...s, pos: s.pos / 2 }))];
  }

  let geometry = options.geometry;
  if (options.preset === 'ripples' || options.preset === 'reflex') {
    geometry = 'radial';
  }

  if (options.geometry === 'mesh') {
    return generateMesh(stops, options.hueSeed);
  }

  const finalStops = injectAnchorStops(stops, colors);

  const stopStr = finalStops.map(s => `${s.color} ${s.pos.toFixed(2)}%`).join(', ');

  const method = 'in oklch ';

  if (geometry === 'radial') {
    return `radial-gradient(${method}circle at center, ${stopStr})`;
  } else if (geometry === 'conic') {
    return `conic-gradient(${method}from ${options.angle}deg, ${stopStr})`;
  } else {
    return `linear-gradient(${method}${options.angle}deg, ${stopStr})`;
  }
}

function seededShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.abs(Math.sin(seed + i)) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getAtmosphericStops(
  pool: ColorData[],
  targetWeights: number[],
  options: GradientOptions,
  customPos?: number[],
  forceDiversity: boolean = false,
  weightFilter?: { min: number, max: number }
): Stop[] {
  // Filter pool if range specified
  let filteredPool = pool;
  if (weightFilter) {
    filteredPool = pool.filter(c => c.weight >= weightFilter.min && c.weight <= weightFilter.max);
    // Fallback if no colors in range: pick the closest ones
    if (filteredPool.length === 0) {
      const mid = (weightFilter.min + weightFilter.max) / 2;
      const sorted = [...pool].sort((a, b) => Math.abs(a.weight - mid) - Math.abs(b.weight - mid));
      filteredPool = sorted.slice(0, Math.max(3, Math.floor(pool.length / 3)));
    }
  }

  const allHueGroupsMap = groupHues(filteredPool);
  // Default sort by hue
  let allHueGroups = Array.from(allHueGroupsMap.values()).sort((a, b) => (a[0].h ?? 0) - (b[0].h ?? 0));

  // Real mixing: Shuffle the hue families based on seed
  if (options.hueSeed > 0) {
    allHueGroups = seededShuffle(allHueGroups, options.hueSeed);
  }

  // Limit number of hue families used
  const limit = Math.min(options.hueLimit, allHueGroups.length);
  const hueGroups = allHueGroups.slice(0, limit);

  // Apply Mood shift
  const shiftedWeights = targetWeights.map(w => {
    const shift = (options.mood - 500);
    return Math.max(0, Math.min(1000, w + shift));
  });

  // Apply Contrast/Dynamics
  const mean = shiftedWeights.reduce((a, b) => a + b, 0) / (shiftedWeights.length || 1);
  const contrastFactor = options.contrast / 100;
  const contrastedWeights = shiftedWeights.map(w => {
    const newVal = mean + (w - mean) * contrastFactor;
    return Math.max(0, Math.min(1000, newVal));
  });

  return contrastedWeights.map((tw, i) => {
    let weight = tw;
    let activePool = pool;

    if (hueGroups.length > 0) {
      // If shuffle > 0, we can also shuffle the assignment of groups to stops
      let groupIdx = i % hueGroups.length;
      if (options.hueSeed > 0) {
        // Use a more stable but randomized indexing
        const seed = options.hueSeed + i * 1.5;
        groupIdx = Math.floor(Math.abs(Math.sin(seed)) * hueGroups.length);
      }
      activePool = hueGroups[groupIdx];
    }

    const colorHex = findClosestColorWithFallback(activePool, weight);

    let pos = customPos ? customPos[i] : (i / (contrastedWeights.length - 1)) * 100;

    // Apply Density (non-linear warping)
    const p = pos / 100;
    const factor = (options.density - 50) / 50; // -1 to 1
    let warpedP = p;
    if (factor > 0) {
      // Squeeze toward center (0.5)
      const strength = 1 + factor * 5;
      warpedP = p < 0.5
        ? 0.5 * Math.pow(p / 0.5, strength)
        : 1 - 0.5 * Math.pow((1 - p) / 0.5, strength);
    } else if (factor < 0) {
      // Push toward edges
      const f = Math.abs(factor);
      const strength = 1 + f * 5;
      warpedP = p < 0.5
        ? 0.5 * (1 - Math.pow(1 - (p / 0.5), strength))
        : 0.5 + 0.5 * Math.pow((p - 0.5) / 0.5, strength);
    }
    pos = warpedP * 100;

    return { color: colorHex, pos };
  });
}

function findClosestColorWithFallback(pool: ColorData[], weight: number): string {
  if (pool.length === 0) return '#888';
  return pool.reduce((prev, curr) => {
    return Math.abs(curr.weight - weight) < Math.abs(prev.weight - weight) ? curr : prev;
  }).hex;
}

function invertColor(hex: string, pool: ColorData[]): string {
  const color = pool.find(c => c.hex.toLowerCase() === hex.toLowerCase());
  let currentWeight: number;
  if (color) {
    currentWeight = color.weight;
  } else if (hex.toLowerCase() === '#ffffff') {
    currentWeight = 0;
  } else if (hex.toLowerCase() === '#000000') {
    currentWeight = 1000;
  } else {
    return hex;
  }

  const targetWeight = 1000 - currentWeight;
  return findClosestColorWithFallback(pool, targetWeight);
}

function generateMesh(stops: Stop[], seed: number): string {
  const shuffledStops = seededShuffle(stops, seed);
  const bg = shuffledStops[0]?.color || '#000';
  const layers = shuffledStops.slice(1).map((s, i) => {
    const x = 10 + (Math.abs(Math.sin(seed + i * 13)) * 80);
    const y = 10 + (Math.abs(Math.cos(seed + i * 17)) * 80);
    const r = 40 + (Math.abs(Math.sin(seed + i * 23)) * 40);
    return `radial-gradient(in oklch circle at ${x.toFixed(1)}% ${y.toFixed(1)}%, ${s.color} 0%, transparent ${r.toFixed(1)}%)`;
  });
  return `${layers.join(', ')}, ${bg}`;
}

function injectAnchorStops(stops: Stop[], pool: ColorData[]): Stop[] {
  if (stops.length < 2) return stops;
  const result: Stop[] = [];
  for (let i = 0; i < stops.length; i++) {
    result.push(stops[i]);
    if (i < stops.length - 1) {
      const current = stops[i];
      const next = stops[i+1];

      // Only inject if there is space
      if (next.pos - current.pos < 2) continue;

      const c1 = pool.find(c => c.hex.toLowerCase() === current.color.toLowerCase());
      const c2 = pool.find(c => c.hex.toLowerCase() === next.color.toLowerCase());
      if (c1 && c2 && c1.h !== undefined && c2.h !== undefined) {
        const h1 = c1.h;
        const h2 = c2.h;
        const hDiff = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));
        if (hDiff > 90) {
          const bridgePoints = hDiff > 180 ? [0.33, 0.66] : [0.5];

          bridgePoints.forEach(ratio => {
            const targetH = (h1 + (h2 > h1 ? hDiff * ratio : -hDiff * ratio) + 360) % 360;
            const targetW = (c1.weight ?? 500) + ((c2.weight ?? 500) - (c1.weight ?? 500)) * ratio;

            const bridge = pool.reduce((prev, curr) => {
               if (curr.h === undefined) return prev;
               const d1 = getScore(prev, targetH, targetW);
               const d2 = getScore(curr, targetH, targetW);
               return d2 < d1 ? curr : prev;
            });

            if (bridge && bridge.hex !== c1.hex && bridge.hex !== c2.hex) {
              result.push({ color: bridge.hex, pos: current.pos + (next.pos - current.pos) * ratio });
            }
          });
        }
      }
    }
  }
  return result;
}

function getScore(c: ColorData, targetH: number, targetW: number): number {
  if (c.h === undefined) return Infinity;
  const hDiff = Math.min(Math.abs(c.h - targetH), 360 - Math.abs(c.h - targetH));
  const wDiff = Math.abs(c.weight - targetW) / 1000 * 360;
  return hDiff + wDiff;
}
