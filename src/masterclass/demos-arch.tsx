/**
 * The two architecture figures, plus the live head count.
 *
 * Kept apart from demos.tsx because these three are about how the frame is
 * assembled rather than about what a butterfly looks like.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  drawButterfly,
  getSprites,
  LAYERS,
  makeGlow,
  makeGround,
  makeVignette,
  paintBody,
  paintWings,
  SHADOW_ALPHA,
  SHADOW_DX,
  SHADOW_DY,
  SS,
  type Sprite,
} from '../butterfly';

import { buildField, fieldCount, idleFold, type Bug } from './field';
import {
  Check,
  Figure,
  Readout,
  Segmented,
  seeded,
  Slider,
  Stage,
  T,
  usePointer,
  useScene,
} from './kit';

// ─── one butterfly as a single image, so both renderers do equal work ─────────
let composedCache: { canvas: HTMLCanvasElement; url: string; size: number } | null = null;

function getComposed() {
  if (!composedCache) {
    const scale = 0.5;
    const size = Math.round(SS * scale);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    paintWings(ctx);
    ctx.save();
    ctx.translate(SS, 0);
    ctx.scale(-1, 1);
    paintWings(ctx);
    ctx.restore();
    paintBody(ctx);
    composedCache = { canvas, url: canvas.toDataURL(), size };
  }
  return composedCache;
}

// ─── fig 02 · why not the DOM ─────────────────────────────────────────────────────
export function DomVsCanvasDemo() {
  const [mode, setMode] = useState<'canvas' | 'dom'>('canvas');
  const [count, setCount] = useState(400);
  const [fps, setFps] = useState<{ canvas: number | null; dom: number | null }>({
    canvas: null,
    dom: null,
  });

  const composed = useMemo(getComposed, []);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 640, h: 300 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const size = () => {
      const r = el.getBoundingClientRect();
      if (r.width) setBox({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // one fixed layout, shared by both renderers
  const bugs = useMemo(() => {
    const rnd = seeded(5);
    const cols = Math.max(2, Math.round(Math.sqrt(count * (box.w / Math.max(1, box.h)))));
    const rows = Math.max(2, Math.ceil(count / cols));
    const out: { x: number; y: number; rot: number; ph: number; sz: number }[] = [];
    for (let r = 0; r < rows && out.length < count; r++) {
      for (let c = 0; c < cols && out.length < count; c++) {
        out.push({
          x: ((c + 0.5) / cols) * box.w + (rnd() - 0.5) * (box.w / cols) * 0.7,
          y: ((r + 0.5) / rows) * box.h + (rnd() - 0.5) * (box.h / rows) * 0.7,
          rot: (rnd() - 0.5) * 0.46,
          ph: rnd() * Math.PI * 2,
          sz: 0.62 + rnd() * 0.16,
        });
      }
    }
    return out;
  }, [count, box.w, box.h]);

  // Only the selected renderer runs, so neither number is diluted by the other
  // competing for the same thread.
  const meter = useRef({ frames: 0, since: 0, mode });
  meter.current.mode = mode;

  const tickMeter = () => {
    const m = meter.current;
    const now = performance.now();
    if (!m.since) m.since = now;
    m.frames++;
    if (now - m.since >= 500) {
      const value = (m.frames * 1000) / (now - m.since);
      const which = m.mode;
      m.frames = 0;
      m.since = now;
      setFps(f => ({ ...f, [which]: value }));
    }
  };

  useEffect(() => {
    meter.current.frames = 0;
    meter.current.since = 0;
  }, [mode, count]);

  const canvasRef = useScene(({ ctx, w, h, d, t }) => {
    ctx.clearRect(0, 0, w, h);
    const img = composed.canvas;
    const half = composed.size / 2;
    for (const b of bugs) {
      const fold = 0.5 * (1 - Math.cos(b.ph + t * 6)) * 0.5;
      const sx = (1 - fold * 0.93) * b.sz;
      const co = Math.cos(b.rot);
      const si = Math.sin(b.rot);
      ctx.setTransform(co * sx * d, si * sx * d, -si * b.sz * d, co * b.sz * d, b.x * d, b.y * d);
      ctx.drawImage(img, -half, -half);
    }
    ctx.setTransform(d, 0, 0, d, 0, 0);
    tickMeter();
  }, mode === 'canvas');

  // The DOM path: React reconciles one element per butterfly, every frame.
  // Parked when the figure is off screen, or a heavy setting would keep
  // chewing the main thread while you read three chapters further down.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (mode !== 'dom') return;
    const el = wrapRef.current;
    let visible = true;
    const io = el
      ? new IntersectionObserver(e => (visible = e[0]?.isIntersecting ?? true), { rootMargin: '160px' })
      : null;
    if (el && io) io.observe(el);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      setTick(performance.now() / 1000);
      tickMeter();
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const msOf = (v: number | null) => (v ? 1000 / v : null);
  const canvasMs = msOf(fps.canvas);
  const domMs = msOf(fps.dom);
  const ratio = canvasMs && domMs ? domMs / canvasMs : null;
  const half = composed.size / 2;

  return (
    <Figure
      n="3"
      title="The same butterflies, as DOM and as canvas"
      hint="one runs at a time, so the numbers are honest"
      controls={
        <>
          <Segmented
            label="Renderer"
            value={mode}
            options={[
              { value: 'canvas', label: 'Canvas' },
              { value: 'dom', label: 'DOM elements' },
            ]}
            onChange={setMode}
          />
          <Slider
            label="Butterflies"
            value={count}
            min={40}
            max={2000}
            step={40}
            onChange={setCount}
            format={v => String(Math.round(v))}
          />
          <Readout
            items={[
              ['Canvas', canvasMs ? `${canvasMs.toFixed(1)} ms/frame` : 'not run'],
              ['DOM', domMs ? `${domMs.toFixed(1)} ms/frame` : 'not run'],
              ['Elements on stage', mode === 'dom' ? count.toLocaleString() : '1'],
              ['Difference', ratio ? `${ratio.toFixed(1)}x` : 'run both'],
            ]}
          />
        </>
      }
      caption={
        <>
          Both renderers place, rotate and squeeze the same butterflies from the same image. The
          only difference is where the work lands. Canvas issues draw calls into one element. The
          DOM version asks React to reconcile one element per butterfly and the browser to restyle
          and composite all of them, every frame. Run each once at a low count, then drag the
          slider toward two thousand and run them again. A frame has 16.7 milliseconds in it, and
          canvas will sit at that number long after the DOM version has left it behind. The real
          field is in this range on any normal display.
        </>
      }
    >
      <div ref={wrapRef} style={{ position: 'relative', width: '100%', aspectRatio: '2.1' }}>
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: 'block',
            borderRadius: 8,
            background: T.ground,
            visibility: mode === 'canvas' ? 'visible' : 'hidden',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 8,
            background: T.ground,
            overflow: 'hidden',
            visibility: mode === 'dom' ? 'visible' : 'hidden',
          }}
        >
          {mode === 'dom' &&
            bugs.map((b, i) => {
              const fold = 0.5 * (1 - Math.cos(b.ph + tick * 6)) * 0.5;
              const squeeze = 1 - fold * 0.93;
              return (
                <img
                  key={i}
                  src={composed.url}
                  alt=""
                  draggable={false}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: composed.size,
                    height: composed.size,
                    transform: `translate(${b.x - half}px, ${b.y - half}px) rotate(${b.rot}rad) scale(${b.sz}) scaleX(${squeeze})`,
                  }}
                />
              );
            })}
        </div>
      </div>
    </Figure>
  );
}

// ─── fig 11 · anatomy of a frame ──────────────────────────────────────────────────
type ShadowMode = 'none' | 'front' | 'all';

/** The textbook transform chain, for comparison against the composed one. */
function drawViaSaveRestore(
  ctx: CanvasRenderingContext2D,
  sprites: { wings: Sprite[]; bodies: Sprite[]; shadow: Sprite },
  b: Bug,
  fold: number,
  d: number,
) {
  const sx = (1 - fold * 0.93) * b.sz;
  const sy = (1 + fold * 0.12) * b.sz;
  const lift = -fold * SS * 0.05 * b.sz;

  ctx.save();
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.translate(b.x, b.y);
  ctx.rotate(b.tilt);
  ctx.translate(0, lift);
  ctx.scale(sx, sy);
  const wing = sprites.wings[b.layer];
  ctx.globalAlpha = 1 - fold * 0.16;
  ctx.drawImage(wing.c, wing.ox, wing.oy);
  ctx.restore();

  ctx.save();
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.translate(b.x, b.y);
  ctx.rotate(b.tilt);
  ctx.scale(b.sz, b.sz);
  const body = sprites.bodies[b.layer];
  ctx.drawImage(body.c, body.ox, body.oy);
  ctx.restore();
}

const STAGE_LABELS: [string, string][] = [
  ['ground', 'ground'],
  ['shadows', 'shadows'],
  ['back', 'back'],
  ['mid', 'middle'],
  ['front', 'front'],
  ['glow', 'glow'],
  ['vignette', 'vignette'],
];

export function FrameDemo() {
  const [on, setOn] = useState({
    ground: true,
    back: true,
    mid: true,
    front: true,
    glow: true,
    vig: true,
  });
  const [shadows, setShadows] = useState<ShadowMode>('front');
  const [handComposed, setHandComposed] = useState(true);
  const [cost, setCost] = useState<Record<string, number>>({});

  const fieldRef = useRef<Bug[]>([]);
  const washRef = useRef<{
    ground: HTMLCanvasElement;
    vig: HTMLCanvasElement;
    glow: HTMLCanvasElement;
  } | null>(null);
  const builtFor = useRef('');
  const acc = useRef<Record<string, number[]>>({});
  const lastReport = useRef(0);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pointer = usePointer(wrapRef);

  const ref = useScene(({ ctx, w, h, d, t }) => {
    const sprites = getSprites();
    const key = `${Math.round(w)}x${Math.round(h)}x${d}`;
    if (builtFor.current !== key) {
      builtFor.current = key;
      fieldRef.current = buildField(w, h, 'jitter', [0, 1, 2], 77);
      washRef.current = {
        ground: makeGround(Math.round(w * d), Math.round(h * d)),
        vig: makeVignette(Math.round(w * d), Math.round(h * d)),
        glow: makeGlow(Math.round(150 * d)),
      };
    }
    const wash = washRef.current!;
    const bugs = fieldRef.current;

    const push = (name: string, ms: number) => {
      const xs = (acc.current[name] ??= []);
      xs.push(ms);
      if (xs.length > 20) xs.shift();
    };
    const time = (name: string, fn: () => void) => {
      const a = performance.now();
      fn();
      push(name, performance.now() - a);
    };

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w * d, h * d);

    time('ground', () => {
      if (on.ground) ctx.drawImage(wash.ground, 0, 0);
    });

    const shadowPass = (L: number) => {
      for (const b of bugs) {
        if (b.layer !== L) continue;
        const fold = idleFold(b.ph + t * 1.4);
        const sx = (1 - fold * 0.93) * b.sz;
        const sy = (1 + fold * 0.12) * b.sz;
        const co = Math.cos(b.tilt);
        const si = Math.sin(b.tilt);
        ctx.globalAlpha = SHADOW_ALPHA;
        ctx.setTransform(
          co * sx * d,
          si * sx * d,
          -si * sy * d,
          co * sy * d,
          (b.x + SHADOW_DX * b.throw_) * d,
          (b.y + SHADOW_DY * b.throw_) * d,
        );
        ctx.drawImage(sprites.shadow.c, sprites.shadow.ox, sprites.shadow.oy);
      }
      ctx.globalAlpha = 1;
    };

    const bodyPass = (L: number) => {
      for (const b of bugs) {
        if (b.layer !== L) continue;
        const fold = idleFold(b.ph + t * 1.4);
        if (handComposed) {
          drawButterfly(ctx, sprites, {
            x: b.x,
            y: b.y,
            size: b.sz,
            rot: b.tilt,
            fold,
            layer: b.layer,
            d,
          });
        } else {
          drawViaSaveRestore(ctx, sprites, b, fold, d);
        }
      }
    };

    const wantsShadow = (L: number) => shadows === 'all' || (shadows === 'front' && LAYERS[L].shadow);

    let shadowMs = 0;
    const layers: [number, 'back' | 'mid' | 'front'][] = [
      [0, 'back'],
      [1, 'mid'],
      [2, 'front'],
    ];
    for (const [L, flag] of layers) {
      if (!on[flag]) continue;
      if (wantsShadow(L)) {
        const a = performance.now();
        shadowPass(L);
        shadowMs += performance.now() - a;
      }
      time(flag, () => bodyPass(L));
    }
    push('shadows', shadowMs);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;

    time('glow', () => {
      if (on.glow && pointer.current.active) {
        ctx.drawImage(
          wash.glow,
          Math.round((pointer.current.x - 150) * d),
          Math.round((pointer.current.y - 150) * d),
        );
      }
    });
    time('vignette', () => {
      if (on.vig) ctx.drawImage(wash.vig, 0, 0);
    });

    const now = performance.now();
    if (now - lastReport.current > 260) {
      lastReport.current = now;
      const out: Record<string, number> = {};
      for (const [k, xs] of Object.entries(acc.current)) {
        out[k] = xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
      }
      setCost(out);
    }
  });

  const total = STAGE_LABELS.reduce((s, [k]) => s + (cost[k] ?? 0), 0);

  return (
    <Figure
      n="14"
      title="One frame, stage by stage"
      hint="hover the stage to bring the glow in"
      controls={
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem 1.1rem', alignItems: 'center' }}>
            {(
              [
                ['ground', 'Ground'],
                ['back', 'Back'],
                ['mid', 'Middle'],
                ['front', 'Front'],
                ['glow', 'Glow'],
                ['vig', 'Vignette'],
              ] as ['ground' | 'back' | 'mid' | 'front' | 'glow' | 'vig', string][]
            ).map(([k, label]) => (
              <Check
                key={k}
                label={label}
                checked={on[k]}
                onChange={v => setOn(s => ({ ...s, [k]: v }))}
              />
            ))}
          </div>
          <Segmented
            label="Shadows"
            value={shadows}
            options={[
              { value: 'none', label: 'None' },
              { value: 'front', label: 'Front only' },
              { value: 'all', label: 'Every layer' },
            ]}
            onChange={setShadows}
          />
          <Check label="Compose transforms by hand" checked={handComposed} onChange={setHandComposed} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: '1 1 260px', minWidth: 220 }}>
            {STAGE_LABELS.map(([key, label]) => {
              const ms = cost[key] ?? 0;
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.73rem' }}>
                  <span style={{ width: 62, color: T.muted }}>{label}</span>
                  <span style={{ flex: 1, height: 7, background: T.paperSunk, borderRadius: 4, overflow: 'hidden' }}>
                    <span
                      style={{
                        display: 'block',
                        height: '100%',
                        borderRadius: 4,
                        background: T.accent,
                        width: `${total > 0 ? Math.min(100, (ms / total) * 100) : 0}%`,
                        transition: 'width 220ms ease',
                      }}
                    />
                  </span>
                  <span style={{ fontFamily: T.mono, color: T.ink, width: 42, textAlign: 'right' }}>
                    {ms.toFixed(2)}
                  </span>
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 8, fontSize: '0.73rem', marginTop: 3 }}>
              <span style={{ width: 62, color: T.ink }}>frame</span>
              <span style={{ fontFamily: T.mono, color: total > 16 ? '#a8583c' : T.ink }}>
                {total.toFixed(2)} ms of the 16.7 available
              </span>
            </div>
          </div>
        </>
      }
      caption={
        <>
          The whole frame, in order, with each stage measured on your machine. Ground first, then
          the three fields back to front, then the glow that follows the pointer, then the
          vignette over everything. Switch shadows to Every layer and watch that row grow for a
          difference you cannot see, which is why only the front layer casts one. Turn off
          Compose transforms by hand and every sprite goes back to a save, translate, rotate,
          scale, restore chain: same picture, more state-stack traffic.
        </>
      }
    >
      {/* transparent, so switching the ground off actually shows you something */}
      <div ref={wrapRef}>
        <Stage canvasRef={ref} ratio={2.1} style={{ background: 'transparent' }} />
      </div>
    </Figure>
  );
}

// ─── a live count for the reader's own screen ─────────────────────────────────
export function FieldCount() {
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const read = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);

  const per = fieldCount(size.w, size.h);
  const total = per.reduce((s, n) => s + n, 0);

  return (
    <div
      style={{
        margin: '2rem 0',
        padding: '1.2rem 1.3rem',
        background: T.card,
        border: `1px solid ${T.rule}`,
        borderRadius: 12,
      }}
    >
      <div
        style={{
          fontSize: '0.63rem',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: T.faint,
          marginBottom: '0.8rem',
        }}
      >
        On this screen, right now
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem 2.2rem', alignItems: 'baseline' }}>
        <div>
          <span style={{ fontFamily: T.serif, fontSize: '2.2rem', color: T.ink, lineHeight: 1 }}>
            {total.toLocaleString()}
          </span>
          <span style={{ fontSize: '0.82rem', color: T.muted, marginLeft: 9 }}>butterflies</span>
        </div>
        <Readout
          items={[
            ['Viewport', `${size.w} x ${size.h}`],
            ['Back / middle / front', per.map(n => n.toLocaleString()).join(' / ')],
            ['Sprite draws per frame', (total * 2 + (per[2] ?? 0)).toLocaleString()],
          ]}
        />
      </div>
      <p style={{ margin: '1rem 0 0', fontSize: '0.84rem', lineHeight: 1.65, color: T.muted }}>
        Resize the window and this number moves, because the field is built from a fixed pixel
        pitch rather than a fixed head count. A phone in portrait gets a few hundred. A large
        desktop display gets the better part of eight thousand, each one drawn twice a frame.
      </p>
    </div>
  );
}
