/**
 * One or two butterflies drifting across the page while you read.
 *
 * Three rules keep this a pleasure rather than a nuisance:
 *   at most two at once, long quiet gaps between arrivals, and they fly
 *   underneath the text rather than over it, so nothing is ever obscured.
 *
 * They are tinted to the page ink instead of the white the field uses, because
 * white on parchment is almost invisible. The read is a specimen drifting
 * across a chart, not a sticker on top of one.
 *
 * Honours prefers-reduced-motion by rendering nothing at all. A document that
 * criticises itself for ignoring that preference cannot then add unprompted
 * decorative motion and skip it.
 */

import { useEffect, useRef } from 'react';

import { makeBody, makeWing, SS, type Layer, type Sprite } from '../butterfly';
import { scenesPaused } from '../scenePause';

// The quiet is measured from the moment the page empties, not from the last
// arrival. Timing it from the arrival means the next one turns up just as the
// last is leaving, and the page is never actually still, which is how a
// visitor becomes wallpaper.
const MAX_ALOFT = 2;
const QUIET = [16, 38]; // seconds of empty page before the next arrival
const COMPANION = 0.28; // chance an arrival brings a second one along
const COMPANION_IN = [3, 9]; // seconds behind the first
const SIZE = [0.19, 0.27]; // against BASE_SZ 0.4 on the loading screen
const SPEED = [34, 62]; // px per second, a drift rather than a commute
const ALPHA = [0.34, 0.5];

// Ink-toned sprites, baked once. dark is pushed far enough that the white
// plates read against the paper while the apex and the wing spot survive as
// tone rather than flattening into a silhouette.
const INK: Layer = { gs: 0, sz: 1, dark: 0.78, light: 0, shadow: false };
let inkSprites: { wing: Sprite; body: Sprite } | null = null;

function getInk() {
  if (!inkSprites) inkSprites = { wing: makeWing(INK), body: makeBody(INK) };
  return inkSprites;
}

interface Flyer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ph: number; // wing phase
  flap: number; // rad/s
  size: number;
  rot: number;
  wander: number; // phase offset, so two on screen never share a path
  wanderAmp: number;
  bob: number; // vertical travel per wingbeat
  age: number;
  life: number;
  alpha: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function spawn(w: number, h: number): Flyer {
  const speed = rand(SPEED[0], SPEED[1]);
  const fromLeft = Math.random() < 0.5;
  const margin = 80;

  // Mostly crossings, occasionally a climb or a descent, so the traffic does
  // not settle into one direction.
  const vertical = Math.random() < 0.22;
  let x: number;
  let y: number;
  let vx: number;
  let vy: number;

  if (vertical) {
    const fromTop = Math.random() < 0.5;
    x = rand(w * 0.15, w * 0.85);
    y = fromTop ? -margin : h + margin;
    vy = (fromTop ? 1 : -1) * speed * 0.75;
    vx = rand(-speed * 0.5, speed * 0.5);
  } else {
    x = fromLeft ? -margin : w + margin;
    y = rand(h * 0.12, h * 0.88);
    vx = (fromLeft ? 1 : -1) * speed;
    vy = rand(-speed * 0.28, speed * 0.28);
  }

  return {
    x,
    y,
    vx,
    vy,
    ph: Math.random() * Math.PI * 2,
    flap: rand(8.5, 13),
    size: rand(SIZE[0], SIZE[1]),
    rot: Math.atan2(vy, vx) + Math.PI / 2,
    wander: Math.random() * Math.PI * 2,
    wanderAmp: rand(14, 34),
    bob: rand(1.6, 3.4),
    age: 0,
    life: rand(24, 38), // a backstop; most leave by crossing an edge first
    alpha: rand(ALPHA[0], ALPHA[1]),
  };
}

export function AmbientButterflies() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (reduced?.matches) return;

    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const sprites = getInk();

    let raf = 0;
    let w = 1;
    let h = 1;
    let d = 1;
    let last = performance.now() / 1000;
    const t0 = last;
    // null means "nothing scheduled": the next arrival is booked once the page
    // is empty again.
    let nextAt: number | null = last + rand(3, 8);
    const aloft: Flyer[] = [];

    const size = () => {
      d = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * d);
      canvas.height = Math.round(h * d);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    size();
    window.addEventListener('resize', size);

    const frame = () => {
      raf = requestAnimationFrame(frame);

      const now = performance.now() / 1000;
      const dt = Math.min(now - last, 0.05);
      last = now;

      // Nothing to do behind the loading field, or in a hidden tab.
      if (scenesPaused() || document.hidden) return;

      if (nextAt === null && aloft.length === 0) {
        nextAt = now + rand(QUIET[0], QUIET[1]);
      }
      if (nextAt !== null && now >= nextAt && aloft.length < MAX_ALOFT) {
        aloft.push(spawn(w, h));
        // Either send a companion in behind this one, or book nothing and wait
        // for the page to clear.
        nextAt =
          aloft.length === 1 && Math.random() < COMPANION
            ? now + rand(COMPANION_IN[0], COMPANION_IN[1])
            : null;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w * d, h * d);

      const t = now - t0;

      for (let i = aloft.length - 1; i >= 0; i--) {
        const f = aloft[i];
        f.age += dt;
        f.ph += dt * f.flap;

        // A slow perpendicular drift, so the path curves instead of ruling a
        // straight line across the page.
        const drift = Math.sin(t * 0.55 + f.wander) * f.wanderAmp;
        const nx = -f.vy;
        const ny = f.vx;
        const len = Math.hypot(nx, ny) || 1;

        f.x += (f.vx + (nx / len) * drift) * dt;
        f.y += (f.vy + (ny / len) * drift) * dt;

        const off =
          f.x < -160 || f.x > w + 160 || f.y < -160 || f.y > h + 160;
        if (off || f.age > f.life) {
          aloft.splice(i, 1);
          continue;
        }

        const fadeIn = Math.min(1, f.age / 3);
        const fadeOut = Math.min(1, (f.life - f.age) / 3);
        const alpha = Math.max(0, Math.min(fadeIn, fadeOut)) * f.alpha;
        if (alpha < 0.01) continue;

        // The wingbeat carries the body up and down with it, which is most of
        // what makes a real cabbage white recognisable at a distance.
        const fold = 0.72 * (1 - Math.cos(f.ph)) * 0.5;
        const bob = Math.sin(f.ph) * f.bob;

        const heading = Math.atan2(f.vy + (ny / len) * drift, f.vx + (nx / len) * drift) + Math.PI / 2;
        let delta = heading - f.rot;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        f.rot += delta * Math.min(1, dt * 2.2);

        const sx = (1 - fold * 0.93) * f.size;
        const sy = (1 + fold * 0.12) * f.size;
        const lift = -fold * SS * 0.05 * f.size;
        const co = Math.cos(f.rot);
        const si = Math.sin(f.rot);
        const px = f.x;
        const py = f.y + bob;
        const lx = -si * lift;
        const ly = co * lift;

        ctx.globalAlpha = alpha * (1 - fold * 0.16);
        ctx.setTransform(co * sx * d, si * sx * d, -si * sy * d, co * sy * d, (px + lx) * d, (py + ly) * d);
        ctx.drawImage(sprites.wing.c, sprites.wing.ox, sprites.wing.oy);

        ctx.globalAlpha = alpha;
        const bs = f.size * d;
        ctx.setTransform(co * bs, si * bs, -si * bs, co * bs, px * d, py * d);
        ctx.drawImage(sprites.body.c, sprites.body.ox, sprites.body.oy);
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
