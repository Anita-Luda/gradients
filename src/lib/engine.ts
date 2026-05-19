import type { ColorData } from './colors';
import { groupHues } from './colors';

export type Geometry = 'linear' | 'radial' | 'conic' | 'mesh';

export interface GradientOptions {
  preset: string;
  mood: number; // 0-1000
  contrast: number; // 0-100
  density: number; // 0-100
  hueLimit: number; // 1-10
  tonalLimit: number; // 2-32
  geometry: Geometry;
  angle: number;
  inverted: boolean;
  mirrored: boolean;
  hueSeed: number;
  grain: number; // 0-100
  softness: number; // 0-100
  customSort: 'original' | 'lightness' | 'hue';
}

export const PRESET_DEFAULTS: Record<string, Partial<GradientOptions>> = {
  hologram: { mood: 500, contrast: 60, density: 40, softness: 80, hueLimit: 8, tonalLimit: 8 },
  sunset: { mood: 500, contrast: 100, density: 50, softness: 50, hueLimit: 5, tonalLimit: 5 },
  reflex: { mood: 400, contrast: 100, density: 70, softness: 30, geometry: 'radial', tonalLimit: 6 },
  ripples: { mood: 500, contrast: 100, density: 60, softness: 20, geometry: 'radial', tonalLimit: 8 },
  aurora: { mood: 600, contrast: 100, density: 80, softness: 90, hueLimit: 3, tonalLimit: 7 },
  galaxy: { mood: 700, contrast: 100, density: 90, softness: 95, hueLimit: 4, tonalLimit: 6 },
  magma: { mood: 800, contrast: 100, density: 40, softness: 40, hueLimit: 2, tonalLimit: 6 },
  cyberpunk: { mood: 500, contrast: 100, density: 50, softness: 10, hueLimit: 2, tonalLimit: 6 },
  chrome: { mood: 500, contrast: 100, density: 50, softness: 5, angle: 180, tonalLimit: 6 },
  'liquid-metal': { mood: 500, contrast: 100, density: 50, softness: 40, tonalLimit: 6 },
  ethereal: { mood: 400, contrast: 30, density: 20, softness: 100, hueLimit: 10, tonalLimit: 5 },
  abyss: { mood: 900, contrast: 80, density: 60, softness: 70, tonalLimit: 6 },
  'light-top': { mood: 500, contrast: 100, density: 50, softness: 80, geometry: 'linear', angle: 180, tonalLimit: 3 },
  'light-side': { mood: 500, contrast: 100, density: 50, softness: 80, geometry: 'linear', angle: 90, tonalLimit: 3 },
  vignette: { mood: 500, contrast: 100, density: 50, softness: 90, geometry: 'radial', tonalLimit: 3 },
  'custom-sort': { mood: 500, contrast: 100, density: 50, softness: 50, tonalLimit: 12 },
  default: { mood: 500, contrast: 100, density: 50, softness: 50, tonalLimit: 12 }
};

interface Stop {
  color: string;
  pos: number; // 0-100
}

export function generateGradient(colors: ColorData[], options: GradientOptions): { css: string, usedColors: Set<string> } {
  if (colors.length === 0) return {
    css: 'linear-gradient(to right, #333, #333)',
    usedColors: new Set()
  };

  let stops: Stop[] = [];
  const usedColors = new Set<string>();

  // Determine effective color pool based on hueLimit BEFORE processing
  const hueGroupsMap = groupHues(colors);
  let allGroups = Array.from(hueGroupsMap.values()).sort((a, b) => (a[0].h ?? 0) - (b[0].h ?? 0));

  if (options.hueSeed > 0) {
    allGroups = seededShuffle(allGroups, options.hueSeed);
  }

  const activeGroups = allGroups.slice(0, Math.min(options.hueLimit, allGroups.length));
  const activePool = activeGroups.flat();

  // Mapping logic
  switch (options.preset) {
    case 'hologram':
      const hWeights = [250, 300, 200, 280, 250, 220, 300, 250].slice(0, options.tonalLimit);
      stops = getAtmosphericStops(activePool, activeGroups, hWeights, options, [0, 14, 28, 42, 56, 70, 84, 100].slice(0, options.tonalLimit), { min: 0, max: 450 });
      break;
    case 'sunset':
      stops = getAtmosphericStops(activePool, activeGroups, sampleWeights([200, 450, 650, 850], options.tonalLimit), options);
      break;
    case 'reflex':
      stops = getAtmosphericStops(activePool, activeGroups, [0, 50, 900, 900, 850], options, [0, 3, 6, 40, 100]);
      break;
    case 'ripples':
      stops = getAtmosphericStops(activePool, activeGroups, [900, 100, 850, 200, 800, 300, 750], options, [0, 15, 30, 45, 60, 80, 100]);
      break;
    case 'aurora':
      stops = getAtmosphericStops(activePool, activeGroups, [950, 950, 400, 300, 500, 1000, 1000], options, [0, 60, 68, 72, 78, 85, 100]);
      break;
    case 'galaxy':
      stops = getAtmosphericStops(activePool, activeGroups, [950, 950, 300, 400, 950, 950], options, [0, 65, 70, 75, 80, 100]);
      break;
    case 'magma':
      stops = getAtmosphericStops(activePool, activeGroups, [900, 700, 200, 800, 950], options);
      break;
    case 'cyberpunk':
      stops = getAtmosphericStops(activePool, activeGroups, [950, 950, 200, 200, 1000, 1000], options, [0, 46, 49, 51, 54, 100]);
      break;
    case 'chrome':
      stops = getAtmosphericStops(activePool, activeGroups, [1000, 900, 100, 50, 800, 400], options, [0, 48, 49.5, 50.5, 52, 100]);
      break;
    case 'liquid-metal':
      stops = getAtmosphericStops(activePool, activeGroups, [700, 850, 150, 900, 200, 400], options, [0, 49, 49.5, 50.5, 51, 100]);
      break;
    case 'ethereal':
      stops = getAtmosphericStops(activePool, activeGroups, [500, 520, 480, 510], options, [0, 10, 90, 100]);
      break;
    case 'abyss':
      stops = getAtmosphericStops(activePool, activeGroups, [950, 800, 900, 600, 1000], options);
      break;
    case 'light-top':
      stops = getAtmosphericStops(activePool, activeGroups, [100, 400, 900], options, [0, 50, 100]);
      break;
    case 'light-side':
      stops = getAtmosphericStops(activePool, activeGroups, [50, 700, 1000], options, [0, 20, 100]);
      break;
    case 'vignette':
      stops = getAtmosphericStops(activePool, activeGroups, [100, 300, 950], options, [0, 40, 100]);
      break;
    case 'custom-sort': {
      let sortedPool = [...activePool];
      if (options.customSort === 'lightness') sortedPool.sort((a, b) => a.weight - b.weight);
      else if (options.customSort === 'hue') sortedPool.sort((a, b) => (a.h ?? 0) - (b.h ?? 0));

      const limit = Math.min(options.tonalLimit, sortedPool.length);
      const sampled = sampleArray(sortedPool, limit);
      stops = sampled.map((c, i) => ({ color: c.hex, pos: (i / (sampled.length - 1)) * 100 }));
      break;
    }
    default: {
      const limit = Math.min(options.tonalLimit, activePool.length);
      const sampled = sampleArray(activePool, limit);
      stops = sampled.map((c, i) => ({ color: c.hex, pos: (i / (sampled.length - 1)) * 100 }));
      break;
    }
  }

  // Post-processing
  if (options.inverted) {
    stops = stops.map(s => ({ ...s, color: invertColor(s.color, activePool) }));
  }

  if (options.mirrored) {
    const mirroredStops = [...stops].reverse().map(s => ({ ...s, pos: 100 + (100 - s.pos) }));
    stops = [...stops.map(s => ({ ...s, pos: s.pos / 2 })), ...mirroredStops.map(s => ({ ...s, pos: s.pos / 2 }))];
  }

  let geometry = options.geometry;
  if (options.preset === 'ripples' || options.preset === 'reflex') geometry = 'radial';

  if (options.geometry === 'mesh') {
    const meshCss = generateMesh(stops, options);
    stops.forEach(s => usedColors.add(s.color.toLowerCase()));
    return { css: meshCss, usedColors };
  }

  // Anchor stops only from active pool
  const finalStops = injectAnchorStops(stops, activePool);
  finalStops.forEach(s => usedColors.add(s.color.toLowerCase()));

  const stopStr = finalStops.map((s, i) => {
    if (options.softness < 50 && (geometry === 'linear' || geometry === 'radial' || geometry === 'conic')) {
      const prev = finalStops[i - 1];
      const next = finalStops[i + 1];
      const factor = 1 - (options.softness / 50);

      let startPos = s.pos;
      let endPos = s.pos;
      if (prev) startPos = s.pos - ((s.pos - prev.pos) / 2) * factor;
      if (next) endPos = s.pos + ((next.pos - s.pos) / 2) * factor;

      return `${s.color} ${startPos.toFixed(2)}% ${endPos.toFixed(2)}%`;
    }
    return `${s.color} ${s.pos.toFixed(2)}%`;
  }).join(', ');

  const method = 'in oklch ';
  const grainOpacity = (options.grain / 100) * 0.25; // Boosted to 0.25 max for visibility
  const grainLayer = options.grain > 0 ? `, url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='${grainOpacity.toFixed(3)}'/%3E%3C/svg%3E")` : '';

  let baseGradient = '';
  if (geometry === 'radial') baseGradient = `radial-gradient(${method}circle at center, ${stopStr})`;
  else if (geometry === 'conic') baseGradient = `conic-gradient(${method}from ${options.angle}deg, ${stopStr})`;
  else baseGradient = `linear-gradient(${method}${options.angle}deg, ${stopStr})`;

  if (options.grain > 0) {
    // Grain on top using multiple backgrounds
    return {
      css: `linear-gradient(rgba(128,128,128,0.01), rgba(128,128,128,0.01))${grainLayer}, ${baseGradient}`,
      usedColors
    };
  }

  return { css: baseGradient, usedColors };
}

function sampleArray<T>(arr: T[], limit: number): T[] {
  if (arr.length <= limit) return arr;
  const step = (arr.length - 1) / (limit - 1);
  return Array.from({ length: limit }, (_, i) => arr[Math.round(i * step)]);
}

function sampleWeights(weights: number[], limit: number): number[] {
  return sampleArray(weights, limit);
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
  hueGroups: ColorData[][],
  targetWeights: number[],
  options: GradientOptions,
  customPos?: number[],
  weightFilter?: { min: number, max: number }
): Stop[] {
  let filteredPool = pool;
  if (weightFilter) {
    filteredPool = pool.filter(c => c.weight >= weightFilter.min && c.weight <= weightFilter.max);
    if (filteredPool.length === 0) {
      const mid = (weightFilter.min + weightFilter.max) / 2;
      filteredPool = [...pool].sort((a, b) => Math.abs(a.weight - mid) - Math.abs(b.weight - mid)).slice(0, 3);
    }
  }

  const mean = targetWeights.reduce((a, b) => a + b, 0) / (targetWeights.length || 1);
  const contrastFactor = options.contrast / 100;

  return targetWeights.map((tw, i) => {
    // Apply Mood & Contrast
    const shifted = Math.max(0, Math.min(1000, tw + (options.mood - 500)));
    const weight = Math.max(0, Math.min(1000, mean + (shifted - mean) * contrastFactor));

    let activePool = filteredPool;
    if (hueGroups.length > 0) {
      let groupIdx = i % hueGroups.length;
      if (options.hueSeed > 0) {
        const seed = options.hueSeed + i * 1.5;
        groupIdx = Math.floor(Math.abs(Math.sin(seed)) * hueGroups.length);
      }
      activePool = hueGroups[groupIdx];
    }

    const colorHex = findClosestColor(activePool, weight);
    let pos = customPos ? customPos[i] : (i / (targetWeights.length - 1)) * 100;
    return { color: colorHex, pos: applyDensity(pos, options.density) };
  });
}

function findClosestColor(pool: ColorData[], weight: number): string {
  if (pool.length === 0) return '#888';
  return pool.reduce((prev, curr) => Math.abs(curr.weight - weight) < Math.abs(prev.weight - weight) ? curr : prev).hex;
}

function applyDensity(pos: number, density: number): number {
  const p = pos / 100;
  const factor = (density - 50) / 50;
  let warpedP = p;
  if (factor > 0) {
    const s = 1 + factor * 5;
    warpedP = p < 0.5 ? 0.5 * Math.pow(p / 0.5, s) : 1 - 0.5 * Math.pow((1 - p) / 0.5, s);
  } else if (factor < 0) {
    const s = 1 + Math.abs(factor) * 5;
    warpedP = p < 0.5 ? 0.5 * (1 - Math.pow(1 - (p / 0.5), s)) : 0.5 + 0.5 * Math.pow((p - 0.5) / 0.5, s);
  }
  return warpedP * 100;
}

function invertColor(hex: string, pool: ColorData[]): string {
  const color = pool.find(c => c.hex.toLowerCase() === hex.toLowerCase());
  const targetWeight = 1000 - (color ? color.weight : 500);
  return findClosestColor(pool, targetWeight);
}

function generateMesh(stops: Stop[], options: GradientOptions): string {
  const seed = options.hueSeed;
  const shuffledStops = seededShuffle(stops, seed);
  const bg = shuffledStops[0]?.color || '#000';
  const softnessFactor = (options.softness / 50);

  const layers = shuffledStops.slice(1).map((s, i) => {
    const x = 10 + (Math.abs(Math.sin(seed + i * 13)) * 80);
    const y = 10 + (Math.abs(Math.cos(seed + i * 17)) * 80);
    const r = (30 + (Math.abs(Math.sin(seed + i * 23)) * 50)) * softnessFactor;
    const edge = options.softness < 20 ? '80%' : '100%';
    return `radial-gradient(in oklch circle at ${x.toFixed(1)}% ${y.toFixed(1)}%, ${s.color} 0%, transparent ${edge})`;
  });

  const grainOpacity = (options.grain / 100) * 0.25;
  const grainLayer = options.grain > 0 ? `linear-gradient(rgba(128,128,128,0.01), rgba(128,128,128,0.01)), url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='${grainOpacity.toFixed(3)}'/%3E%3C/svg%3E"), ` : '';

  return `${grainLayer}${layers.join(', ')}, ${bg}`;
}

function injectAnchorStops(stops: Stop[], pool: ColorData[]): Stop[] {
  if (stops.length < 2) return stops;
  const result: Stop[] = [];
  for (let i = 0; i < stops.length; i++) {
    result.push(stops[i]);
    if (i < stops.length - 1) {
      const c = stops[i], n = stops[i+1];
      if (n.pos - c.pos < 2) continue;

      const c1 = pool.find(x => x.hex.toLowerCase() === c.color.toLowerCase());
      const c2 = pool.find(x => x.hex.toLowerCase() === n.color.toLowerCase());
      if (c1 && c2 && c1.h !== undefined && c2.h !== undefined) {
        const hDiff = Math.min(Math.abs(c1.h - c2.h), 360 - Math.abs(c1.h - c2.h));
        if (hDiff > 90) {
          const ratio = 0.5;
          const targetH = (c1.h + (c2.h > c1.h ? hDiff * ratio : -hDiff * ratio) + 360) % 360;
          const targetW = c1.weight + (c2.weight - c1.weight) * ratio;
          const bridge = pool.reduce((p, curr) => getScore(curr, targetH, targetW) < getScore(p, targetH, targetW) ? curr : p);
          if (bridge && bridge.hex !== c1.hex && bridge.hex !== c2.hex) {
            result.push({ color: bridge.hex, pos: c.pos + (n.pos - c.pos) * ratio });
          }
        }
      }
    }
  }
  return result;
}

function getScore(c: ColorData, tH: number, tW: number): number {
  if (c.h === undefined) return Infinity;
  const hD = Math.min(Math.abs(c.h - tH), 360 - Math.abs(c.h - tH));
  return hD + Math.abs(c.weight - tW) / 1000 * 360;
}
