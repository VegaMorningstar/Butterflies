/**
 * Field building for the course figures, mirroring buildGrid in App.tsx.
 *
 * Shared by both demo files so the placement arithmetic has one definition.
 */

import { BASE_SZ, LAYERS } from '../butterfly';
import { seeded } from './kit';

export interface Bug {
  x: number;
  y: number;
  tilt: number;
  sz: number;
  layer: number;
  ph: number;
  hover: number;
  throw_: number;
  band: number;
  fStart: number;
  spread: number;
  rise: number;
  sway: number;
}

export type Placement = 'scatter' | 'grid' | 'stagger' | 'jitter';

export const ROW_RATIO = 0.62;
export const JITTER = 0.62;
export const TILT = 0.46;

export function makeBug(x: number, y: number, layer: number, rnd: () => number): Bug {
  return {
    x,
    y,
    layer,
    tilt: (rnd() - 0.5) * TILT,
    sz: BASE_SZ * LAYERS[layer].sz * (0.9 + rnd() * 0.2),
    ph: rnd() * Math.PI * 2,
    hover: 0,
    throw_: 0.6 + rnd() * 0.8,
    band: 0,
    fStart: Infinity, // nothing has been released yet, so nothing is in flight
    spread: 0,
    rise: 1 + (rnd() - 0.5) * 0.3,
    sway: rnd() * Math.PI * 2,
  };
}

/**
 * The four ways of covering a plane that chapter 05 compares. Same count, same
 * art, only the placement rule changes.
 */
export function buildField(
  w: number,
  h: number,
  mode: Placement,
  layers: number[],
  seed = 7,
): Bug[] {
  const rnd = seeded(seed);
  const out: Bug[] = [];

  for (const L of layers) {
    const gs = LAYERS[L].gs;
    const cols = Math.max(3, Math.round(w / gs));
    const rows = Math.max(3, Math.round(h / (gs * ROW_RATIO)));
    const stepX = w / cols;
    const stepY = h / rows;

    if (mode === 'scatter') {
      // Same head count, dropped at random. Clumps and holes are the point.
      const n = (cols + 2) * (rows + 2);
      for (let i = 0; i < n; i++) out.push(makeBug(rnd() * w, rnd() * h, L, rnd));
      continue;
    }

    for (let r = rows; r >= -1; r--) {
      let phase = 0;
      if (mode === 'stagger') phase = r % 2 === 0 ? stepX * 0.5 : 0;
      if (mode === 'jitter') phase = (rnd() - 0.5) * stepX;

      for (let c = cols; c >= -1; c--) {
        const jx = mode === 'jitter' ? (rnd() - 0.5) * stepX * JITTER : 0;
        const jy = mode === 'jitter' ? (rnd() - 0.5) * stepY * JITTER : 0;
        out.push(makeBug((c + 0.5) * stepX + phase + jx, (r + 0.5) * stepY + jy, L, rnd));
      }
    }
  }
  return out;
}

export function idleFold(ph: number, amp = 0.07) {
  return amp * (1 - Math.cos(ph)) * 0.5;
}

/** The head count buildGrid would produce for a given viewport, per layer. */
export function fieldCount(w: number, h: number): number[] {
  return LAYERS.map(L => {
    const cols = Math.max(3, Math.round(w / L.gs));
    const rows = Math.max(3, Math.round(h / (L.gs * ROW_RATIO)));
    return (cols + 2) * (rows + 2);
  });
}
