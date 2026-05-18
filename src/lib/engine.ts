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
      // W: [100, 150, 250, 350], cycle repeated
      stops = getAtmosphericStops(colors, [100, 150, 250, 350, 100, 150, 250, 350], options, [0, 15, 30, 45, 60, 75, 85, 100]);
      break;
    case 'sunset':
      // W: [200, 450, 650, 850]
      stops = getAtmosphericStops(colors, [200, 450, 650, 850], options);
      break;
    case 'reflex':
      // Matrix: P:0% (W:50), P:8% (W:900), P:30% (W:650), P:100% (W:800)
      stops = getAtmosphericStops(colors, [50, 900, 650, 800], options, [0, 8, 30, 100]);
      break;
    case 'aurora':
      // Matrix: P:0-60% (950), P:68% (400), P:72% (300), P:78% (500), P:85-100% (1000)
      stops = getAtmosphericStops(colors, [950, 950, 400, 300, 500, 1000, 1000], options, [0, 60, 68, 72, 78, 85, 100]);
      break;
    case 'galaxy':
      stops = getAtmosphericStops(colors, [950, 300, 400, 950], options);
      break;
    case 'magma':
      stops = getAtmosphericStops(colors, [900, 700, 200, 800, 950], options);
      break;
    case 'cyberpunk':
      // Hard stops at 46% and 54%
      stops = getAtmosphericStops(colors, [950, 200, 200, 1000], options, [0, 46, 54, 100]);
      break;
    case 'chrome':
      // Matrix: 0% (700), 20% (150), 40% (800), 60% (200), 80% (900), 100% (400)
      stops = getAtmosphericStops(colors, [700, 150, 800, 200, 900, 400], options, [0, 20, 40, 60, 80, 100]);
      break;
    case 'ethereal':
      // W: [150, 250, 350, 200]
      stops = getAtmosphericStops(colors, [150, 250, 350, 200], options);
      break;
    case 'abyss':
      // W: [950, 800, 900, 600, 1000]
      stops = getAtmosphericStops(colors, [950, 800, 900, 600, 1000], options);
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
  // Strict Pool Usage: Only use colors provided by the user.
  // We do not inject white or black unless they are in the pool.
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
        if (hDiff > 120) {
          // Find the best "bridge" color from the pool to prevent mud.
          // The bridge color should be as close as possible to the average hue and weight.
          const targetH = (c1.h + (c2.h > c1.h ? hDiff / 2 : -hDiff / 2) + 360) % 360;
          const targetW = (c1.weight + c2.weight) / 2;

          const bridge = pool.reduce((prev, curr) => {
             if (curr.h === undefined) return prev;
             const d1 = getScore(prev, targetH, targetW);
             const d2 = getScore(curr, targetH, targetW);
             return d2 < d1 ? curr : prev;
          });

          // Only inject if the bridge is actually different and helps reduce the hue jump
          if (bridge && bridge.hex !== c1.hex && bridge.hex !== c2.hex) {
             const dBridge1 = Math.min(Math.abs((bridge.h ?? 0) - c1.h), 360 - Math.abs((bridge.h ?? 0) - c1.h));
             const dBridge2 = Math.min(Math.abs((bridge.h ?? 0) - c2.h), 360 - Math.abs((bridge.h ?? 0) - c2.h));

             // Ensure the bridge is actually between the two hues
             if (dBridge1 < hDiff && dBridge2 < hDiff) {
               result.push({ color: bridge.hex, pos: (current.pos + next.pos) / 2 });
             }
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
