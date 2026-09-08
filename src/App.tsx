/**
 * Interactive loading screen — a field of white butterflies that scatters on
 * click to reveal the page underneath.
 *
 * OVERVIEW
 *
 * Everything is drawn to a single full-screen 2D canvas. There is no DOM per
 * butterfly: at ~2,500 of them that would be hopeless, so each frame clears the
 * canvas and re-blits a handful of pre-rendered sprites. All the art is baked
 * once at startup into small offscreen canvases; the render loop only ever
 * translates, rotates, scales and draws those.
 *
 * THE FIELD
 *
 * Three interleaved layers (LAYERS, back to front). Each is its own jittered
 * grid: the grid guarantees even coverage, then every butterfly wanders up to
 * half a cell off its mark so the result reads as organic rather than stamped.
 * Three offset fields fill each other's gaps, which is what lets the screen read
 * as near-solid white at rest. Depth is carried by tone — the back layer sits in
 * shade, the front catches a raked highlight — and only the front layer casts a
 * drop shadow on the layers behind it.
 *
 * Rows get a random horizontal phase rather than a fixed half-step stagger. A
 * fixed stagger builds a triangular lattice, and a triangular lattice reads as
 * diagonal lines running through the whole field.
 *
 * THE BUTTERFLY
 *
 * Wings and body are separate sprites so the wings can fold while the body
 * stays put — that hinge is what makes a flap read as a flap. The wing sprite is
 * symmetric about the body axis, so squeezing the whole sprite horizontally is
 * identical to folding two halves inward, at one drawImage instead of two.
 *
 * INTERACTION
 *
 *   idle    slow shallow breathing of the wings
 *   hover   the cursor startles a butterfly: wings snap shut, HOLD there for a
 *           beat (the pause is what makes the dark underside register), then
 *           beat fast. Backing away re-arms it.
 *   click   release — see the two-phase comment above the timing constants.
 *
 * PERFORMANCE
 *
 * Fill rate and draw-call count both matter at this density. The measures that
 * paid off, in order: cropping every sprite canvas to its true bounds; the
 * symmetric wing sprite above; restricting shadows to the front layer; and
 * capping the device pixel ratio at 1.5, since at this density the extra buffer
 * resolution buys almost nothing. Tuning knobs are grouped at the top of the
 * file — LAYERS[].gs and ROW_RATIO are the two that move the butterfly count,
 * and therefore the frame cost, the most.
 */

import { useEffect, useRef, useState } from 'react';

// ─── tuning ───────────────────────────────────────────────────────────────────
const SS = 150; // sprite canvas size (px) — source resolution, not display size
const ROW_RATIO = 0.62; // butterflies are far wider than tall; rows need the room
const JITTER = 0.62; // grid cell fraction each butterfly may wander — organic, still even
const TILT = 0.46; // total spread of random rotation (±0.23 rad ≈ ±13°)
const BASE_SZ = 0.4; // sprite → screen scale (≈55px wingspan)

// Three interleaved fields, back to front. Each is its own jittered grid, so
// they close each other's gaps and the screen reads as near-solid white at
// rest — the dark ground only opens up where the cursor folds the wings shut.
// Depth comes from tone: the back layer sits in shade, the front catches light.
// The shading stays gentle on purpose. Push it far and a back-layer butterfly
// goes as dark as the ground, reads as background, and the coverage is wasted.
interface Layer {
  gs: number; // column spacing for this field
  sz: number; // size multiplier — nearer reads bigger
  dark: number; // shade laid over the sprite
  light: number; // highlight raked across it from the upper left
  shadow: boolean; // whether it drops a shadow on the layers behind
}
const LAYERS: Layer[] = [
  { gs: 46, sz: 0.92, dark: 0.26, light: 0, shadow: false },
  { gs: 50, sz: 1.0, dark: 0.11, light: 0.05, shadow: false },
  { gs: 56, sz: 1.09, dark: 0, light: 0.18, shadow: true },
];

const HOVER_R = 235; // cursor influence radius (px) — wide, so the fold opens a real hole in a field this dense
const RISE = 0.17; // how fast a butterfly wakes up
const FALL = 0.045; // how slowly it settles — the flutter trails the cursor

const IDLE_AMP = 0.07; // resting breath of the wings
const MAX_AMP = 0.88; // full flap
const IDLE_SPEED = 1.4; // rad/s at rest
const FAST_SPEED = 27; // rad/s under the cursor

// On being touched by the cursor a butterfly snaps its wings shut and holds them
// there before it starts beating — the pause is what makes the dark underside
// register at all. Below WAKE it re-arms, so backing off and returning repeats it.
const WAKE = 0.5; // hover level that triggers the snap
const SLEEP = 0.12; // hover level that re-arms it
const SHUT = 0.3; // per-frame approach to the closed position
const HOLD = 0.42; // seconds held shut before the beating starts

const FD = 1.65; // flight duration (s)
// Distance from the click is quantised into rings of a fixed width, rather than
// a fraction of the screen, so the wave steps out one butterfly at a time: the
// one under the cursor, then the handful touching it, then the next shell out.
// A centre click makes ~16 rings, a corner click ~33, so a long throw honestly
// takes longer to cross.
//
// The release runs in two phases, because two different things are happening.
//
// Phase 1, the poke: a fingertip lands on one butterfly. That is contact, so it
// travels straight DOWN the stack at that spot — front layer, then the one under
// it, then the one under that — and it stays inside CONTACT_BANDS.
//
// Phase 2, the alarm: nothing further out has been touched. Panic spreads
// sideways from neighbour to neighbour, and a butterfly does not care which
// layer its alarmed neighbour is in. So it becomes one front rolling outward
// with all three layers close together inside it.
//
// The two phases are separated by a real gap. What stops that reading as a
// stall is that everything still on the canvas is already beating its wings —
// see ALARM_LEAD below.
const BAND_PX = 52; // ring thickness in px — roughly one wingspan
const CONTACT_BANDS = 1; // fingertip: only the band under the cursor is touched
const POKE_STEP = 0.6; // s between layers during the poke — long on purpose for now
const PHASE_GAP = 0.25; // s between the poke finishing and the outward wave starting
const ROLL_LAYER_STEP = 0.09; // s between layers inside one band of the outward wave
const DIST_STEP = 0.045; // s from one ring to the next, once up to speed
const SLOW_STEP = 0.2; // s between the opening rings
const SLOW_RINGS = 5; // rings over which the pace eases from SLOW_STEP to DIST_STEP
const BAND_JITTER = 0.03; // s of scatter within a ring, so it does not pop as one unit

// Stragglers. A ring leaving as one clean block reads as machinery, so some
// butterflies hesitate and go late. This is weighted by distance on purpose:
// close to the click the alarm is contact and everything goes at once, but
// further out it is second-hand panic, and second-hand panic is uneven. Hence
// the ramp — hesitation is rare in the first rings and common by LAG_RAMP.
//
// The lag is squared, so most hesitations are brief and only a few butterflies
// hang back noticeably. A flat random would smear the whole ring instead of
// leaving a crisp front with a few laggards behind it.
const LAG_CHANCE = 0.3; // peak fraction of a ring that hesitates
const LAG_MAX = 0.2; // s of hesitation at most, before WAVE_SCALE
const LAG_RAMP = 6; // rings over which hesitation reaches full strength

// TESTING KNOB — stretches phase 2 only, so the outward wave can be watched
// ring by ring. Phase 1 is left alone: the poke already has its own cadence dial
// in POKE_STEP, and scaling it as well was just doing the same job twice.
//
// It multiplies only the outward progression, not the moment phase 2 begins, so
// the wave still starts the instant the poke finishes rather than leaving a dead
// gap. The flight itself (FD) is not scaled either — each butterfly leaves at
// normal speed and it is the spacing between launches that opens up.
//
// 1 = shipping speed.
const WAVE_SCALE = 3;

const STARTLE_AMP = 0.4; // the whole swarm stirs the moment the click lands
const ALARM_AMP = 0.92; // and beats hard once its own departure is imminent
const ALARM_LEAD = 0.6; // s of hard beating before this one actually leaves
const FLY_UP = 2600; // px risen over the full flight
const FLY_OUT = 620; // px of lateral spread

// ─── model ────────────────────────────────────────────────────────────────────
interface B {
  x: number;
  y: number;
  tilt: number; // random rotation, keeps the field from feeling stamped
  sz: number;
  ph: number; // wing phase
  hover: number; // 0..1 flap amplitude driver
  spread: number; // lateral direction on release
  sway: number; // per-butterfly sway offset
  layer: number; // 0 back .. 2 front; picks the sprite and the draw order
  throw_: number; // how far this one's shadow reaches — reads as height off the field
  band: number; // which ring out from the click it fell in, 0 = under the cursor
  mode: 0 | 1 | 2; // 0 resting, 1 holding shut, 2 beating
  hold: number; // seconds left in the hold
  shut: number; // 0..1 approach to the closed position
  fStart: number;
}

// ─── sprites ──────────────────────────────────────────────────────────────────
// Paths are authored in a 150px "sprite space" centred on the butterfly, but
// each sprite renders into a canvas cropped to its real bounds — at this density
// the transparent margin would otherwise dominate the per-frame fill cost.
interface Sprite {
  c: HTMLCanvasElement;
  ox: number; // offset from the butterfly centre to the canvas top-left
  oy: number;
}

const WING_BOX = { x: 3, y: 36, w: 144, h: 91 };
const BODY_BOX = { x: 62, y: 24, w: 26, h: 90 }; // y must clear the antennae at 27

// Light comes from the upper left, so shadows fall down and to the right. The
// field is drawn bottom row up and right to left, which puts every neighbour a
// shadow lands on already on the canvas.
const SHADOW_BOX = { x: 0, y: 24, w: 150, h: 116 };
const SHADOW_DX = 11; // the drop shadow the front layer casts on the ones behind
const SHADOW_DY = 15;
const SHADOW_BLUR = 9;
const SHADOW_ALPHA = 0.5;

function cropped(box: { x: number; y: number; w: number; h: number }) {
  const c = document.createElement('canvas');
  c.width = box.w;
  c.height = box.h;
  const ctx = c.getContext('2d')!;
  ctx.translate(-box.x, -box.y); // draw in sprite space, land inside the crop
  return { c, ctx };
}

const cx = SS / 2;
const cy = SS * 0.5;
const wr = SS * 0.43; // half wingspan
const wh = SS * 0.4; // vertical extent

// The right-hand wing pair, mirrored at draw time.
// Cabbage White: white plates, a charcoal apex corner, one dark spot per forewing.
function wingPaths() {
  // hindwing — broad and tucked under; its inner edge hugs the axis
  const hw = new Path2D();
  hw.moveTo(cx, cy - wh * 0.1);
  hw.bezierCurveTo(cx + wr * 0.34, cy + wh * 0.04, cx + wr * 0.7, cy + wh * 0.22, cx + wr * 0.72, cy + wh * 0.46);
  hw.bezierCurveTo(cx + wr * 0.74, cy + wh * 0.68, cx + wr * 0.5, cy + wh * 0.82, cx + wr * 0.22, cy + wh * 0.8);
  hw.bezierCurveTo(cx + wr * 0.1, cy + wh * 0.79, cx + wr * 0.02, cy + wh * 0.62, cx, cy + wh * 0.26);
  hw.closePath();

  // forewing — rounded triangle: gentle leading edge to the apex, then a
  // near-vertical outer margin so it stays wide at the tornus instead of pinching
  const fw = new Path2D();
  fw.moveTo(cx, cy - wh * 0.5);
  fw.bezierCurveTo(cx + wr * 0.36, cy - wh * 0.56, cx + wr * 0.74, cy - wh * 0.6, cx + wr * 1.02, cy - wh * 0.52);
  fw.bezierCurveTo(cx + wr * 1.09, cy - wh * 0.3, cx + wr * 1.0, cy - wh * 0.04, cx + wr * 0.84, cy + wh * 0.14);
  fw.bezierCurveTo(cx + wr * 0.56, cy + wh * 0.22, cx + wr * 0.24, cy + wh * 0.14, cx, cy - wh * 0.02);
  fw.closePath();

  return { fw, hw };
}

// Flat black silhouette of the whole butterfly. It has to cover both wings:
// the shadow is offset horizontally, and a mirrored half-sprite would flip that
// offset along with it.
function makeSilhouette(): HTMLCanvasElement {
  const half = document.createElement('canvas');
  half.width = SS;
  half.height = SS;
  const hctx = half.getContext('2d')!;
  const { fw, hw } = wingPaths();
  hctx.fillStyle = '#000';
  hctx.fill(hw);
  hctx.fill(fw);

  const c = document.createElement('canvas');
  c.width = SS;
  c.height = SS;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(half, 0, 0);
  ctx.translate(SS, 0); // mirror about cx, which sits at SS / 2
  ctx.scale(-1, 1);
  ctx.drawImage(half, 0, 0);
  return c;
}

function makeShadow(sil: HTMLCanvasElement, blur: number): Sprite {
  const { c, ctx } = cropped(SHADOW_BOX);
  ctx.filter = 'blur(' + blur + 'px)';
  ctx.drawImage(sil, 0, 0);
  return { c, ox: SHADOW_BOX.x - SS / 2, oy: SHADOW_BOX.y - SS / 2 };
}

// Shade or rake light across what has already been drawn. source-atop keeps it
// inside the wing silhouette, so the tint never leaks onto the ground.
function tint(ctx: CanvasRenderingContext2D, cfg: Layer) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  if (cfg.dark > 0) {
    ctx.fillStyle = 'rgba(15, 20, 27, ' + cfg.dark + ')';
    ctx.fillRect(0, 0, SS, SS);
  }
  if (cfg.light > 0) {
    const g = ctx.createLinearGradient(cx - SS * 0.3, cy - SS * 0.3, cx + SS * 0.34, cy + SS * 0.3);
    g.addColorStop(0, 'rgba(255, 255, 255, ' + cfg.light + ')');
    g.addColorStop(0.55, 'rgba(255, 255, 255, ' + cfg.light * 0.3 + ')');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SS, SS);
  }
  ctx.restore();
}

function makeWing(cfg: Layer): Sprite {
  const half = document.createElement('canvas');
  half.width = SS;
  half.height = SS;
  const ctx = half.getContext('2d')!;
  const { fw, hw } = wingPaths();

  // ── hindwing ───────────────────────────────────────────────────────────────
  const hg = ctx.createRadialGradient(cx, cy + wh * 0.06, SS * 0.008, cx, cy + wh * 0.06, wr * 0.72);
  hg.addColorStop(0.0, '#dee3e7');
  hg.addColorStop(0.2, '#f4f7f9');
  hg.addColorStop(0.45, '#ffffff');
  hg.addColorStop(1.0, '#ffffff');
  ctx.fillStyle = hg;
  ctx.fill(hw);

  ctx.save();
  ctx.clip(hw);
  ctx.strokeStyle = 'rgba(150, 156, 162, 0.22)';
  ctx.lineWidth = 0.7;
  for (const a of [0, 0.5, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + wh * 0.02);
    ctx.quadraticCurveTo(
      cx + wr * 0.32,
      cy + wh * (0.3 + a * 0.24),
      cx + wr * (0.6 - a * 0.34),
      cy + wh * (0.42 + a * 0.34),
    );
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(74, 78, 85, 0.32)';
  ctx.lineWidth = 0.95;
  ctx.stroke(hw);

  // ── forewing ───────────────────────────────────────────────────────────────
  const fg = ctx.createRadialGradient(cx, cy - wh * 0.3, SS * 0.008, cx, cy - wh * 0.3, wr * 0.86);
  fg.addColorStop(0.0, '#dfe4e8');
  fg.addColorStop(0.18, '#f6f8fa');
  fg.addColorStop(0.4, '#ffffff');
  fg.addColorStop(1.0, '#ffffff');
  ctx.fillStyle = fg;
  ctx.fill(fw);

  ctx.save();
  ctx.clip(fw);

  // charcoal apex — a defined dark corner, not a wash
  const ax = cx + wr * 1.02;
  const ay = cy - wh * 0.5;
  const ap = ctx.createRadialGradient(ax, ay, SS * 0.004, ax, ay, wr * 0.32);
  ap.addColorStop(0.0, 'rgba(48, 49, 54, 0.94)');
  ap.addColorStop(0.34, 'rgba(58, 60, 66, 0.78)');
  ap.addColorStop(0.62, 'rgba(88, 92, 99, 0.26)');
  ap.addColorStop(1.0, 'rgba(120, 124, 130, 0)');
  ctx.fillStyle = ap;
  ctx.fillRect(0, 0, SS, SS);

  // faint dusting along the outer margin below the apex
  const om = ctx.createLinearGradient(cx + wr * 1.06, cy, cx + wr * 0.62, cy);
  om.addColorStop(0.0, 'rgba(84, 88, 95, 0.34)');
  om.addColorStop(1.0, 'rgba(120, 124, 130, 0)');
  ctx.fillStyle = om;
  ctx.fillRect(0, cy - wh * 0.2, SS, wh * 0.42);

  // veins
  ctx.strokeStyle = 'rgba(150, 156, 162, 0.22)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(cx, cy - wh * 0.46);
  ctx.quadraticCurveTo(cx + wr * 0.46, cy - wh * 0.5, cx + wr * 0.9, cy - wh * 0.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - wh * 0.32);
  ctx.quadraticCurveTo(cx + wr * 0.48, cy - wh * 0.28, cx + wr * 0.9, cy - wh * 0.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - wh * 0.16);
  ctx.quadraticCurveTo(cx + wr * 0.42, cy - wh * 0.04, cx + wr * 0.78, cy + wh * 0.1);
  ctx.stroke();

  // the single dark spot — one per top wing
  const sx = cx + wr * 0.58;
  const sy = cy - wh * 0.14;
  const sr = SS * 0.026;
  const sg = ctx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr);
  sg.addColorStop(0.0, 'rgba(42, 43, 47, 0.95)');
  sg.addColorStop(0.62, 'rgba(50, 52, 57, 0.88)');
  sg.addColorStop(1.0, 'rgba(78, 81, 88, 0)');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.ellipse(sx, sy, sr, sr * 0.88, -0.24, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  ctx.strokeStyle = 'rgba(74, 78, 85, 0.38)';
  ctx.lineWidth = 1;
  ctx.stroke(fw);

  const { c, ctx: out } = cropped(WING_BOX);
  out.drawImage(half, 0, 0);
  out.save();
  out.translate(SS, 0); // mirror about cx, which sits at SS / 2
  out.scale(-1, 1);
  out.drawImage(half, 0, 0);
  out.restore();
  tint(out, cfg); // after composing, or the seam at the axis tints twice

  return { c, ox: WING_BOX.x - SS / 2, oy: WING_BOX.y - SS / 2 };
}

// Deliberately soft: a suggestion of a thorax rather than a black bar.
function makeBody(cfg: Layer): Sprite {
  const { c, ctx } = cropped(BODY_BOX);

  // soft halo so the body reads as fuzzy, not as a hard stroke
  const halo = ctx.createRadialGradient(cx, cy + wh * 0.06, SS * 0.005, cx, cy + wh * 0.06, SS * 0.055);
  halo.addColorStop(0.0, 'rgba(142, 148, 155, 0.24)');
  halo.addColorStop(1.0, 'rgba(142, 148, 155, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.ellipse(cx, cy + wh * 0.06, SS * 0.03, wh * 0.56, 0, 0, Math.PI * 2);
  ctx.fill();

  // thorax, then a tapering abdomen
  const bg = ctx.createLinearGradient(cx, cy - wh * 0.52, cx, cy + wh * 0.66);
  bg.addColorStop(0.0, 'rgba(126, 132, 140, 0.58)');
  bg.addColorStop(0.38, 'rgba(108, 114, 122, 0.5)');
  bg.addColorStop(1.0, 'rgba(130, 136, 143, 0.16)');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.ellipse(cx, cy - wh * 0.24, SS * 0.019, wh * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy + wh * 0.22, SS * 0.013, wh * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // head
  ctx.fillStyle = 'rgba(116, 122, 130, 0.5)';
  ctx.beginPath();
  ctx.arc(cx, cy - wh * 0.5, SS * 0.017, 0, Math.PI * 2);
  ctx.fill();

  // antennae — short, pale and thin; they should barely register
  ctx.strokeStyle = 'rgba(150, 156, 163, 0.34)';
  ctx.lineWidth = 0.8;
  for (const side of [-1, 1]) {
    const X = (v: number) => cx + side * v;
    ctx.beginPath();
    ctx.moveTo(X(SS * 0.007), cy - wh * 0.54);
    ctx.quadraticCurveTo(X(SS * 0.046), cy - wh * 0.68, X(SS * 0.064), cy - wh * 0.8);
    ctx.stroke();
    ctx.fillStyle = 'rgba(150, 156, 163, 0.34)';
    ctx.beginPath();
    ctx.ellipse(X(SS * 0.064), cy - wh * 0.8, SS * 0.009, SS * 0.006, side * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  tint(ctx, cfg);
  return { c, ox: BODY_BOX.x - SS / 2, oy: BODY_BOX.y - SS / 2 };
}


// The ground, the vignette and the cursor glow are fixed images that only
// change when the window does. Evaluating three gradients across the whole
// canvas every frame costs more than the butterflies in the top layer; baking
// them once and blitting turns per-pixel gradient maths into a copy.
// All three are built at device resolution and blitted under an identity
// transform, so nothing is resampled.
function makeWash(w: number, h: number, paint: (c: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  paint(c.getContext('2d')!);
  return c;
}

function makeGround(w: number, h: number) {
  return makeWash(w, h, ctx => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#101418');
    g.addColorStop(0.55, '#0b0e12');
    g.addColorStop(1, '#080a0d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function makeVignette(w: number, h: number) {
  return makeWash(w, h, ctx => {
    const g = ctx.createRadialGradient(
      w * 0.5, h * 0.5, Math.min(w, h) * 0.3,
      w * 0.5, h * 0.5, Math.max(w, h) * 0.82,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function makeGlow(r: number) {
  return makeWash(r * 2, r * 2, ctx => {
    const g = ctx.createRadialGradient(r, r, 0, r, r, r * 0.95);
    g.addColorStop(0.0, 'rgba(222, 234, 244, 0.075)');
    g.addColorStop(0.5, 'rgba(190, 212, 230, 0.026)');
    g.addColorStop(1.0, 'rgba(160, 190, 214, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, r * 2, r * 2);
  });
}

// ─── loading screen ───────────────────────────────────────────────────────────
function LoadingScreen({ onRevealed }: { onRevealed: () => void }) {
  const cvs = useRef<HTMLCanvasElement>(null);
  const bfs = useRef<B[]>([]);
  const wingRef = useRef<Sprite[]>([]);
  const bodyRef = useRef<Sprite[]>([]);
  const deepRef = useRef<Sprite | null>(null);
  const groundRef = useRef<HTMLCanvasElement | null>(null);
  const vigRef = useRef<HTMLCanvasElement | null>(null);
  const glowRef = useRef<HTMLCanvasElement | null>(null);
  const stage = useRef<'idle' | 'fly'>('idle');
  const mouse = useRef({ x: -9999, y: -9999, seen: false });
  const raf = useRef(0);
  const revealed = useRef(onRevealed);
  revealed.current = onRevealed;

  const [ready, setReady] = useState(false);
  const [released, setReleased] = useState(false);

  // hold the invitation back until the field has settled
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 1600);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const canvas = cvs.current!;
    const sil = makeSilhouette();
    wingRef.current = LAYERS.map(makeWing);
    bodyRef.current = LAYERS.map(makeBody);
    deepRef.current = makeShadow(sil, SHADOW_BLUR);

    let W = 0;
    let H = 0;

    // Evenly distributed, half-offset rows — a specimen case, not a scatter.
    // Built bottom row up and right to left, so every butterfly is drawn after
    // the neighbours its shadow falls on — see the shadow constants.
    const buildGrid = () => {
      const make = (x: number, y: number, layer: number): B => ({
        x,
        y,
        layer,
        tilt: (Math.random() - 0.5) * TILT,
        sz: BASE_SZ * LAYERS[layer].sz * (0.9 + Math.random() * 0.2),
        throw_: 0.6 + Math.random() * 0.8,
        band: 0,
        ph: Math.random() * Math.PI * 2,
        hover: 0,
        spread: (x / W - 0.5) * 2,
        sway: Math.random() * Math.PI * 2,
        mode: 0,
        hold: 0,
        shut: 0,
        fStart: 0,
      });

      // One jittered field per layer. The grid survives only as a scatter
      // seed: it guarantees even coverage, then every butterfly wanders up to
      // half a cell off its mark. Three offset fields fill each other’s gaps,
      // which is what lets the screen read as white at rest.
      // Within a layer: bottom row up, right to left, so a butterfly is always
      // drawn after the neighbours its shadow falls on.
      const out: B[] = [];
      for (let L = 0; L < LAYERS.length; L++) {
        const gs = LAYERS[L].gs;
        const cols = Math.max(3, Math.round(W / gs));
        const rows = Math.max(3, Math.round(H / (gs * ROW_RATIO)));
        const stepX = W / cols;
        const stepY = H / rows;
        // Every row gets its own random phase rather than a fixed half-step
        // stagger. A fixed stagger builds a triangular lattice, and a triangular
        // lattice reads as diagonal lines — which the shadows, all thrown the
        // same way, then chain together into streaks. A random phase keeps the
        // spacing even within a row but leaves no alignment between rows.
        // Columns run one past each edge so a shifted row still reaches it.
        for (let r = rows; r >= -1; r--) {
          const phase = (Math.random() - 0.5) * stepX;
          for (let c = cols; c >= -1; c--) {
            const jx = (Math.random() - 0.5) * stepX * JITTER;
            const jy = (Math.random() - 0.5) * stepY * JITTER;
            out.push(make((c + 0.5) * stepX + phase + jx, (r + 0.5) * stepY + jy, L));
          }
        }
      }
      bfs.current = out; // already ordered back layer first
    };

    const dpr = () => Math.min(window.devicePixelRatio || 1, 1.5);
    const onResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      const d = dpr();
      canvas.width = Math.round(W * d);
      canvas.height = Math.round(H * d);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      groundRef.current = makeGround(canvas.width, canvas.height);
      vigRef.current = makeVignette(canvas.width, canvas.height);
      if (!glowRef.current) glowRef.current = makeGlow(Math.round(HOVER_R * d));
      buildGrid();
    };
    onResize();
    window.addEventListener('resize', onResize);

    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY, seen: true };
    };
    const onLeave = () => {
      mouse.current = { x: -9999, y: -9999, seen: false };
    };

    const release = (ox: number, oy: number) => {
      if (stage.current !== 'idle') return;
      stage.current = 'fly';
      setReleased(true);
      const t0 = performance.now() / 1000;
      const back = LAYERS.length - 1;

      let maxRing = 0;
      for (const b of bfs.current) {
        b.band = Math.floor(Math.hypot(b.x - ox, b.y - oy) / BAND_PX);
        if (b.band > maxRing) maxRing = b.band;
      }

      // The opening rings are the ones worth watching, and at full cadence they
      // are gone before the eye can separate them. So the wave starts slow and
      // eases up to speed over SLOW_RINGS — a ramp rather than a switch, or the
      // change of pace itself reads as a hitch. Cumulative, so it is a lookup
      // rather than a per-butterfly calculation.
      const ring = [0];
      for (let k = 1; k <= maxRing; k++) {
        const t = Math.min(1, (k - 1) / SLOW_RINGS);
        ring[k] = ring[k - 1] + SLOW_STEP + (DIST_STEP - SLOW_STEP) * t;
      }

      // Phase 2 picks up where the contact zone left off, so the outward wave
      // does not replay the rings the poke already cleared.
      const rollStart = back * POKE_STEP + PHASE_GAP;
      const edge = ring[Math.min(CONTACT_BANDS, maxRing)];

      let maxDelay = 0;
      for (const b of bfs.current) {
        const depth = back - b.layer;

        // Phase 1 stays crisp — that is contact, and contact is not negotiable.
        // Only the alarm-driven rings get stragglers.
        const reluctance = Math.min(1, b.band / LAG_RAMP);
        const lag =
          Math.random() < LAG_CHANCE * reluctance
            ? Math.random() ** 2 * LAG_MAX * reluctance
            : 0;

        const delay =
          b.band < CONTACT_BANDS
            ? ring[b.band] + depth * POKE_STEP
            : rollStart + (ring[b.band] - edge + depth * ROLL_LAYER_STEP + lag) * WAVE_SCALE;
        b.fStart = t0 + delay + Math.random() * BAND_JITTER;
        if (delay > maxDelay) maxDelay = delay;
      }
      maxDelay += BAND_JITTER;
      window.setTimeout(() => revealed.current(), Math.round((maxDelay + FD * 0.66) * 1000));
    };

    const onClick = (e: MouseEvent) => release(e.clientX, e.clientY);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        release(mouse.current.seen ? mouse.current.x : W / 2, mouse.current.seen ? mouse.current.y : H / 2);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);

    // ─── animation loop ──────────────────────────────────────────────────────
    let last = performance.now() / 1000;

    const loop = () => {
      const canvasEl = cvs.current;
      const wings = wingRef.current;
      const bodies = bodyRef.current;
      const deep = deepRef.current;
      if (!canvasEl || !wings.length || !bodies.length || !deep) return;

      const ctx = canvasEl.getContext('2d')!;
      const now = performance.now() / 1000;
      const dt = Math.min(now - last, 0.05);
      last = now;

      const d = dpr();
      const ground = groundRef.current;
      const vig = vigRef.current;
      const glow = glowRef.current;
      if (!ground || !vig || !glow) return;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.drawImage(ground, 0, 0);

      // Every butterfly transform is written straight into setTransform below,
      // so the device scale is folded in here rather than left on the context.
      const flying = stage.current === 'fly';
      const shadowLayer = LAYERS.map(l => l.shadow);
      const cull = 120; // px of slack before an off-screen butterfly is skipped
      const mx = mouse.current.x;
      const my = mouse.current.y;

      for (const b of bfs.current) {
        let px = b.x;
        let py = b.y;
        let rot = b.tilt;
        let alpha = 1;
        let amp: number;

        if (flying) {
          const el = now - b.fStart;
          if (el < 0) {
            // Still on the canvas. The click startles the whole swarm at once,
            // then each one winds up to a hard beat over the last ALARM_LEAD
            // seconds before its own launch — so there is always a wide band of
            // agitated butterflies ahead of the clearing front, and the layers
            // under the fingertip are visibly winding up while the top one goes.
            const target = el > -ALARM_LEAD ? ALARM_AMP : STARTLE_AMP;
            b.hover += (target - b.hover) * RISE;
            amp = IDLE_AMP + b.hover * (MAX_AMP - IDLE_AMP);
            b.ph += dt * (IDLE_SPEED + b.hover * (FAST_SPEED - IDLE_SPEED));
          } else {
            const t = Math.min(el / FD, 1);
            if (t >= 1) continue;
            const ease = t * t * t;
            py = b.y - FLY_UP * ease - 46 * t;
            px = b.x + b.spread * FLY_OUT * ease + Math.sin(now * 2.4 + b.sway) * 16 * t;
            rot = b.tilt + b.spread * 0.42 * ease + Math.sin(now * 2.4 + b.sway) * 0.06;
            alpha = 1 - Math.max(0, (t - 0.3) / 0.7) ** 1.4;
            b.ph += dt * FAST_SPEED * 1.15;
            amp = MAX_AMP;
          }
        } else {
          const dx = b.x - mx;
          const dy = b.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const t = dist < HOVER_R ? 1 - dist / HOVER_R : 0;
          const target = t * t;
          b.hover += (target - b.hover) * (target > b.hover ? RISE : FALL);
          amp = IDLE_AMP + b.hover * (MAX_AMP - IDLE_AMP);

          if (b.mode === 0 && b.hover > WAKE) {
            b.mode = 1; // touched — shut the wings
            b.hold = HOLD;
          } else if (b.mode !== 0 && b.hover < SLEEP) {
            b.mode = 0; // cursor gone — re-arm for the next approach
            b.shut = 0;
          }

          if (b.mode === 1) {
            b.shut += (1 - b.shut) * SHUT;
            // Parked at π, where (1 - cos) / 2 is exactly 1, so when the hold
            // ends the phase carries straight on into the downstroke.
            b.ph = Math.PI;
            if (b.shut > 0.96) {
              b.hold -= dt;
              if (b.hold <= 0) b.mode = 2;
            }
            amp *= b.shut;
          } else {
            b.ph += dt * (IDLE_SPEED + b.hover * (FAST_SPEED - IDLE_SPEED));
          }
        }

        if (alpha < 0.012) continue;
        // Nothing to draw once the flight has carried it off the canvas.
        if (px < -cull || px > W + cull || py < -cull || py > H + cull) continue;

        // fold: 0 = wings flat open, 1 = wings closed over the back
        const fold = amp * (1 - Math.cos(b.ph)) * 0.5;
        const sx = (1 - fold * 0.93) * b.sz;
        const sy = (1 + fold * 0.12) * b.sz;
        // wings rise as they close; the body stays put, so it reads as a hinge
        const lift = -fold * SS * 0.05 * b.sz;

        // Each sprite's transform is translate * rotate * translate(0,lift) *
        // scale, composed by hand and pushed in one setTransform. The equivalent
        // save/translate/rotate/scale/restore chain is four state-stack
        // operations per sprite, and at this butterfly count that is a
        // measurable slice of the frame on its own.
        const co = Math.cos(rot);
        const si = Math.sin(rot);
        const wa = co * sx * d;
        const wb = si * sx * d;
        const wc = -si * sy * d;
        const wd = co * sy * d;
        const lx = -si * lift;
        const ly = co * lift;

        // Shadow first, offset in screen space so the direction stays put, then
        // folded by the same scale as the wings that cast it.
        if (shadowLayer[b.layer]) {
          ctx.globalAlpha = alpha * SHADOW_ALPHA;
          const ox2 = px + SHADOW_DX * b.throw_ + lx;
          const oy2 = py + SHADOW_DY * b.throw_ + ly;
          ctx.setTransform(wa, wb, wc, wd, ox2 * d, oy2 * d);
          ctx.drawImage(deep.c, deep.ox, deep.oy);
        }

        ctx.globalAlpha = alpha * (1 - fold * 0.16);

        // wings — one symmetric sprite, squeezed toward the body axis
        const wing = wings[b.layer];
        ctx.setTransform(wa, wb, wc, wd, (px + lx) * d, (py + ly) * d);
        ctx.drawImage(wing.c, wing.ox, wing.oy);

        // body rides on top, unfolded, so the fold reads as a hinge
        const body = bodies[b.layer];
        const bs = b.sz * d;
        ctx.setTransform(co * bs, si * bs, -si * bs, co * bs, px * d, py * d);
        ctx.drawImage(body.c, body.ox, body.oy);
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;

      // cool spill of light around the cursor
      if (!flying && mouse.current.seen) {
        ctx.drawImage(glow, Math.round((mx - HOVER_R) * d), Math.round((my - HOVER_R) * d));
      }

      ctx.drawImage(vig, 0, 0);

      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="fixed inset-0" style={{ background: '#0b0e12' }}>
      <canvas ref={cvs} className="absolute inset-0" style={{ display: 'block' }} />

      {/* Nothing centred — the field runs edge to edge. Only a quiet cue at the
          foot of the screen, so the interaction stays discoverable. */}
      <div
        className="absolute inset-x-0 bottom-8 flex justify-center pointer-events-none select-none"
        style={{
          opacity: released ? 0 : ready ? 1 : 0,
          transition: 'opacity 1.2s ease',
        }}
      >
        <span
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: '0.58rem',
            fontWeight: 300,
            letterSpacing: '0.3em',
            textIndent: '0.3em',
            textTransform: 'uppercase',
            color: 'rgba(206, 220, 232, 0.55)',
            textShadow: '0 1px 10px rgba(6, 8, 11, 0.9), 0 0 26px rgba(6, 8, 11, 0.8)',
          }}
        >
          Click anywhere to release
        </span>
      </div>
    </div>
  );
}

// ─── revealed content ─────────────────────────────────────────────────────────
function MainContent() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#f7f6f3', fontFamily: "'Outfit', sans-serif" }}
    >
      <nav
        className="fixed top-0 inset-x-0 flex items-center justify-between px-10 py-6"
        style={{ zIndex: 10 }}
      >
        <span
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: '1.05rem',
            color: '#1c1e1b',
            fontWeight: 300,
            letterSpacing: '0.16em',
          }}
        >
          PIERIS
        </span>
        <div
          className="flex gap-8"
          style={{
            fontSize: '0.7rem',
            letterSpacing: '0.16em',
            color: '#6c6f68',
            textTransform: 'uppercase',
          }}
        >
          {['Field notes', 'Species', 'Journal', 'About'].map(l => (
            <a key={l} href="#" style={{ textDecoration: 'none', color: 'inherit' }}>
              {l}
            </a>
          ))}
        </div>
      </nav>

      <div className="flex flex-col items-center justify-center min-h-screen text-center px-8 gap-8">
        <p
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 'clamp(2.6rem, 6.6vw, 6.2rem)',
            fontWeight: 300,
            color: '#17190f',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            maxWidth: '18ch',
          }}
        >
          Where wings
          <br />
          <em style={{ fontStyle: 'italic' }}>become</em> wind.
        </p>

        <p
          style={{
            color: '#61645b',
            fontSize: '0.98rem',
            lineHeight: 1.8,
            maxWidth: '40ch',
            fontWeight: 300,
          }}
        >
          Two hundred small white wings, opening and closing over a hedgerow — the
          quietest weather there is, and gone the moment you look straight at it.
        </p>

        <div className="flex gap-4 mt-2">
          <button
            style={{
              padding: '0.78rem 2.2rem',
              background: '#1f2218',
              border: 'none',
              color: '#eceee6',
              borderRadius: '100px',
              fontSize: '0.73rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Enter the field
          </button>
          <button
            style={{
              padding: '0.78rem 2.2rem',
              background: 'transparent',
              border: '1px solid #cbcabf',
              color: '#5b5e55',
              borderRadius: '100px',
              fontSize: '0.73rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Learn more
          </button>
        </div>
      </div>

      <div
        className="text-center pb-8"
        style={{
          fontSize: '0.66rem',
          letterSpacing: '0.2em',
          color: '#a6a89c',
          textTransform: 'uppercase',
        }}
      >
        Pieris rapae · Hedgerow and headland · Temperate
      </div>
    </div>
  );
}

// ─── root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase] = useState<'load' | 'fade' | 'done'>('load');

  return (
    <div className="size-full">
      <div
        className="fixed inset-0"
        style={{
          opacity: phase === 'load' ? 0 : 1,
          transition: 'opacity 1.1s ease 0.1s',
          zIndex: 1,
        }}
      >
        <MainContent />
      </div>

      <div
        className="fixed inset-0"
        style={{
          opacity: phase === 'done' ? 0 : 1,
          transition: 'opacity 0.9s ease',
          pointerEvents: phase === 'done' ? 'none' : 'auto',
          zIndex: 10,
        }}
      >
        <LoadingScreen
          onRevealed={() => {
            setPhase('fade');
            window.setTimeout(() => setPhase('done'), 940);
          }}
        />
      </div>
    </div>
  );
}
