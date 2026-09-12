/**
 * The interactive figures. Every one of these drives the same sprite code the
 * loading screen does (butterfly.ts), so nothing here can quietly drift away
 * from the thing it claims to explain.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  BASE_SZ,
  cx,
  cy,
  drawButterfly,
  FOREWING,
  getSprites,
  HINDWING,
  LAYERS,
  makeBody,
  makeShadow,
  makeSilhouette,
  makeWing,
  paintBody,
  paintWings,
  SHADOW_BLUR,
  SS,
  wingPaths,
  wingPoint,
  wr,
  type Layer,
  type Sprite,
  type WingOutline,
} from '../butterfly';

import {
  Button,
  Check,
  Figure,
  Readout,
  Segmented,
  seeded,
  Slider,
  Stage,
  T,
  resetBase,
  usePointer,
  useScene,
} from './kit';

import { buildField, idleFold, makeBug, ROW_RATIO, type Bug, type Placement } from './field';

// ─── fig 03 · anatomy ─────────────────────────────────────────────────────────────
function strokeOutline(ctx: CanvasRenderingContext2D, o: WingOutline, color: string) {
  const s = wingPoint(o.start[0], o.start[1]);
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  for (const [c1, c2, e] of o.curves) {
    const a = wingPoint(c1[0], c1[1]);
    const b = wingPoint(c2[0], c2[1]);
    const p = wingPoint(e[0], e[1]);
    ctx.bezierCurveTo(a.x, a.y, b.x, b.y, p.x, p.y);
  }
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.9;
  ctx.stroke();
}

function drawHandles(ctx: CanvasRenderingContext2D, o: WingOutline, color: string) {
  let anchor = wingPoint(o.start[0], o.start[1]);

  for (const [c1, c2, e] of o.curves) {
    const a = wingPoint(c1[0], c1[1]);
    const b = wingPoint(c2[0], c2[1]);
    const p = wingPoint(e[0], e[1]);

    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(a.x, a.y);
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    for (const c of [a, b]) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 1.9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(20,24,30,0.9)';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    anchor = p;
  }
}

export function AnatomyDemo() {
  const [which, setWhich] = useState<'both' | 'fore' | 'hind'>('both');
  const [fill, setFill] = useState(true);
  const [points, setPoints] = useState(true);
  const [mirror, setMirror] = useState(false);
  const [body, setBody] = useState(false);

  const ref = useScene(({ ctx, w, h }) => {
    ctx.clearRect(0, 0, w, h);

    // fit sprite space into the stage, with room for the mirrored half
    const scale = Math.min(w / (mirror ? SS * 1.05 : SS * 0.62), h / (SS * 0.78));
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(mirror ? -cx : -cx * 1.02, -cy);

    const half = (paint: boolean) => {
      if (paint) {
        const { fw, hw } = wingPaths();
        ctx.save();
        if (which !== 'fore') {
          ctx.fillStyle = '#ffffff';
          ctx.fill(hw);
        }
        if (which !== 'hind') {
          ctx.fillStyle = '#ffffff';
          ctx.fill(fw);
        }
        ctx.restore();
        // the real paint, on top of the flat fill so partial selections still read
        ctx.save();
        ctx.beginPath();
        if (which === 'fore') ctx.clip(fw);
        else if (which === 'hind') ctx.clip(hw);
        paintWings(ctx);
        ctx.restore();
      }
      if (which !== 'fore') strokeOutline(ctx, HINDWING, '#7fd4c1');
      if (which !== 'hind') strokeOutline(ctx, FOREWING, '#f0b46b');
      if (points) {
        if (which !== 'fore') drawHandles(ctx, HINDWING, '#7fd4c1');
        if (which !== 'hind') drawHandles(ctx, FOREWING, '#f0b46b');
      }
    };

    if (mirror) {
      ctx.save();
      ctx.translate(SS, 0);
      ctx.scale(-1, 1);
      half(fill);
      ctx.restore();
    }
    half(fill);

    if (body) {
      ctx.save();
      paintBody(ctx);
      ctx.restore();
    }

    // the body axis, the line everything is symmetric about
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(cx, cy - SS * 0.46);
    ctx.lineTo(cx, cy + SS * 0.42);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  });

  return (
    <Figure
      n="2"
      title="One wing pair, twelve control points"
      hint="drag the toggles"
      controls={
        <>
          <Segmented
            label="Show"
            value={which}
            options={[
              { value: 'both', label: 'Both' },
              { value: 'fore', label: 'Forewing' },
              { value: 'hind', label: 'Hindwing' },
            ]}
            onChange={setWhich}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem 1.1rem', alignItems: 'center' }}>
            <Check label="Paint" checked={fill} onChange={setFill} />
            <Check label="Control points" checked={points} onChange={setPoints} />
            <Check label="Mirror" checked={mirror} onChange={setMirror} />
            <Check label="Body" checked={body} onChange={setBody} />
          </div>
        </>
      }
      caption={
        <>
          The whole butterfly is two closed bezier shapes and a handful of gradients. Turn on
          Mirror and the left side appears for free, because it is the same path drawn through a
          flipped transform. That symmetry is not decoration, it is what makes the flap cheap
          later on.
        </>
      }
    >
      <Stage canvasRef={ref} ratio={16 / 9} />
    </Figure>
  );
}

// ─── fig 04 · baked sprites versus live paths ─────────────────────────────────────
function drawPathButterfly(ctx: CanvasRenderingContext2D, b: Bug, fold: number) {
  const sx = (1 - fold * 0.93) * b.sz;
  const sy = (1 + fold * 0.12) * b.sz;

  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.tilt);
  ctx.scale(sx, sy);
  ctx.translate(-cx, -cy);
  paintWings(ctx);
  ctx.save();
  ctx.translate(SS, 0);
  ctx.scale(-1, 1);
  paintWings(ctx);
  ctx.restore();
  ctx.restore();

  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.tilt);
  ctx.scale(b.sz, b.sz);
  ctx.translate(-cx, -cy);
  paintBody(ctx);
  ctx.restore();
}

export function BakeDemo() {
  const [count, setCount] = useState(120);
  const [ms, setMs] = useState({ path: 0, sprite: 0 });
  const pathRef = useRef<HTMLCanvasElement | null>(null);
  const spriteRef = useRef<HTMLCanvasElement | null>(null);
  const countRef = useRef(count);
  countRef.current = count;

  useEffect(() => {
    const a = pathRef.current;
    const b = spriteRef.current;
    if (!a || !b) return;
    const ca = a.getContext('2d')!;
    const cb = b.getContext('2d')!;
    const sprites = getSprites();

    let raf = 0;
    let visible = true;
    let w = 1;
    let h = 1;
    let d = 1;
    let bugs: Bug[] = [];
    let built = 0;
    const avg = { path: [] as number[], sprite: [] as number[] };
    let lastReport = 0;

    const size = () => {
      const r = a.getBoundingClientRect();
      if (!r.width) return;
      d = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.round(r.width);
      h = Math.round(r.height);
      for (const c of [a, b]) {
        c.width = Math.round(w * d);
        c.height = Math.round(h * d);
      }
      built = 0;
    };
    size();

    const ro = new ResizeObserver(size);
    ro.observe(a);
    const io = new IntersectionObserver(e => (visible = e[0]?.isIntersecting ?? true), {
      rootMargin: '160px',
    });
    io.observe(a);

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;

      const n = countRef.current;
      if (built !== n) {
        // jittered grid, so the comparison is not muddied by random clumping
        const rnd = seeded(11);
        const cols = Math.max(2, Math.round(Math.sqrt(n * (w / Math.max(1, h)))));
        const rows = Math.max(2, Math.ceil(n / cols));
        const stepX = w / cols;
        const stepY = h / rows;
        bugs = [];
        for (let r = 0; r < rows && bugs.length < n; r++) {
          for (let c = 0; c < cols && bugs.length < n; c++) {
            const bug = makeBug(
              (c + 0.5) * stepX + (rnd() - 0.5) * stepX * 0.7,
              (r + 0.5) * stepY + (rnd() - 0.5) * stepY * 0.7,
              2,
              rnd,
            );
            bug.sz = BASE_SZ * (0.9 + rnd() * 0.25);
            bugs.push(bug);
          }
        }
        built = n;
      }

      const now = performance.now();
      const fold = idleFold(now / 1000 * 1.4, 0.5);

      // A: no sprite at all. Every wing is filled, clipped, veined and
      // gradient-shaded from scratch, every frame.
      const t1 = performance.now();
      ca.setTransform(d, 0, 0, d, 0, 0);
      ca.clearRect(0, 0, w, h);
      for (const bug of bugs) drawPathButterfly(ca, bug, fold);
      const t2 = performance.now();

      // B: the same art, painted once at startup, blitted here.
      cb.setTransform(d, 0, 0, d, 0, 0);
      cb.clearRect(0, 0, w, h);
      for (const bug of bugs) {
        drawButterfly(cb, sprites, {
          x: bug.x,
          y: bug.y,
          size: bug.sz,
          rot: bug.tilt,
          fold,
          layer: 2,
          d,
        });
      }
      const t3 = performance.now();

      avg.path.push(t2 - t1);
      avg.sprite.push(t3 - t2);
      if (avg.path.length > 24) avg.path.shift();
      if (avg.sprite.length > 24) avg.sprite.shift();

      if (now - lastReport > 240) {
        lastReport = now;
        const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
        setMs({ path: mean(avg.path), sprite: mean(avg.sprite) });
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  const ratio = ms.sprite > 0.001 ? ms.path / ms.sprite : 0;

  return (
    <Figure
      n="5"
      title="The same frame, drawn two ways"
      hint="live, in your browser"
      controls={
        <>
          <Slider
            label="Butterflies"
            value={count}
            min={20}
            max={400}
            step={10}
            onChange={setCount}
            format={v => String(Math.round(v))}
          />
          <Readout
            items={[
              ['Paths per frame', `${ms.path.toFixed(1)} ms`],
              ['Baked sprites', `${ms.sprite.toFixed(2)} ms`],
              ['Difference', ratio ? `${ratio.toFixed(0)}x` : '...'],
            ]}
          />
        </>
      }
      caption={
        <>
          Left: the wings are re-filled, re-clipped, re-veined and re-shaded for every butterfly,
          every frame. Right: identical output, painted once at startup and stamped. Both panels
          run inside the same animation frame on your machine, so the numbers are a real
          measurement rather than a claim. The real field runs several thousand at once, well past
          where this slider tops out, and it does it while also folding wings and casting shadows.
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: 'Paths, every frame', r: pathRef, ms: ms.path, warn: true },
          { label: 'Baked sprite, blitted', r: spriteRef, ms: ms.sprite, warn: false },
        ].map(p => (
          <div key={p.label}>
            <canvas
              ref={p.r}
              style={{
                display: 'block',
                width: '100%',
                aspectRatio: '4 / 3',
                borderRadius: 8,
                background: T.ground,
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                marginTop: 8,
                fontSize: '0.74rem',
                color: T.muted,
              }}
            >
              <span>{p.label}</span>
              <span style={{ fontFamily: T.mono, color: p.warn && p.ms > 16 ? '#a8583c' : T.ink }}>
                {p.ms.toFixed(2)} ms
              </span>
            </div>
          </div>
        ))}
      </div>
    </Figure>
  );
}

// ─── fig 07 · the flap ────────────────────────────────────────────────────────────
/**
 * One butterfly, large. Drawn from paths rather than from the baked sprite,
 * because a 144px sprite blown up four times is a blurry way to explain a
 * hinge. The fold maths is identical to the render loop's.
 */
function drawBigButterfly(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  fold: number,
  hinge: boolean,
) {
  const sx = (1 - fold * 0.93) * scale;
  const sy = (1 + fold * 0.12) * scale;
  const lift = hinge ? -fold * SS * 0.05 * scale : 0;

  ctx.save();
  ctx.globalAlpha = 1 - fold * 0.16;
  ctx.translate(x, y + lift);
  ctx.scale(sx, sy);
  ctx.translate(-cx, -cy);
  paintWings(ctx);
  ctx.save();
  ctx.translate(SS, 0);
  ctx.scale(-1, 1);
  paintWings(ctx);
  ctx.restore();
  ctx.restore();

  // Hinged, the body keeps its own scale and stays put. Unhinged, it gets
  // squeezed along with the wings, which is the whole point of the toggle.
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.translate(x, y);
  ctx.scale(hinge ? scale : sx, hinge ? scale : sy);
  ctx.translate(-cx, -cy);
  paintBody(ctx);
  ctx.restore();
}

export function FlapDemo() {
  const [mode, setMode] = useState<'play' | 'scrub'>('play');
  const [fold, setFold] = useState(0.35);
  const [amp, setAmp] = useState(0.88);
  const [speed, setSpeed] = useState(6);
  const [hinge, setHinge] = useState(true);
  const [curve, setCurve] = useState(true);
  const phase = useRef(0);

  const ref = useScene(({ ctx, w, h, dt }) => {
    ctx.clearRect(0, 0, w, h);

    if (mode === 'play') phase.current += dt * speed;
    const f = mode === 'play' ? amp * (1 - Math.cos(phase.current)) * 0.5 : fold;

    const plotH = curve ? Math.min(104, h * 0.32) : 0;
    const stageH = h - plotH;

    // fit the wing pair (144 x 91 in sprite units) inside the stage
    const scale = Math.min((w * 0.46) / 144, (stageH * 0.66) / 91);

    drawBigButterfly(ctx, w / 2, stageH / 2 + 6, scale, f, hinge);
    ctx.globalAlpha = 1;

    if (curve) {
      const top = stageH + 10;
      const padX = 22;
      const gw = w - padX * 2;
      const gh = plotH - 20;

      ctx.strokeStyle = 'rgba(255,255,255,0.13)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padX, top + gh);
      ctx.lineTo(padX + gw, top + gh);
      ctx.moveTo(padX, top);
      ctx.lineTo(padX + gw, top);
      ctx.stroke();

      ctx.strokeStyle = '#7fd4c1';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const p = (i / 120) * Math.PI * 4;
        const v = (1 - Math.cos(p)) * 0.5;
        const px = padX + (i / 120) * gw;
        const py = top + gh - v * gh;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();

      const norm = amp > 0 ? Math.min(1, f / amp) : 0;
      const travelled = mode === 'play' ? (phase.current % (Math.PI * 4)) / (Math.PI * 4) : norm;
      const headX = padX + travelled * gw;
      const headY = top + gh - norm * gh;
      ctx.fillStyle = '#f0b46b';
      ctx.beginPath();
      ctx.arc(headX, headY, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.font = `10px ${T.mono}`;
      ctx.fillText('shut', padX, top + 11);
      ctx.fillText('open', padX, top + gh - 5);
    }
  });

  return (
    <Figure
      n="8"
      title="Squeeze a symmetric sprite and it folds"
      hint={hinge ? 'hinged' : 'no hinge'}
      controls={
        <>
          <Segmented
            value={mode}
            options={[
              { value: 'play', label: 'Play' },
              { value: 'scrub', label: 'Scrub' },
            ]}
            onChange={setMode}
          />
          {mode === 'scrub' ? (
            <Slider label="Fold" value={fold} min={0} max={1} onChange={setFold} />
          ) : (
            <>
              <Slider label="Amplitude" value={amp} min={0.05} max={1} onChange={setAmp} />
              <Slider
                label="Beats"
                value={speed}
                min={0.6}
                max={27}
                step={0.2}
                onChange={setSpeed}
                format={v => `${(v / (Math.PI * 2)).toFixed(1)}/s`}
              />
            </>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem 1.1rem', alignItems: 'center' }}>
            <Check label="Hinge the wings only" checked={hinge} onChange={setHinge} />
            <Check label="Show the curve" checked={curve} onChange={setCurve} />
          </div>
        </>
      }
      caption={
        <>
          Scrub the fold by hand and watch the wingtips travel toward the body axis while the
          thorax stays put. Now switch the hinge off. The sprite squashes as one piece, the body
          narrows with the wings, and the whole thing reads as an insect being stepped on rather
          than an insect flying. That single separation, two sprites instead of one, is most of
          the illusion.
        </>
      }
    >
      <Stage canvasRef={ref} ratio={16 / 9} />
    </Figure>
  );
}

// ─── fig 05 · placement ───────────────────────────────────────────────────────────
export function PlacementDemo() {
  const [mode, setMode] = useState<Placement>('jitter');
  const [asPoints, setAsPoints] = useState(false);
  const [lattice, setLattice] = useState(false);
  const [coverage, setCoverage] = useState<number | null>(null);
  const dims = useRef({ w: 0, h: 0 });
  const fieldRef = useRef<Bug[]>([]);
  const builtFor = useRef('');

  const ref = useScene(({ ctx, w, h, d, t }) => {
    const sprites = getSprites();
    dims.current = { w, h };

    const key = `${mode}:${Math.round(w)}x${Math.round(h)}`;
    if (builtFor.current !== key) {
      builtFor.current = key;
      fieldRef.current = buildField(w, h, mode, [1], 7);
      setCoverage(null);
    }

    ctx.clearRect(0, 0, w, h);

    if (asPoints) {
      for (const b of fieldRef.current) {
        ctx.fillStyle = 'rgba(240,244,248,0.85)';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      for (const b of fieldRef.current) {
        drawButterfly(ctx, sprites, {
          x: b.x,
          y: b.y,
          size: b.sz,
          rot: b.tilt,
          fold: idleFold(b.ph + t * 1.4),
          layer: b.layer,
          d,
        });
      }
      resetBase(ctx, d);
    }

    if (lattice && mode === 'stagger') {
      // Join the lattice up and the diagonals the eye was already finding
      // become impossible to unsee.
      const gs = LAYERS[1].gs;
      const stepY = gs * ROW_RATIO;
      ctx.strokeStyle = 'rgba(240,180,107,0.75)';
      ctx.lineWidth = 1;
      for (let k = -20; k < 40; k++) {
        ctx.beginPath();
        ctx.moveTo(k * gs, 0);
        ctx.lineTo(k * gs + (h / stepY) * (gs * 0.5), h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(k * gs, 0);
        ctx.lineTo(k * gs - (h / stepY) * (gs * 0.5), h);
        ctx.stroke();
      }
    }
  });

  // Coverage is measured off the render, not guessed: draw the same field into
  // an offscreen buffer and count how much dark ground survives.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const { w, h } = dims.current;
      if (!w || !h) return;
      const off = document.createElement('canvas');
      off.width = Math.round(w);
      off.height = Math.round(h);
      const ctx = off.getContext('2d', { willReadFrequently: true })!;
      const sprites = getSprites();
      for (const b of fieldRef.current) {
        drawButterfly(ctx, sprites, {
          x: b.x,
          y: b.y,
          size: b.sz,
          rot: b.tilt,
          fold: idleFold(b.ph),
          layer: b.layer,
          d: 1,
        });
      }
      const data = ctx.getImageData(0, 0, off.width, off.height).data;
      let bare = 0;
      const total = off.width * off.height;
      for (let i = 3; i < data.length; i += 4) if (data[i] < 40) bare++;
      setCoverage((bare / total) * 100);
    }, 220);
    return () => window.clearTimeout(id);
  }, [mode, asPoints]);

  return (
    <Figure
      n="6"
      title="Four ways to cover a plane"
      hint="one layer, same head count"
      controls={
        <>
          <Segmented
            label="Placement"
            value={mode}
            options={[
              { value: 'scatter', label: 'Random' },
              { value: 'grid', label: 'Grid' },
              { value: 'stagger', label: 'Half-step' },
              { value: 'jitter', label: 'Jittered' },
            ]}
            onChange={setMode}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem 1.1rem', alignItems: 'center' }}>
            <Check label="Show centres only" checked={asPoints} onChange={setAsPoints} />
            <Check
              label="Trace the lattice"
              checked={lattice}
              onChange={setLattice}
            />
          </div>
          <Readout
            items={[['Bare ground', coverage === null ? 'measuring...' : `${coverage.toFixed(1)}%`]]}
          />
        </>
      }
      caption={
        <>
          Random placement clumps. That is not bad luck, it is what random looks like: gaps and
          piles are the expected result, and the bare-ground number climbs. A strict grid covers
          evenly but announces itself. The half-step stagger is the trap, because it looks
          organic until you turn on Trace the lattice and see the triangular grid it actually
          builds. Jittered keeps the grid as a guarantee of coverage and then throws every
          butterfly off its mark, which buys evenness without the pattern.
        </>
      }
    >
      <Stage canvasRef={ref} ratio={2.1} />
    </Figure>
  );
}

// ─── fig 06 · layers and tone ─────────────────────────────────────────────────────
type Tone = 'flat' | 'ship' | 'much';
const TONE_K: Record<Tone, number> = { flat: 0, ship: 1, much: 2.6 };

export function LayerDemo() {
  const [on, setOn] = useState([true, true, true]);
  const [tone, setTone] = useState<Tone>('ship');
  const [shadows, setShadows] = useState(true);
  const fieldRef = useRef<Bug[]>([]);
  const builtFor = useRef('');

  const sets = useMemo(() => {
    const k = TONE_K[tone];
    const cfgs: Layer[] = LAYERS.map(l => ({ ...l, dark: l.dark * k, light: l.light * k }));
    return {
      wings: cfgs.map(makeWing),
      bodies: cfgs.map(makeBody),
      shadow: makeShadow(makeSilhouette(), SHADOW_BLUR),
    } as { wings: Sprite[]; bodies: Sprite[]; shadow: Sprite };
  }, [tone]);

  const ref = useScene(({ ctx, w, h, d, t }) => {
    const key = `${Math.round(w)}x${Math.round(h)}`;
    if (builtFor.current !== key) {
      builtFor.current = key;
      fieldRef.current = buildField(w, h, 'jitter', [0, 1, 2], 21);
    }

    ctx.clearRect(0, 0, w, h);
    for (const b of fieldRef.current) {
      if (!on[b.layer]) continue;
      drawButterfly(ctx, sets, {
        x: b.x,
        y: b.y,
        size: b.sz,
        rot: b.tilt,
        fold: idleFold(b.ph + t * 1.4),
        layer: b.layer,
        shadow: shadows && LAYERS[b.layer].shadow,
        throw_: b.throw_,
        d,
      });
    }
    resetBase(ctx, d);
  });

  return (
    <Figure
      n="7"
      title="Three fields, stacked"
      hint="depth without blur"
      controls={
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem 1.1rem', alignItems: 'center' }}>
            {['Back', 'Middle', 'Front'].map((label, i) => (
              <Check
                key={label}
                label={label}
                checked={on[i]}
                onChange={v => setOn(prev => prev.map((p, j) => (j === i ? v : p)))}
              />
            ))}
            <Check label="Drop shadows" checked={shadows} onChange={setShadows} />
          </div>
          <Segmented
            label="Tone separation"
            value={tone}
            options={[
              { value: 'flat', label: 'None' },
              { value: 'ship', label: 'Shipped' },
              { value: 'much', label: 'Overdone' },
            ]}
            onChange={setTone}
          />
        </>
      }
      caption={
        <>
          Switch layers off one at a time and the holes appear. No single grid covers a plane
          with objects this shape, so three offset grids take turns filling each other in. Depth
          comes from tone rather than blur, which costs nothing at render time because it is
          baked into each layer's sprite. Push tone to Overdone and the back layer goes as dark
          as the ground, stops reading as a butterfly, and all that coverage is wasted.
        </>
      }
    >
      <Stage canvasRef={ref} ratio={2.1} />
    </Figure>
  );
}

// ─── fig 08 · answering the pointer ───────────────────────────────────────────────
export function HoverDemo() {
  const [radius, setRadius] = useState(150);
  const [rise, setRise] = useState(0.17);
  const [fall, setFall] = useState(0.045);
  const [hold, setHold] = useState(0.42);
  const [showReach, setShowReach] = useState(true);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pointer = usePointer(wrapRef);
  const fieldRef = useRef<Bug[]>([]);
  const modeRef = useRef<Uint8Array>(new Uint8Array(0));
  const holdRef = useRef<Float32Array>(new Float32Array(0));
  const shutRef = useRef<Float32Array>(new Float32Array(0));
  const builtFor = useRef('');
  const trace = useRef<number[]>([]);
  const watched = useRef(0);

  const ref = useScene(({ ctx, w, h, d, dt }) => {
    const sprites = getSprites();
    const key = `${Math.round(w)}x${Math.round(h)}`;
    if (builtFor.current !== key) {
      builtFor.current = key;
      const f = buildField(w, h, 'jitter', [1, 2], 33);
      fieldRef.current = f;
      modeRef.current = new Uint8Array(f.length);
      holdRef.current = new Float32Array(f.length);
      shutRef.current = new Float32Array(f.length);
      // watch whichever butterfly sits nearest the middle
      let best = 0;
      let bestD = Infinity;
      f.forEach((b, i) => {
        const dd = (b.x - w / 2) ** 2 + (b.y - h / 2) ** 2;
        if (dd < bestD) {
          bestD = dd;
          best = i;
        }
      });
      watched.current = best;
      trace.current = [];
    }

    const { x: mx, y: my, active } = pointer.current;
    ctx.clearRect(0, 0, w, h);

    if (showReach && active) {
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, radius);
      g.addColorStop(0, 'rgba(222,234,244,0.10)');
      g.addColorStop(1, 'rgba(160,190,214,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    const bugs = fieldRef.current;
    const modes = modeRef.current;
    const holds = holdRef.current;
    const shuts = shutRef.current;

    for (let i = 0; i < bugs.length; i++) {
      const b = bugs[i];
      const dist = Math.hypot(b.x - mx, b.y - my);
      const reach = dist < radius ? 1 - dist / radius : 0;
      const target = reach * reach; // squared, so the edge stays soft
      b.hover += (target - b.hover) * (target > b.hover ? rise : fall);

      let amp = 0.07 + b.hover * (0.88 - 0.07);

      if (modes[i] === 0 && b.hover > 0.5) {
        modes[i] = 1;
        holds[i] = hold;
      } else if (modes[i] !== 0 && b.hover < 0.12) {
        modes[i] = 0;
        shuts[i] = 0;
      }

      if (modes[i] === 1) {
        shuts[i] += (1 - shuts[i]) * 0.3;
        b.ph = Math.PI;
        if (shuts[i] > 0.96) {
          holds[i] -= dt;
          if (holds[i] <= 0) modes[i] = 2;
        }
        amp *= shuts[i];
      } else {
        b.ph += dt * (1.4 + b.hover * (27 - 1.4));
      }

      drawButterfly(ctx, sprites, {
        x: b.x,
        y: b.y,
        size: b.sz,
        rot: b.tilt,
        fold: amp * (1 - Math.cos(b.ph)) * 0.5,
        layer: b.layer,
        shadow: LAYERS[b.layer].shadow,
        throw_: b.throw_,
        d,
      });
    }
    resetBase(ctx, d);

    // the trace: one butterfly's hover level over the last few seconds
    const wb = bugs[watched.current];
    if (wb) {
      trace.current.push(wb.hover);
      if (trace.current.length > 240) trace.current.shift();

      ctx.strokeStyle = '#f0b46b';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(wb.x, wb.y, 15, 0, Math.PI * 2);
      ctx.stroke();

      const gw = Math.min(238, w * 0.44);
      const gh = 62;
      const gx = w - gw - 12;
      const gy = h - gh - 12;
      ctx.fillStyle = 'rgba(6,8,11,0.94)';
      ctx.fillRect(gx, gy, gw, gh);
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1;
      ctx.strokeRect(gx, gy, gw, gh);

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `9px ${T.mono}`;
      ctx.fillText('hover level, ringed butterfly', gx + 8, gy + 14);

      const plotTop = gy + 20;
      const plotH = gh - 28;
      ctx.strokeStyle = '#f0b46b';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      trace.current.forEach((v, i) => {
        const px = gx + 8 + (i / 240) * (gw - 16);
        const py = plotTop + plotH - v * plotH;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.stroke();
    }
  });

  return (
    <Figure
      n="9"
      title="Attack fast, release slow"
      hint="move a cursor or finger across it"
      controls={
        <>
          <Slider
            label="Reach"
            value={radius}
            min={50}
            max={300}
            step={5}
            onChange={setRadius}
            format={v => `${Math.round(v)}px`}
          />
          <Slider label="Rise" value={rise} min={0.01} max={0.5} step={0.005} onChange={setRise} format={v => v.toFixed(3)} />
          <Slider label="Fall" value={fall} min={0.005} max={0.5} step={0.005} onChange={setFall} format={v => v.toFixed(3)} />
          <Slider label="Hold" value={hold} min={0} max={1.2} step={0.02} onChange={setHold} format={v => `${v.toFixed(2)}s`} />
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Check label="Show reach" checked={showReach} onChange={setShowReach} />
            <Button onClick={() => setFall(rise)}>Make it symmetric</Button>
          </div>
        </>
      }
      caption={
        <>
          Sweep across and leave. The field wakes almost instantly and settles slowly, so your
          pointer drags a wake behind it. Press Make it symmetric and the wake disappears: the
          field now snaps back the moment you leave, which reads as a mask following the cursor
          instead of a thousand animals reacting to one. Drop Hold to zero and the closed pose
          stops registering, because the wings pass through it too fast to see.
        </>
      }
    >
      <div ref={wrapRef}>
        <Stage canvasRef={ref} ratio={2.1} />
      </div>
    </Figure>
  );
}

// ─── fig 09 · easing ──────────────────────────────────────────────────────────────
const CURVES: { key: string; label: string; note: string; f: (t: number) => number }[] = [
  { key: 'linear', label: 'Linear', note: 'machinery', f: t => t },
  { key: 'out', label: 'Ease out', note: 'arriving', f: t => 1 - (1 - t) ** 3 },
  { key: 'inout', label: 'Ease in and out', note: 'travelling', f: t => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2) },
  { key: 'in', label: 'Ease in (cubic)', note: 'leaving', f: t => t ** 3 },
];

export function EasingDemo() {
  const [dur, setDur] = useState(1.65);

  const ref = useScene(({ ctx, w, h, d, t }) => {
    const sprites = getSprites();
    ctx.clearRect(0, 0, w, h);

    const cycle = dur + 0.55;
    const local = t % cycle;
    const p = Math.min(1, local / dur);

    const laneW = w / CURVES.length;
    const padTop = 26;
    const padBottom = 92;
    const travel = h - padTop - padBottom;

    CURVES.forEach((c, i) => {
      const lx = laneW * i;
      const midX = lx + laneW / 2;

      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      if (i > 0) {
        ctx.beginPath();
        ctx.moveTo(lx, 12);
        ctx.lineTo(lx, h - 12);
        ctx.stroke();
      }

      // the curve itself, small, under the lane
      const gw = laneW * 0.52;
      const gh = 40;
      const gx = midX - gw / 2;
      const gy = h - padBottom + 14;
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.strokeRect(gx, gy, gw, gh);
      ctx.strokeStyle = '#7fd4c1';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let k = 0; k <= 40; k++) {
        const u = k / 40;
        const px = gx + u * gw;
        const py = gy + gh - c.f(u) * gh;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = '#f0b46b';
      ctx.beginPath();
      ctx.arc(gx + p * gw, gy + gh - c.f(p) * gh, 2.6, 0, Math.PI * 2);
      ctx.fill();

      const eased = c.f(p);
      const by = padTop + travel - eased * travel;
      const alpha = 1 - Math.max(0, (p - 0.55) / 0.45) ** 1.4;

      drawButterfly(ctx, sprites, {
        x: midX,
        y: by,
        size: BASE_SZ * 1.5,
        rot: Math.sin(t * 2.4 + i) * 0.08,
        fold: idleFold(t * 27, 0.88),
        layer: 2,
        alpha: Math.max(0, alpha),
        d,
      });
      resetBase(ctx, d);

      ctx.fillStyle = 'rgba(240,244,248,0.75)';
      ctx.font = `11px ${T.sans}`;
      ctx.textAlign = 'center';
      ctx.fillText(c.label, midX, h - 12);
      ctx.fillStyle = 'rgba(240,244,248,0.34)';
      ctx.font = `10px ${T.sans}`;
      ctx.fillText(c.note, midX, 16);
      ctx.textAlign = 'left';
    });
  });

  return (
    <Figure
      n="11"
      title="Four departures, identical distance and duration"
      controls={
        <Slider
          label="Flight time"
          value={dur}
          min={0.5}
          max={3}
          step={0.05}
          onChange={setDur}
          format={v => `${v.toFixed(2)}s`}
        />
      }
      caption={
        <>
          Every lane covers the same ground in the same time. Linear reads as a machine part
          because nothing in the physical world moves at a constant speed from a standing start.
          Ease out is the shape of arriving, so it makes the butterfly look like it is settling
          onto something above the frame. The release uses the fourth one, cubic ease in, because
          something leaving under its own power starts slow and gains on you.
        </>
      }
    >
      <Stage canvasRef={ref} ratio={2.4} />
    </Figure>
  );
}

// ─── fig 10 · the release ─────────────────────────────────────────────────────────
const BAND_PX = 52;
const CONTACT_BANDS = 1;
const POKE_STEP = 0.6;
const PHASE_GAP = 0.25;
const ROLL_LAYER_STEP = 0.09;
const DIST_STEP = 0.045;
const SLOW_STEP = 0.2;
const SLOW_RINGS = 5;
const FD = 1.65;
const STARTLE_LEAD = 1.5;
const ALARM_LEAD = 0.6;
const FLY_UP = 2600;
const FLY_OUT = 620;

export function ReleaseDemo() {
  const [wave, setWave] = useState(2);
  const [stragglers, setStragglers] = useState(true);
  const [contact, setContact] = useState(true);
  const [overlay, setOverlay] = useState(true);
  const [scrub, setScrub] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [span, setSpan] = useState(4);

  const fieldRef = useRef<Bug[]>([]);
  const builtFor = useRef('');
  const origin = useRef({ x: 0, y: 0 });
  const ringsRef = useRef<number[]>([]);
  const clock = useRef(0);
  const playRef = useRef(playing);
  playRef.current = playing;

  const release = (ox: number, oy: number, w: number, h: number) => {
    const bugs = fieldRef.current;
    const rnd = seeded(99);
    const back = LAYERS.length - 1;
    origin.current = { x: ox, y: oy };

    let maxRing = 0;
    for (const b of bugs) {
      b.band = Math.floor(Math.hypot(b.x - ox, b.y - oy) / BAND_PX);
      if (b.band > maxRing) maxRing = b.band;
      const away = Math.max(-1, Math.min(1, (b.x - ox) / (w * 0.5)));
      b.spread = away * 0.75 + (rnd() - 0.5) * 0.7;
    }

    // cumulative ring clock: slow to start, easing up to full cadence
    const ring = [0];
    for (let k = 1; k <= maxRing; k++) {
      const e = Math.min(1, (k - 1) / SLOW_RINGS);
      ring[k] = ring[k - 1] + SLOW_STEP + (DIST_STEP - SLOW_STEP) * e;
    }
    ringsRef.current = ring;

    const contactBands = contact ? CONTACT_BANDS : 0;
    const rollStart = contact ? back * POKE_STEP + PHASE_GAP : 0;
    const edge = ring[Math.min(contactBands, maxRing)] ?? 0;

    let maxDelay = 0;
    for (const b of bugs) {
      const depth = back - b.layer;
      const reluctance = Math.min(1, b.band / 6);
      const lag = stragglers && rnd() < 0.3 * reluctance ? rnd() ** 2 * 0.2 * reluctance : 0;
      const delay =
        b.band < contactBands
          ? ring[b.band] + depth * POKE_STEP
          : rollStart + (ring[b.band] - edge + depth * ROLL_LAYER_STEP + lag) * wave;
      b.fStart = delay + rnd() * 0.03;
      if (delay > maxDelay) maxDelay = delay;
    }

    setSpan(maxDelay + FD);
    clock.current = 0;
    setScrub(0);
    setPlaying(true);
  };

  const ref = useScene(({ ctx, w, h, d, dt }) => {
    const sprites = getSprites();
    const key = `${Math.round(w)}x${Math.round(h)}`;
    if (builtFor.current !== key) {
      builtFor.current = key;
      fieldRef.current = buildField(w, h, 'jitter', [0, 1, 2], 55);
      origin.current = { x: w / 2, y: h * 0.55 };
    }

    if (playRef.current) {
      clock.current = Math.min(span, clock.current + dt);
      if (clock.current >= span) setPlaying(false);
      if (Math.abs(clock.current - scrub) > 0.016) setScrub(clock.current);
    } else {
      clock.current = scrub;
    }
    const now = clock.current;

    ctx.clearRect(0, 0, w, h);

    for (const b of fieldRef.current) {
      const el = now - b.fStart;
      let x = b.x;
      let y = b.y;
      let rot = b.tilt;
      let alpha = 1;
      let amp: number;

      if (el < 0) {
        // wind-up, measured backwards from this butterfly's own launch
        amp = el > -ALARM_LEAD ? 0.92 : el > -STARTLE_LEAD ? 0.4 : 0.07;
        b.ph += 0.016 * (1.4 + (amp / 0.92) * 25);
      } else {
        const p = Math.min(el / FD, 1);
        if (p >= 1) continue;
        const ease = p * p * p;
        y = b.y - FLY_UP * b.rise * ease - 46 * p;
        x = b.x + b.spread * FLY_OUT * ease + Math.sin(now * 2.4 + b.sway) * 16 * p;
        rot = b.tilt + b.spread * 0.42 * ease + Math.sin(now * 2.4 + b.sway) * 0.06;
        alpha = 1 - Math.max(0, (p - 0.3) / 0.7) ** 1.4;
        b.ph += 0.016 * 31;
        amp = 0.88;
      }

      if (alpha < 0.012 || y < -120 || x < -120 || x > w + 120) continue;

      drawButterfly(ctx, sprites, {
        x,
        y,
        size: b.sz,
        rot,
        fold: amp * (1 - Math.cos(b.ph)) * 0.5,
        layer: b.layer,
        alpha,
        shadow: el < 0 && LAYERS[b.layer].shadow,
        throw_: b.throw_,
        d,
      });
    }
    resetBase(ctx, d);

    if (overlay) {
      const ring = ringsRef.current;
      const { x: ox, y: oy } = origin.current;

      // which shell is leaving right now, and which are winding up
      let front = -1;
      let alarm = -1;
      let startle = -1;
      const contactBands = contact ? CONTACT_BANDS : 0;
      const rollStart = contact ? (LAYERS.length - 1) * POKE_STEP + PHASE_GAP : 0;
      const edge = ring[Math.min(contactBands, ring.length - 1)] ?? 0;
      for (let k = 0; k < ring.length; k++) {
        const delay =
          k < contactBands ? ring[k] : rollStart + (ring[k] - edge) * wave;
        if (delay <= now) front = k;
        if (delay <= now + ALARM_LEAD) alarm = k;
        if (delay <= now + STARTLE_LEAD) startle = k;
      }

      const circle = (k: number, color: string, dash: number[]) => {
        if (k < 0) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.arc(ox, oy, (k + 1) * BAND_PX, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      };

      circle(startle, 'rgba(127,212,193,0.4)', [2, 6]);
      circle(alarm, 'rgba(240,180,107,0.65)', [6, 5]);
      circle(front, 'rgba(255,255,255,0.85)', []);

      const armed = ringsRef.current.length > 0;
      const inPoke = armed && contact && now < rollStart;
      ctx.fillStyle = 'rgba(8,10,13,0.9)';
      ctx.fillRect(10, 10, 196, 72);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.strokeRect(10, 10, 196, 72);
      ctx.font = `11px ${T.sans}`;
      ctx.fillStyle = inPoke ? '#f0b46b' : 'rgba(255,255,255,0.4)';
      ctx.fillText('1 · contact, down the stack', 20, 31);
      ctx.fillStyle = armed && !inPoke ? '#f0b46b' : 'rgba(255,255,255,0.4)';
      ctx.fillText('2 · alarm, rolling outward', 20, 50);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `10px ${T.mono}`;
      ctx.fillText(armed ? `t = ${now.toFixed(2)}s` : 'waiting for a tap', 20, 70);
    }
  });

  return (
    <Figure
      n="12"
      title="The release, one shell at a time"
      hint="tap the field to set off a new one"
      controls={
        <>
          <Slider
            label="Scrub"
            value={scrub}
            min={0}
            max={span}
            step={0.01}
            onChange={v => {
              setPlaying(false);
              setScrub(v);
            }}
            format={v => `${v.toFixed(2)}s`}
          />
          <Slider label="Wave scale" value={wave} min={0.5} max={5} step={0.1} onChange={setWave} format={v => `${v.toFixed(1)}x`} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem 1.1rem', alignItems: 'center' }}>
            <Check label="Contact phase" checked={contact} onChange={setContact} />
            <Check label="Stragglers" checked={stragglers} onChange={setStragglers} />
            <Check label="Overlay" checked={overlay} onChange={setOverlay} />
            <Button
              tone="solid"
              onClick={() => {
                // Nothing released yet, so Play means "set one off from the middle".
                if (!ringsRef.current.length) {
                  const el = ref.current;
                  if (el) {
                    const r = el.getBoundingClientRect();
                    release(r.width / 2, r.height * 0.55, r.width, r.height);
                    return;
                  }
                }
                setPlaying(p => !p);
              }}
            >
              {playing ? 'Pause' : 'Play'}
            </Button>
          </div>
        </>
      }
      caption={
        <>
          The solid ring is the clearing front, the dashed amber ring is the band already beating
          hard, and the faint teal ring is the band that has only just noticed. Those two always
          run ahead of the front, which is why the gap between the two phases reads as tension
          rather than as a stall. Turn the contact phase off and the poke down through the stack
          disappears, so the whole thing becomes one flat ripple. Turn stragglers off and every
          ring leaves as a single clean block, which is the moment it stops looking alive.
        </>
      }
    >
      <Stage
        canvasRef={ref}
        ratio={2.1}
        onPointerDown={e => {
          const el = e.currentTarget;
          const r = el.getBoundingClientRect();
          release(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
        }}
      />
    </Figure>
  );
}

// ─── fig 01 · the wait ────────────────────────────────────────────────────────────
export function WaitDemo() {
  const [run, setRun] = useState<'idle' | 'plain' | 'alive'>('idle');
  const [done, setDone] = useState<{ plain?: number; alive?: number }>({});
  const started = useRef(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pointer = usePointer(wrapRef);
  const fieldRef = useRef<Bug[]>([]);
  const builtFor = useRef('');
  const WAIT = 6;

  useEffect(() => {
    if (run === 'idle') return;
    started.current = performance.now();
    const id = window.setTimeout(() => {
      const secs = (performance.now() - started.current) / 1000;
      setDone(d => ({ ...d, [run]: secs }));
      setRun('idle');
    }, WAIT * 1000);
    return () => window.clearTimeout(id);
  }, [run]);

  const ref = useScene(({ ctx, w, h, d, t, dt }) => {
    const sprites = getSprites();
    ctx.clearRect(0, 0, w, h);

    if (run === 'plain') {
      const p = Math.min(1, (performance.now() - started.current) / (WAIT * 1000));
      const bw = Math.min(280, w * 0.6);
      const bx = (w - bw) / 2;
      const by = h / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(bx, by, bw, 3);
      ctx.fillStyle = 'rgba(236,240,244,0.8)';
      ctx.fillRect(bx, by, bw * p, 3);
      ctx.fillStyle = 'rgba(236,240,244,0.5)';
      ctx.font = `11px ${T.sans}`;
      ctx.textAlign = 'center';
      ctx.fillText('Loading', w / 2, by - 14);
      ctx.textAlign = 'left';
      return;
    }

    const key = `${Math.round(w)}x${Math.round(h)}`;
    if (builtFor.current !== key) {
      builtFor.current = key;
      fieldRef.current = buildField(w, h, 'jitter', [1, 2], 41);
    }

    const { x: mx, y: my } = pointer.current;
    for (const b of fieldRef.current) {
      const dist = Math.hypot(b.x - mx, b.y - my);
      const reach = dist < 140 ? 1 - dist / 140 : 0;
      const target = reach * reach;
      b.hover += (target - b.hover) * (target > b.hover ? 0.17 : 0.045);
      b.ph += dt * (1.4 + b.hover * 25);
      const amp = 0.07 + b.hover * 0.8;
      drawButterfly(ctx, sprites, {
        x: b.x,
        y: b.y,
        size: b.sz,
        rot: b.tilt,
        fold: amp * (1 - Math.cos(b.ph)) * 0.5,
        layer: b.layer,
        shadow: LAYERS[b.layer].shadow,
        throw_: b.throw_,
        d,
      });
    }
    resetBase(ctx, d);

    if (run === 'idle' && !done.alive) {
      ctx.fillStyle = 'rgba(8,10,13,0.55)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(236,240,244,0.6)';
      ctx.font = `11px ${T.sans}`;
      ctx.textAlign = 'center';
      ctx.fillText('press a button below', w / 2, h / 2);
      ctx.textAlign = 'left';
    }
    void t;
  }, true);

  return (
    <Figure
      n="1"
      title="Two six-second waits"
      hint="run both, then compare"
      controls={
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
            <Button tone="solid" onClick={() => setRun('plain')}>
              Run the empty wait
            </Button>
            <Button tone="solid" onClick={() => setRun('alive')}>
              Run the occupied wait
            </Button>
          </div>
          <Readout
            items={[
              ['Empty', done.plain ? `${done.plain.toFixed(1)}s` : 'not run'],
              ['Occupied', done.alive ? `${done.alive.toFixed(1)}s` : 'not run'],
            ]}
          />
        </>
      }
      caption={
        <>
          Both waits are exactly six seconds, and the readout proves it after you have sat
          through each. The occupied one is shorter in the only place that matters. This is the
          oldest finding in queue psychology, usually credited to David Maister: occupied time
          feels shorter than unoccupied time, and uncertain waits feel longer than known ones.
          A loading screen cannot make the network faster, so the only variable left is what the
          person does with the wait.
        </>
      }
    >
      <div ref={wrapRef}>
        <Stage canvasRef={ref} ratio={2.6} />
      </div>
    </Figure>
  );
}

// ─── fig 12 · resolution ──────────────────────────────────────────────────────────
export function ResolutionDemo() {
  const [cap, setCap] = useState(1.25);
  const [viewport, setViewport] = useState(390 * 844);

  const ref = useScene(({ ctx, w, h }) => {
    const sprites = getSprites();
    ctx.clearRect(0, 0, w, h);

    // render one butterfly into a buffer at the chosen ratio, then blow it up
    // with smoothing off so the actual sample density is visible
    const bw = Math.max(8, Math.round(120 * cap));
    const bh = Math.max(8, Math.round(90 * cap));
    const off = document.createElement('canvas');
    off.width = bw;
    off.height = bh;
    const octx = off.getContext('2d')!;
    drawButterfly(octx, sprites, {
      x: 60,
      y: 45,
      size: BASE_SZ * 1.55,
      rot: -0.06,
      fold: 0.12,
      layer: 2,
      d: cap,
    });

    const scale = Math.min(w / 120, h / 90) * 0.95;
    const dw = 120 * scale;
    const dh = 90 * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, (w - dw) / 2, (h - dh) / 2, dw, dh);
    ctx.imageSmoothingEnabled = true;
  });

  const px = Math.round(viewport * cap * cap);
  const base = Math.round(viewport * 1.25 * 1.25);

  return (
    <Figure
      n="15"
      title="What a device pixel ratio cap actually costs"
      hint="magnified, smoothing off"
      controls={
        <>
          <Slider label="DPR cap" value={cap} min={0.5} max={3} step={0.05} onChange={setCap} format={v => `${v.toFixed(2)}x`} />
          <Segmented
            label="Viewport"
            value={String(viewport)}
            options={[
              { value: String(390 * 844), label: 'iPhone' },
              { value: String(834 * 1194), label: 'Tablet' },
              { value: String(1512 * 982), label: 'Laptop' },
            ]}
            onChange={v => setViewport(Number(v))}
          />
          <Readout
            items={[
              ['Backing store', `${(px / 1e6).toFixed(2)}M px`],
              ['Relative fill cost', `${(px / base).toFixed(2)}x`],
            ]}
          />
        </>
      }
      caption={
        <>
          Fill cost scales with the square of the ratio, so going from 1.25 to 2.5 does not
          double the work, it quadruples it. On artwork this soft, the extra samples buy very
          little: slide up past 2 and look for what actually improved. That is the trade the
          loading screen makes when it caps the ratio on touch devices.
        </>
      }
    >
      <Stage canvasRef={ref} ratio={2.4} dark />
    </Figure>
  );
}
