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
  grain: number; // 0-100
  softness: number; // 0-100
  customSort: 'original' | 'lightness' | 'hue';
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
    case 'custom-sort': {
      let sortedPool = [...colors];
      if (options.customSort === 'lightness') {
        sortedPool.sort((a, b) => a.weight - b.weight);
      } else if (options.customSort === 'hue') {
        sortedPool.sort((a, b) => (a.h ?? 0) - (b.h ?? 0));
      }
      const weights = sortedPool.map(c => c.weight);
      stops = getAtmosphericStops(sortedPool, weights, options, undefined, false, undefined, true);
      break;
    }
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
    return generateMesh(stops, options);
  }

  const finalStops = injectAnchorStops(stops, colors);

  const stopStr = finalStops.map((s, i) => {
    if (options.softness < 50 && (geometry === 'linear' || geometry === 'radial' || geometry === 'conic')) {
      // Create sharper steps if softness is low
      const diff = (50 - options.softness) / 100; // 0 to 0.5
      const p = s.pos;
      if (i > 0 && i < finalStops.length - 1) {
         // Sharp transition would require dual stops, but we can simulate it
         // by manipulating the OKLCH interpolation via micro-offsets
      }
    }
    return `${s.color} ${s.pos.toFixed(2)}%`;
  }).join(', ');

  const method = 'in oklch ';

  const grainLayer = options.grain > 0 ? `, url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.5'/%3E%3C/svg%3E")` : '';
  const grainOpacity = (options.grain / 100) * 0.12;

  let baseGradient = '';
  if (geometry === 'radial') {
    baseGradient = `radial-gradient(${method}circle at center, ${stopStr})`;
  } else if (geometry === 'conic') {
    baseGradient = `conic-gradient(${method}from ${options.angle}deg, ${stopStr})`;
  } else {
    baseGradient = `linear-gradient(${method}${options.angle}deg, ${stopStr})`;
  }

  if (options.grain > 0) {
    return `linear-gradient(rgba(0,0,0,${grainOpacity}), rgba(0,0,0,${grainOpacity}))${grainLayer}, ${baseGradient}`;
  }

  return baseGradient;
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
  weightFilter?: { min: number, max: number },
  directMapping: boolean = false
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

    if (directMapping) {
      // For custom-sort, we try to use the color at the same index if possible
      const colorHex = pool[i % pool.length].hex;
      let pos = customPos ? customPos[i] : (i / (contrastedWeights.length - 1)) * 100;
      return { color: colorHex, pos: applyDensity(pos, options.density) };
    }

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
    return { color: colorHex, pos: applyDensity(pos, options.density) };
  });
}

function applyDensity(pos: number, density: number): number {
  const p = pos / 100;
  const factor = (density - 50) / 50; // -1 to 1
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
  return warpedP * 100;
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

function generateMesh(stops: Stop[], options: GradientOptions): string {
  const seed = options.hueSeed;
  const shuffledStops = seededShuffle(stops, seed);
  const bg = shuffledStops[0]?.color || '#000';

  // Softness affects the radius and the sharpness of radial drops
  const softnessFactor = (options.softness / 50); // 0 to 2, 1 is default

  const layers = shuffledStops.slice(1).map((s, i) => {
    const x = 10 + (Math.abs(Math.sin(seed + i * 13)) * 80);
    const y = 10 + (Math.abs(Math.cos(seed + i * 17)) * 80);
    const r = (30 + (Math.abs(Math.sin(seed + i * 23)) * 50)) * softnessFactor;

    // Low softness = sharper edges (harder radial drop)
    const edge = options.softness < 20 ? '80%' : '100%';

    return `radial-gradient(in oklch circle at ${x.toFixed(1)}% ${y.toFixed(1)}%, ${s.color} 0%, transparent ${edge})`;
  });

  const baseMesh = `${layers.join(', ')}, ${bg}`;

  if (options.grain > 0) {
    const grainLayer = `, url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.5'/%3E%3C/svg%3E")`;
    const grainOpacity = (options.grain / 100) * 0.12;
    return `linear-gradient(rgba(0,0,0,${grainOpacity}), rgba(0,0,0,${grainOpacity}))${grainLayer}, ${baseMesh}`;
  }

  return baseMesh;
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
