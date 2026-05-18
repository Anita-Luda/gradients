import type { ColorData } from './colors';
import { groupHues } from './colors';

export type Geometry = 'linear' | 'radial' | 'conic' | 'mesh';

export interface GradientOptions {
  preset: string;
  mood: number; // 0-1000
  contrast: number; // 0-100
  density: number; // 0-100
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
      stops = getAtmosphericStops(colors, [100, 200, 300, 400], options);
      break;
    case 'sunset':
      stops = getAtmosphericStops(colors, [200, 400, 600, 800], options);
      break;
    case 'reflex':
      stops = getAtmosphericStops(colors, [50, 800, 950], options);
      break;
    case 'aurora':
      stops = getAtmosphericStops(colors, [900, 350, 450, 950], options, [0, 65, 75, 100]);
      break;
    case 'galaxy':
      stops = getAtmosphericStops(colors, [950, 300, 950], options);
      break;
    case 'magma':
      stops = getAtmosphericStops(colors, [800, 150, 900], options);
      break;
    case 'cyberpunk':
      stops = getAtmosphericStops(colors, [900, 200], options);
      break;
    default:
      stops = colors.map((c, i) => ({ color: c.hex, pos: (i / (colors.length - 1 || 1)) * 100 }));
  }

  if (options.inverted) {
    stops = stops.map(s => ({ ...s, color: invertColor(s.color, colors) }));
  }

  if (options.mirrored) {
    const mirroredStops = [...stops].reverse().map(s => ({ ...s, pos: 100 + (100 - s.pos) }));
    stops = [...stops.map(s => ({ ...s, pos: s.pos / 2 })), ...mirroredStops.map(s => ({ ...s, pos: s.pos / 2 }))];
  }

  // Handle Mesh separately
  if (options.geometry === 'mesh') {
    return generateMesh(stops);
  }

  // Intelligent Anchor Stops (Anti-Mud Rule)
  // Cyberpunk uses hard stops, so we don't inject anchors there to keep it sharp
  const finalStops = options.preset === 'cyberpunk' ? stops : injectAnchorStops(stops, colors);

  let stopStr = '';
  if (options.preset === 'cyberpunk') {
    stopStr = finalStops.map((s, i) => {
      const next = finalStops[i+1];
      if (next) return `${s.color} ${s.pos}%, ${next.color} ${s.pos}%`;
      return `${s.color} ${s.pos}%`;
    }).join(', ');
  } else {
    stopStr = finalStops.map(s => `${s.color} ${s.pos}%`).join(', ');
  }

  const method = 'in oklch ';

  if (options.geometry === 'radial') {
    return `radial-gradient(${method}circle at center, ${stopStr})`;
  } else if (options.geometry === 'conic') {
    return `conic-gradient(${method}from ${options.angle}deg, ${stopStr})`;
  } else {
    return `linear-gradient(${method}${options.angle}deg, ${stopStr})`;
  }
}

function getAtmosphericStops(
  pool: ColorData[],
  targetWeights: number[],
  options: GradientOptions,
  customPos?: number[]
): Stop[] {
  const hueGroupsMap = groupHues(pool);
  const hueGroups = Array.from(hueGroupsMap.values());

  // Apply Mood shift
  const shiftedWeights = targetWeights.map(w => {
    const shift = (options.mood - 500);
    return Math.max(0, Math.min(1000, w + shift));
  });

  // Apply Contrast/Dynamics (scaling around the mean)
  const mean = shiftedWeights.reduce((a, b) => a + b, 0) / (shiftedWeights.length || 1);
  const contrastFactor = options.contrast / 100;
  const contrastedWeights = shiftedWeights.map(w => {
    const newVal = mean + (w - mean) * contrastFactor;
    return Math.max(0, Math.min(1000, newVal));
  });

  return contrastedWeights.map((tw, i) => {
    // Shuffle logic: Use hueSeed to pick a different hue group
    let activePool = pool;
    if (hueGroups.length > 0) {
      const groupIdx = (i + options.hueSeed) % hueGroups.length;
      activePool = hueGroups[groupIdx];
    }

    // Fallback logic: Find closest color in activePool
    const colorHex = findClosestColorWithFallback(activePool, tw);

    let pos = customPos ? customPos[i] : (i / (contrastedWeights.length - 1)) * 100;

    // Apply Density (non-linear warping)
    if (!customPos) {
      const p = pos / 100;
      const factor = (options.density - 50) / 50; // -1 to 1
      const warpedP = factor > 0
        ? Math.pow(p, 1 + factor * 2)
        : 1 - Math.pow(1 - p, 1 + Math.abs(factor) * 2);
      pos = warpedP * 100;
    }

    return { color: colorHex, pos };
  });
}

function findClosestColorWithFallback(pool: ColorData[], weight: number): string {
  const closest = pool.reduce((prev, curr) => {
    return Math.abs(curr.weight - weight) < Math.abs(prev.weight - weight) ? curr : prev;
  });

  // Extreme fallback to preserve light physics
  if (weight <= 100 && closest.weight > 300) return '#ffffff';
  if (weight >= 900 && closest.weight < 700) return '#000000';

  return closest.hex;
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

function generateMesh(stops: Stop[]): string {
  const layers = stops.map((s, i) => {
    const x = 20 + (i * 30) % 60;
    const y = 20 + Math.floor(i / 2) * 40 % 60;
    return `radial-gradient(in oklch circle at ${x}% ${y}%, ${s.color} 0%, transparent 60%)`;
  });
  return layers.join(', ');
}

function injectAnchorStops(stops: Stop[], pool: ColorData[]): Stop[] {
  if (stops.length < 2) return stops;
  const result: Stop[] = [];
  for (let i = 0; i < stops.length; i++) {
    result.push(stops[i]);
    if (i < stops.length - 1) {
      const current = stops[i];
      const next = stops[i+1];
      const c1 = pool.find(c => c.hex.toLowerCase() === current.color.toLowerCase());
      const c2 = pool.find(c => c.hex.toLowerCase() === next.color.toLowerCase());
      if (c1 && c2 && c1.h !== undefined && c2.h !== undefined) {
        const hDiff = Math.min(Math.abs(c1.h - c2.h), 360 - Math.abs(c1.h - c2.h));
        if (hDiff > 100) {
          const targetH = (c1.h + (c2.h > c1.h ? hDiff / 2 : -hDiff / 2) + 360) % 360;
          const targetW = (c1.weight + c2.weight) / 2;
          const intermediate = pool.reduce((prev, curr) => {
             if (curr.h === undefined) return prev;
             const d1 = getScore(prev, targetH, targetW);
             const d2 = getScore(curr, targetH, targetW);
             return d2 < d1 ? curr : prev;
          });
          if (intermediate && intermediate.hex !== c1.hex && intermediate.hex !== c2.hex) {
            result.push({ color: intermediate.hex, pos: (current.pos + next.pos) / 2 });
          }
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
