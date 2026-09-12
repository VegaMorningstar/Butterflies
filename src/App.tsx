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

import { lazy, Suspense, useEffect, useRef, useState } from 'react';

import {
  BASE_SZ,
  LAYERS,
  makeBody,
  makeGlow,
  makeGround,
  makeShadow,
  makeSilhouette,
  makeVignette,
  makeWing,
  SHADOW_ALPHA,
  SHADOW_BLUR,
  SHADOW_DX,
  SHADOW_DY,
  SS,
  type Sprite,
} from './butterfly';
import { setScenesPaused } from './scenePause';

const Masterclass = lazy(() => import('./masterclass/Masterclass'));

// ─── tuning ───────────────────────────────────────────────────────────────────
// The sprite art, the layer stack and the scene washes live in butterfly.ts.
// What is left here is behaviour: how the field is laid out, how it answers the
// cursor, and how the release is choreographed.
const ROW_RATIO = 0.62; // butterflies are far wider than tall; rows need the room
const JITTER = 0.62; // grid cell fraction each butterfly may wander — organic, still even
const TILT = 0.46; // total spread of random rotation (±0.23 rad ≈ ±13°)

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

// A second click means "I have seen this, let me in". Cutting straight to the
// page would throw away the one moment the whole screen exists for, so instead
// the release clock is run fast and the same choreography plays out compressed.
// The rate is derived from how much of the release is actually left, so the
// wait after a skip is the same whether you skip at the start or near the end.
const SKIP_IN = 0.4; // s of real time the remainder of the release gets
const SKIP_MAX_RATE = 14; // ceiling, so nothing teleports between two frames
// Time constant for winding the clock up, in seconds, rather than a per-frame
// fraction. A per-frame constant would take the same number of frames at any
// refresh rate, which on a struggling device is most of the time the skip was
// supposed to save.
const SKIP_TAU = 0.07;

// A butterfly winds up in two stages, and both are measured backwards from its
// own launch rather than from the click. That is the whole trick: the wind-up
// inherits the BL/DL ordering of the departure for free, so the stirring rolls
// outward and down through the layers exactly as the dispersion does, instead
// of the entire swarm twitching at once the instant the click lands.
//
//   idle  ->  STARTLE_LEAD before launch: stirs      (STARTLE_AMP)
//         ->  ALARM_LEAD   before launch: beats hard (ALARM_AMP)
//         ->  launch
//
// STARTLE_LEAD is well ahead of ALARM_LEAD so there is a wide band of stirring
// butterflies running ahead of the narrower band of hard-beating ones, and both
// run ahead of the clearing front.
const STARTLE_AMP = 0.4; // a stir — it has noticed something
const STARTLE_LEAD = 1.5; // s before its own launch that it first stirs
const ALARM_AMP = 0.92; // full beat — it is about to go
const ALARM_LEAD = 0.6; // s of hard beating before this one actually leaves
const FLY_UP = 2600; // px risen over the full flight
const FLY_OUT = 620; // px of lateral spread

// Which way a butterfly leans as it climbs. The bias points it away from the
// click — left of the cursor goes left, right goes right — so the swarm opens
// outward from the point that disturbed it rather than drifting one way as a
// sheet. On top of that each one gets its own random lean, which is what stops
// neighbours travelling in parallel; without it the fan is geometrically
// perfect and reads as a machine.
//
// SPREAD_RANDOM is deliberately about half the bias, so the outward sense
// survives while individuals still cross paths.
const SPREAD_BIAS = 0.75; // how strongly the fan follows "away from the click"
const SPREAD_RANDOM = 0.7; // per-butterfly lean either side of that
const RISE_VARY = 0.3; // spread of how high each one climbs (±15%)

// ─── model ────────────────────────────────────────────────────────────────────
interface B {
  x: number;
  y: number;
  tilt: number; // random rotation, keeps the field from feeling stamped
  sz: number;
  ph: number; // wing phase
  hover: number; // 0..1 flap amplitude driver
  spread: number; // lateral lean, assigned at release — it depends on the click
  rise: number; // per-butterfly climb multiplier, so they do not move as a sheet
  sway: number; // per-butterfly sway offset
  layer: number; // 0 back .. 2 front; picks the sprite and the draw order
  throw_: number; // how far this one's shadow reaches — reads as height off the field
  band: number; // which ring out from the click it fell in, 0 = under the cursor
  mode: 0 | 1 | 2; // 0 resting, 1 holding shut, 2 beating
  hold: number; // seconds left in the hold
  shut: number; // 0..1 approach to the closed position
  fStart: number;
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
  // idle: the field is up. fly: the release is running. done: the reveal has
  // been handed to the page underneath, and this screen stops claiming input.
  const stage = useRef<'idle' | 'fly' | 'done'>('idle');
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
        spread: 0, // set in release(), once the click position is known
        rise: 1 + (Math.random() - 0.5) * RISE_VARY,
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

    // Fill rate is the app's own bottleneck (see README perf notes), and touch
    // devices tend to have weaker GPUs than desktop ones. A coarse pointer is
    // the actual signal for that — unlike a viewport-width breakpoint, it
    // doesn't false-positive on a desktop window resized narrow, and it still
    // catches a touch device that happens to be wide (a tablet, or a phone in
    // landscape), so the cap adapts to the device rather than one screen size.
    const coarsePointerQuery = window.matchMedia?.('(pointer: coarse)') ?? null;
    let coarsePointer = coarsePointerQuery?.matches ?? false;
    const onPointerCapabilityChange = (e: MediaQueryListEvent) => {
      coarsePointer = e.matches;
    };
    coarsePointerQuery?.addEventListener('change', onPointerCapabilityChange);
    const dpr = () => Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.25 : 1.5);

    // iOS Safari fires `resize` when its address bar shows/hides on scroll —
    // a height-only wobble, not a real layout change. Rebuilding the whole
    // ~2,500-butterfly grid for that reads as a jank/flicker on iPhone, so a
    // resize only triggers a rebuild when the width changes or the height
    // changes by more than that toolbar's own travel.
    let prevW = 0;
    let prevH = 0;
    const onResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      const widthChanged = Math.abs(W - prevW) > 1;
      const majorHeightChange = Math.abs(H - prevH) > 150;
      const needsRebuild = prevW === 0 || widthChanged || majorHeightChange;
      prevW = W;
      prevH = H;

      const d = dpr();
      canvas.width = Math.round(W * d);
      canvas.height = Math.round(H * d);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      groundRef.current = makeGround(canvas.width, canvas.height);
      vigRef.current = makeVignette(canvas.width, canvas.height);
      if (!glowRef.current) glowRef.current = makeGlow(Math.round(HOVER_R * d));
      if (needsRebuild) buildGrid();
    };
    onResize();
    window.addEventListener('resize', onResize);

    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY, seen: true };
    };
    const onLeave = () => {
      mouse.current = { x: -9999, y: -9999, seen: false };
    };

    // The release is scheduled against `clock`, a virtual second count that
    // normally advances in step with real time. Skipping speeds that clock up,
    // which compresses the launch schedule, the flights and the wing beats
    // together, because all three are expressed in the same currency.
    let clock = 0;
    let rate = 1;
    let rateTarget = 1;
    let revealAt = Infinity;
    let lastLaunchAt = Infinity; // virtual time the final butterfly leaves

    const release = (ox: number, oy: number) => {
      if (stage.current !== 'idle') return;
      stage.current = 'fly';
      setReleased(true);
      const t0 = clock;
      const back = LAYERS.length - 1;

      let maxRing = 0;
      for (const b of bfs.current) {
        b.band = Math.floor(Math.hypot(b.x - ox, b.y - oy) / BAND_PX);
        if (b.band > maxRing) maxRing = b.band;

        // Lean away from the click, clamped so an off-centre click cannot throw
        // the far side of the screen sideways at double speed, then scattered
        // per butterfly so neighbours diverge instead of travelling in parallel.
        const away = Math.max(-1, Math.min(1, (b.x - ox) / (W * 0.5)));
        b.spread = away * SPREAD_BIAS + (Math.random() - 0.5) * SPREAD_RANDOM;
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
      // Scheduled on the virtual clock rather than a timeout, so that speeding
      // the clock up brings the handoff forward with everything else.
      lastLaunchAt = t0 + maxDelay;
      revealAt = lastLaunchAt + FD * 0.66;
    };

    /**
     * Second press: run the rest of the release fast.
     *
     * Two things change. The clock speeds up by whatever factor clears the
     * remaining launches inside SKIP_IN, and the handoff stops waiting for the
     * flight tail. Anything still airborne finishes over the top of the page
     * during the crossfade, which is the same overlap the unhurried version
     * uses, just with more of it.
     */
    const skip = () => {
      if (stage.current !== 'fly' || rateTarget > 1) return;
      const remaining = Math.max(0, lastLaunchAt - clock);
      rateTarget = Math.min(SKIP_MAX_RATE, Math.max(1, remaining / SKIP_IN));
      revealAt = lastLaunchAt;
    };

    /** First press releases the field, any press after that skips ahead. */
    const advance = (x: number, y: number) => {
      if (stage.current === 'idle') release(x, y);
      else skip();
    };

    const onClick = (e: MouseEvent) => advance(e.clientX, e.clientY);
    const onKey = (e: KeyboardEvent) => {
      // Once the reveal has been handed over, the page underneath owns the
      // keyboard again, so Space must go back to activating the focused button.
      if (stage.current === 'done') return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        advance(mouse.current.seen ? mouse.current.x : W / 2, mouse.current.seen ? mouse.current.y : H / 2);
      }
    };

    // Touch parity with the mouse: a finger resting or sliding on the field is
    // the same "hover" signal a cursor gives, so the wing-snap/hold/beat buildup
    // plays under a finger the same way it does under a cursor, and lifting the
    // finger releases the field exactly like a click. preventDefault (the
    // listeners are non-passive for this) stops the page scrolling or
    // pinch-zooming under the gesture while the field is live.
    //
    // They keep running through the release so a second tap can skip it, then
    // bail at 'done'. That last guard is load bearing: these are window
    // listeners, so they outlive the screen being visible, and a preventDefault
    // on touchend suppresses the click the browser would otherwise synthesise.
    // Left running, they silently swallow every tap on the revealed page.
    const touchXY = (e: TouchEvent) => {
      const t = e.touches[0] ?? e.changedTouches[0];
      return t ? { x: t.clientX, y: t.clientY } : null;
    };
    const onTouchStart = (e: TouchEvent) => {
      if (stage.current === 'done') return;
      const p = touchXY(e);
      if (p && stage.current === 'idle') mouse.current = { x: p.x, y: p.y, seen: true };
      if (e.cancelable) e.preventDefault();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (stage.current !== 'idle') return;
      const p = touchXY(e);
      if (p) mouse.current = { x: p.x, y: p.y, seen: true };
      if (e.cancelable) e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (stage.current === 'done') return;
      const p = touchXY(e);
      if (p) advance(p.x, p.y);
      onLeave();
      if (e.cancelable) e.preventDefault();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onLeave);

    // ─── animation loop ──────────────────────────────────────────────────────
    let last = performance.now() / 1000;

    const loop = () => {
      const canvasEl = cvs.current;
      const wings = wingRef.current;
      const bodies = bodyRef.current;
      const deep = deepRef.current;
      if (!canvasEl || !wings.length || !bodies.length || !deep) return;

      const ctx = canvasEl.getContext('2d')!;
      const real = performance.now() / 1000;
      const elapsed = real - last;
      last = real;

      // Ease into the skip rate instead of switching to it. A step change in
      // velocity across one frame reads as a glitch; a short wind-up reads as
      // the swarm being hurried. Exponential in elapsed time, so the wind-up
      // lasts about the same fifth of a second whatever the frame rate is.
      rate += (rateTarget - rate) * (1 - Math.exp(-elapsed / SKIP_TAU));

      // Two clamps, because two different things are being protected.
      //
      // `dt` drives the per-butterfly integration, which goes unstable if a
      // single step is large, so it is held to 50ms.
      //
      // `clock` carries the release schedule, and must keep real-time pace
      // instead. Clamping it as hard as `dt` would mean that any device unable
      // to hold 20fps also had to wait proportionally longer for the field to
      // clear, which is precisely backwards for a loading screen. A looser
      // bound still stops a backgrounded tab from teleporting on its first
      // frame back, since that gap is measured in seconds rather than frames.
      const dt = Math.min(elapsed, 0.05) * rate;
      clock += Math.min(elapsed, 0.25) * rate;
      const now = clock;

      // The handoff rides the same clock, so skipping brings it forward too.
      if (stage.current === 'fly' && clock >= revealAt) {
        stage.current = 'done';
        revealAt = Infinity;
        revealed.current();
      }

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
      //
      // Not `=== 'fly'`: the stage flips to 'done' the moment the reveal is
      // handed over, but this screen stays mounted and visible for the length of
      // the crossfade. Anything still in the air has to keep flying.
      const flying = stage.current !== 'idle';
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
            // Still on the canvas. Both wind-up stages are relative to this
            // butterfly's own launch, so the agitation spreads in the same order
            // the departure does. Anything the wave has not reached yet keeps
            // breathing at its resting rate.
            const target =
              el > -ALARM_LEAD ? ALARM_AMP : el > -STARTLE_LEAD ? STARTLE_AMP : 0;
            b.hover += (target - b.hover) * RISE;
            amp = IDLE_AMP + b.hover * (MAX_AMP - IDLE_AMP);
            b.ph += dt * (IDLE_SPEED + b.hover * (FAST_SPEED - IDLE_SPEED));
          } else {
            const t = Math.min(el / FD, 1);
            if (t >= 1) continue;
            const ease = t * t * t;
            py = b.y - FLY_UP * b.rise * ease - 46 * t;
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
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onLeave);
      coarsePointerQuery?.removeEventListener('change', onPointerCapabilityChange);
    };
  }, []);

  return (
    <div className="fixed inset-0" style={{ background: '#0b0e12', touchAction: 'none' }}>
      <canvas ref={cvs} className="absolute inset-0" style={{ display: 'block' }} />

      {/* Nothing centred — the field runs edge to edge. Only a quiet cue at the
          foot of the screen, so the interaction stays discoverable. Padding
          clears the home-indicator strip on notched iPhones. */}
      <div
        className="absolute inset-x-0 flex justify-center pointer-events-none select-none"
        style={{
          bottom: 'calc(2rem + env(safe-area-inset-bottom))',
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
          Tap or click anywhere to release
        </span>
      </div>
    </div>
  );
}


// ─── root ─────────────────────────────────────────────────────────────────────
// The field is the front door and the walkthrough is the building. Releasing
// the butterflies is what opens it.
//
// The course is a lazy chunk, and the import below is fired on mount rather
// than at render time, so it downloads while the field is still up. That makes
// the loading screen honest: by the time anyone releases it, the thing it was
// covering has actually arrived.
export default function App() {
  const startRevealed = () => window.location.hash.length > 1;

  const [phase, setPhase] = useState<'load' | 'fade' | 'done'>(() =>
    startRevealed() ? 'done' : 'load',
  );
  // Kept mounted once shown, so replaying the field does not throw away scroll
  // position or the state of any figure.
  const [shown, setShown] = useState(startRevealed);
  const [run, setRun] = useState(0);

  useEffect(() => {
    void import('./masterclass/Masterclass');
  }, []);

  // The course's figures each run their own loop. Park them while the field
  // has the frame budget, and stop the page scrolling behind the field.
  useEffect(() => {
    setScenesPaused(phase === 'load');
    document.body.style.overflow = phase === 'load' ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [phase]);

  const replay = () => {
    setRun(r => r + 1);
    setPhase('load');
  };

  return (
    <>
      <div
        style={{
          opacity: phase === 'load' ? 0 : 1,
          transition: 'opacity 1.1s ease 0.1s',
        }}
      >
        {shown && (
          <Suspense fallback={null}>
            <Masterclass onReplay={replay} />
          </Suspense>
        )}
      </div>

      {phase !== 'done' && (
        <div
          className="fixed inset-0"
          style={{
            opacity: phase === 'fade' ? 0 : 1,
            transition: 'opacity 0.9s ease',
            pointerEvents: phase === 'fade' ? 'none' : 'auto',
            zIndex: 10,
          }}
        >
          <LoadingScreen
            key={run}
            onRevealed={() => {
              setShown(true);
              setPhase('fade');
              window.setTimeout(() => setPhase('done'), 940);
            }}
          />
        </div>
      )}
    </>
  );
}
