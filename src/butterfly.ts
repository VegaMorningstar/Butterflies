/**
 * The art layer: everything needed to draw a butterfly and the ground it sits
 * on. Nothing here knows about the field, the interaction or the release.
 *
 * Paths are authored in a 150px "sprite space" centred on the butterfly, but
 * each sprite renders into a canvas cropped to its real bounds. At the density
 * the field runs at, the transparent margin would otherwise dominate the
 * per-frame fill cost.
 *
 * Split out of App.tsx so the how-it-works course can drive the same sprite
 * code the loading screen does, rather than a drifting copy of it.
 */

export const SS = 150; // sprite canvas size (px), source resolution, not display size
export const BASE_SZ = 0.4; // sprite to screen scale (~55px wingspan)

export const cx = SS / 2;
export const cy = SS * 0.5;
export const wr = SS * 0.43; // half wingspan
export const wh = SS * 0.4; // vertical extent

// Three interleaved fields, back to front. Each is its own jittered grid, so
// they close each other's gaps and the screen reads as near-solid white at
// rest: the dark ground only opens up where the cursor folds the wings shut.
// Depth comes from tone. The back layer sits in shade, the front catches light.
// The shading stays gentle on purpose. Push it far and a back-layer butterfly
// goes as dark as the ground, reads as background, and the coverage is wasted.
export interface Layer {
  gs: number; // column spacing for this field
  sz: number; // size multiplier, nearer reads bigger
  dark: number; // shade laid over the sprite
  light: number; // highlight raked across it from the upper left
  shadow: boolean; // whether it drops a shadow on the layers behind
}

export const LAYERS: Layer[] = [
  { gs: 46, sz: 0.92, dark: 0.26, light: 0, shadow: false },
  { gs: 50, sz: 1.0, dark: 0.11, light: 0.05, shadow: false },
  { gs: 56, sz: 1.09, dark: 0, light: 0.18, shadow: true },
];

export interface Sprite {
  c: HTMLCanvasElement;
  ox: number; // offset from the butterfly centre to the canvas top-left
  oy: number;
}

export const WING_BOX = { x: 3, y: 36, w: 144, h: 91 };
export const BODY_BOX = { x: 62, y: 24, w: 26, h: 90 }; // y must clear the antennae at 27

// Light comes from the upper left, so shadows fall down and to the right. The
// field is drawn bottom row up and right to left, which puts every neighbour a
// shadow lands on already on the canvas.
export const SHADOW_BOX = { x: 0, y: 24, w: 150, h: 116 };
export const SHADOW_DX = 11; // the drop shadow the front layer casts on the ones behind
export const SHADOW_DY = 15;
export const SHADOW_BLUR = 9;
export const SHADOW_ALPHA = 0.5;

export function cropped(box: { x: number; y: number; w: number; h: number }) {
  const c = document.createElement('canvas');
  c.width = box.w;
  c.height = box.h;
  const ctx = c.getContext('2d')!;
  ctx.translate(-box.x, -box.y); // draw in sprite space, land inside the crop
  return { c, ctx };
}

/**
 * The right-hand wing pair as plain numbers, so the shape has one definition
 * that both the renderer and the anatomy diagram in the course read from.
 *
 * Every point is [u, v] in wing units: x = cx + wr * u, y = cy + wh * v. The
 * axis is u = 0, the wingtip is a little past u = 1. Each curve is three
 * points: two control handles then the anchor it lands on.
 */
export interface WingOutline {
  start: [number, number];
  curves: [number, number][][];
}

// hindwing, broad and tucked under; its inner edge hugs the axis
export const HINDWING: WingOutline = {
  start: [0, -0.1],
  curves: [
    [[0.34, 0.04], [0.7, 0.22], [0.72, 0.46]],
    [[0.74, 0.68], [0.5, 0.82], [0.22, 0.8]],
    [[0.1, 0.79], [0.02, 0.62], [0, 0.26]],
  ],
};

// forewing, a rounded triangle: gentle leading edge to the apex, then a
// near-vertical outer margin so it stays wide at the tornus instead of pinching
export const FOREWING: WingOutline = {
  start: [0, -0.5],
  curves: [
    [[0.36, -0.56], [0.74, -0.6], [1.02, -0.52]],
    [[1.09, -0.3], [1.0, -0.04], [0.84, 0.14]],
    [[0.56, 0.22], [0.24, 0.14], [0, -0.02]],
  ],
};

/** Wing units to sprite-space pixels. */
export function wingPoint(u: number, v: number) {
  return { x: cx + wr * u, y: cy + wh * v };
}

function outlineToPath(outline: WingOutline): Path2D {
  const p = new Path2D();
  const s = wingPoint(outline.start[0], outline.start[1]);
  p.moveTo(s.x, s.y);
  for (const [c1, c2, end] of outline.curves) {
    const a = wingPoint(c1[0], c1[1]);
    const b = wingPoint(c2[0], c2[1]);
    const e = wingPoint(end[0], end[1]);
    p.bezierCurveTo(a.x, a.y, b.x, b.y, e.x, e.y);
  }
  p.closePath();
  return p;
}

// The right-hand wing pair, mirrored at draw time.
// Cabbage White: white plates, a charcoal apex corner, one dark spot per forewing.
export function wingPaths() {
  return { fw: outlineToPath(FOREWING), hw: outlineToPath(HINDWING) };
}

// Flat black silhouette of the whole butterfly. It has to cover both wings:
// the shadow is offset horizontally, and a mirrored half-sprite would flip that
// offset along with it.
export function makeSilhouette(): HTMLCanvasElement {
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

export function makeShadow(sil: HTMLCanvasElement, blur: number): Sprite {
  const { c, ctx } = cropped(SHADOW_BOX);
  ctx.filter = 'blur(' + blur + 'px)';
  ctx.drawImage(sil, 0, 0);
  return { c, ox: SHADOW_BOX.x - SS / 2, oy: SHADOW_BOX.y - SS / 2 };
}

// Shade or rake light across what has already been drawn. source-atop keeps it
// inside the wing silhouette, so the tint never leaks onto the ground.
export function tint(ctx: CanvasRenderingContext2D, cfg: Layer) {
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

/**
 * Paint the wing pair into `ctx` in sprite space, without cropping or tinting.
 * Split out of makeWing so the course can show the same paint step running
 * per frame (the slow way) against the baked sprite (the fast way).
 */
export function paintWings(ctx: CanvasRenderingContext2D) {
  const { fw, hw } = wingPaths();

  // hindwing
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

  // forewing
  const fg = ctx.createRadialGradient(cx, cy - wh * 0.3, SS * 0.008, cx, cy - wh * 0.3, wr * 0.86);
  fg.addColorStop(0.0, '#dfe4e8');
  fg.addColorStop(0.18, '#f6f8fa');
  fg.addColorStop(0.4, '#ffffff');
  fg.addColorStop(1.0, '#ffffff');
  ctx.fillStyle = fg;
  ctx.fill(fw);

  ctx.save();
  ctx.clip(fw);

  // charcoal apex, a defined dark corner rather than a wash
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

  // the single dark spot, one per top wing
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
}

export function makeWing(cfg: Layer): Sprite {
  const half = document.createElement('canvas');
  half.width = SS;
  half.height = SS;
  paintWings(half.getContext('2d')!);

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

/** Paint the body into `ctx` in sprite space, uncropped and untinted. */
export function paintBody(ctx: CanvasRenderingContext2D) {
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

  // antennae, short, pale and thin; they should barely register
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
}

// Deliberately soft: a suggestion of a thorax rather than a black bar.
export function makeBody(cfg: Layer): Sprite {
  const { c, ctx } = cropped(BODY_BOX);
  paintBody(ctx);
  tint(ctx, cfg);
  return { c, ox: BODY_BOX.x - SS / 2, oy: BODY_BOX.y - SS / 2 };
}

// The ground, the vignette and the cursor glow are fixed images that only
// change when the window does. Evaluating three gradients across the whole
// canvas every frame costs more than the butterflies in the top layer; baking
// them once and blitting turns per-pixel gradient maths into a copy.
// All three are built at device resolution and blitted under an identity
// transform, so nothing is resampled.
export function makeWash(w: number, h: number, paint: (c: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  paint(c.getContext('2d')!);
  return c;
}

export function makeGround(w: number, h: number) {
  return makeWash(w, h, ctx => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#101418');
    g.addColorStop(0.55, '#0b0e12');
    g.addColorStop(1, '#080a0d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function makeVignette(w: number, h: number) {
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

export function makeGlow(r: number) {
  return makeWash(r * 2, r * 2, ctx => {
    const g = ctx.createRadialGradient(r, r, 0, r, r, r * 0.95);
    g.addColorStop(0.0, 'rgba(222, 234, 244, 0.075)');
    g.addColorStop(0.5, 'rgba(190, 212, 230, 0.026)');
    g.addColorStop(1.0, 'rgba(160, 190, 214, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, r * 2, r * 2);
  });
}

/**
 * Sprite sets are immutable once baked, so the course pages share one set
 * across every demo instead of re-baking per mount.
 */
let sharedSprites: { wings: Sprite[]; bodies: Sprite[]; shadow: Sprite } | null = null;

export function getSprites() {
  if (!sharedSprites) {
    sharedSprites = {
      wings: LAYERS.map(makeWing),
      bodies: LAYERS.map(makeBody),
      shadow: makeShadow(makeSilhouette(), SHADOW_BLUR),
    };
  }
  return sharedSprites;
}

/**
 * One butterfly, composed by hand into a single setTransform per sprite.
 * `fold` runs 0 (wings flat open) to 1 (closed over the back).
 *
 * This is the same transform maths the loading screen runs per butterfly per
 * frame, pulled out so the course demos stay honest about what they are
 * showing.
 */
export function drawButterfly(
  ctx: CanvasRenderingContext2D,
  sprites: { wings: Sprite[]; bodies: Sprite[]; shadow: Sprite },
  opts: {
    x: number;
    y: number;
    size: number;
    rot: number;
    fold: number;
    layer: number;
    alpha?: number;
    shadow?: boolean;
    throw_?: number;
    d?: number; // device pixel scale
  },
) {
  const { x, y, size, rot, fold, layer } = opts;
  const alpha = opts.alpha ?? 1;
  const d = opts.d ?? 1;

  const sx = (1 - fold * 0.93) * size;
  const sy = (1 + fold * 0.12) * size;
  // wings rise as they close; the body stays put, so it reads as a hinge
  const lift = -fold * SS * 0.05 * size;

  const co = Math.cos(rot);
  const si = Math.sin(rot);
  const wa = co * sx * d;
  const wb = si * sx * d;
  const wc = -si * sy * d;
  const wd = co * sy * d;
  const lx = -si * lift;
  const ly = co * lift;

  if (opts.shadow) {
    const t = opts.throw_ ?? 1;
    ctx.globalAlpha = alpha * SHADOW_ALPHA;
    ctx.setTransform(wa, wb, wc, wd, (x + SHADOW_DX * t + lx) * d, (y + SHADOW_DY * t + ly) * d);
    ctx.drawImage(sprites.shadow.c, sprites.shadow.ox, sprites.shadow.oy);
  }

  ctx.globalAlpha = alpha * (1 - fold * 0.16);

  const wing = sprites.wings[layer];
  ctx.setTransform(wa, wb, wc, wd, (x + lx) * d, (y + ly) * d);
  ctx.drawImage(wing.c, wing.ox, wing.oy);

  const body = sprites.bodies[layer];
  const bs = size * d;
  ctx.setTransform(co * bs, si * bs, -si * bs, co * bs, x * d, y * d);
  ctx.drawImage(body.c, body.ox, body.oy);
}
