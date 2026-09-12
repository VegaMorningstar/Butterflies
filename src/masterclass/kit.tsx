/**
 * Shared furniture for the course: canvas plumbing, controls, and the small
 * set of typographic pieces every chapter is assembled from.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

import { scenesPaused } from '../scenePause';
import { REFERENCES, refNumber } from './references';

// ─── tokens ───────────────────────────────────────────────────────────────────
// Aged chart stock: warm paper, iron-gall ink, a rust red for plate numbers and
// a sea teal for everything secondary. The dark grounds inside figures stay the
// colour the real field is drawn on, so the plates read as windows onto the
// actual artwork rather than as illustrations of it.
export const T = {
  paper: '#efe7d5',
  paperSunk: '#e5dbc2',
  card: '#f5efe0',
  rule: '#c8ba9b',
  ruleSoft: '#d9cfb4',
  ink: '#17262c',
  body: '#38474d',
  muted: '#6a787b',
  faint: '#9aa69f',
  accent: '#8c3a22',
  accentSoft: '#e6dbc2',
  sea: '#2c5f66',
  dark: '#17262c',
  ground: '#0b0e12',
  mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
  serif: "'Fraunces', Georgia, serif",
  sans: "'Outfit', system-ui, sans-serif",
};

/**
 * Chromatic aberration, as a text shadow.
 *
 * Physically this is a lens artefact, but on a printed chart the same red and
 * cyan fringing comes from plates that did not quite register. Either way the
 * eye reads it as "reproduced by an imperfect process", which is the whole
 * point of using it here.
 */
export function chrom(strength = 1) {
  const hard = (1.4 * strength).toFixed(2);
  const soft = (2.6 * strength).toFixed(2);
  const blur = (7 * strength).toFixed(2);
  const red = 'rgba(198,62,30,';
  const cyan = 'rgba(22,134,158,';
  // A sharp split for the fringe, plus a wider blurred pass for the bloom. The
  // two together are what separates a printing misregistration from a plain
  // offset drop shadow.
  return [
    `-${soft}px 0 ${blur}px ${red}${(0.5 * strength).toFixed(2)})`,
    `${soft}px 0 ${blur}px ${cyan}${(0.46 * strength).toFixed(2)})`,
    `-${hard}px 0 0 ${red}${(0.42 * strength).toFixed(2)})`,
    `${hard}px 0 0 ${cyan}${(0.38 * strength).toFixed(2)})`,
  ].join(', ');
}

// ─── canvas ───────────────────────────────────────────────────────────────────
export interface SceneArgs {
  ctx: CanvasRenderingContext2D;
  w: number; // CSS px
  h: number;
  d: number; // device pixel scale already applied to the base transform
  t: number; // seconds since the scene mounted
  dt: number;
}

/**
 * A canvas that sizes itself to its box, runs a render loop, and stops that
 * loop whenever it scrolls out of view. The course puts a dozen of these on
 * one page, so the ones you are not looking at must cost nothing.
 *
 * The base transform is pre-scaled by the device pixel ratio, so a scene draws
 * in CSS pixels. Anything that calls setTransform itself (drawButterfly does)
 * gets `d` to fold in, and should restore the base with resetBase().
 */
export function useScene(
  render: (a: SceneArgs) => void,
  running = true,
): RefObject<HTMLCanvasElement | null> {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const renderRef = useRef(render);
  renderRef.current = render;
  const runningRef = useRef(running);
  runningRef.current = running;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let raf = 0;
    let w = 1;
    let h = 1;
    let d = 1;
    let visible = true;
    let last = performance.now() / 1000;
    const t0 = last;

    const size = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      d = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.round(r.width);
      h = Math.round(r.height);
      canvas.width = Math.round(w * d);
      canvas.height = Math.round(h * d);
    };
    size();

    const ro = new ResizeObserver(size);
    ro.observe(canvas);

    const io = new IntersectionObserver(
      entries => {
        visible = entries[0]?.isIntersecting ?? true;
      },
      { rootMargin: '160px' },
    );
    io.observe(canvas);

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = performance.now() / 1000;
      const dt = Math.min(now - last, 0.05);
      last = now;
      if (!visible || !runningRef.current || scenesPaused()) return;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      renderRef.current({ ctx, w, h, d, t: now - t0, dt });
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return ref;
}

/** Restore the CSS-pixel base transform after drawing sprites. */
export function resetBase(ctx: CanvasRenderingContext2D, d: number) {
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.globalAlpha = 1;
}

export interface PointerState {
  x: number;
  y: number;
  active: boolean;
}

/**
 * Pointer position in CSS pixels relative to the element. Pointer events cover
 * mouse, pen and touch in one path, which is exactly the parity problem the
 * loading screen had to solve by hand with separate touch listeners.
 */
export function usePointer(ref: RefObject<HTMLElement | null>) {
  const state = useRef<PointerState>({ x: -9999, y: -9999, active: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const set = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      state.current = { x: e.clientX - r.left, y: e.clientY - r.top, active: true };
    };
    const clear = () => {
      state.current = { x: -9999, y: -9999, active: false };
    };

    el.addEventListener('pointermove', set);
    el.addEventListener('pointerdown', set);
    el.addEventListener('pointerleave', clear);
    el.addEventListener('pointercancel', clear);
    return () => {
      el.removeEventListener('pointermove', set);
      el.removeEventListener('pointerdown', set);
      el.removeEventListener('pointerleave', clear);
      el.removeEventListener('pointercancel', clear);
    };
  }, [ref]);

  return state;
}

/** Deterministic noise so demos look the same on every mount. */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

// ─── controls ─────────────────────────────────────────────────────────────────
export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: '1 1 170px' }}>
      <span
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          fontSize: '0.7rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: T.muted,
        }}
      >
        <span>{label}</span>
        <span style={{ fontFamily: T.mono, letterSpacing: 0, color: T.ink }}>
          {format ? format(value) : value.toFixed(2)}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: T.accent, cursor: 'pointer' }}
      />
    </label>
  );
}

export function Segmented<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      {label && (
        <span
          style={{
            fontSize: '0.7rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: T.muted,
          }}
        >
          {label}
        </span>
      )}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          padding: 4,
          background: T.paperSunk,
          border: `1px solid ${T.rule}`,
          borderRadius: 999,
        }}
      >
        {options.map(o => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              onClick={() => onChange(o.value)}
              style={{
                appearance: 'none',
                border: 'none',
                cursor: 'pointer',
                borderRadius: 999,
                padding: '0.42rem 0.85rem',
                fontFamily: T.sans,
                fontSize: '0.72rem',
                letterSpacing: '0.04em',
                background: on ? T.dark : 'transparent',
                color: on ? '#f2f1ec' : T.muted,
                transition: 'background 160ms ease, color 160ms ease',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Check({
  label,
  checked,
  onChange,
  swatch,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  swatch?: string;
}) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        fontSize: '0.78rem',
        color: checked ? T.ink : T.muted,
        userSelect: 'none',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ accentColor: T.accent, cursor: 'pointer', width: 15, height: 15 }}
      />
      {swatch && (
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 2,
            background: swatch,
            border: `1px solid ${T.rule}`,
          }}
        />
      )}
      {label}
    </label>
  );
}

export function Button({
  children,
  onClick,
  tone = 'quiet',
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: 'quiet' | 'solid';
}) {
  const solid = tone === 'solid';
  return (
    <button
      onClick={onClick}
      style={{
        appearance: 'none',
        cursor: 'pointer',
        borderRadius: 999,
        padding: '0.5rem 1.1rem',
        fontFamily: T.sans,
        fontSize: '0.72rem',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        background: solid ? T.dark : 'transparent',
        color: solid ? '#f2f1ec' : T.body,
        border: solid ? 'none' : `1px solid ${T.rule}`,
      }}
    >
      {children}
    </button>
  );
}

// ─── citations ────────────────────────────────────────────────────────────────
/**
 * An inline citation marker. Takes one key or several, renders the bracketed
 * numbers the reference list is ordered by, and jumps to the entry.
 */
export function Cite({ k }: { k: string | string[] }) {
  const keys = Array.isArray(k) ? k : [k];
  return (
    <sup style={{ whiteSpace: 'nowrap', lineHeight: 0 }}>
      <span style={{ color: T.faint }}>[</span>
      {keys.map((key, i) => (
        <span key={key}>
          {i > 0 && <span style={{ color: T.faint }}>, </span>}
          <a
            href={`#ref-${refNumber(key)}`}
            style={{
              color: T.accent,
              textDecoration: 'none',
              fontSize: '0.72em',
              fontFamily: T.mono,
            }}
          >
            {refNumber(key)}
          </a>
        </span>
      ))}
      <span style={{ color: T.faint }}>]</span>
    </sup>
  );
}

export function ReferenceList() {
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: 'none', counterReset: 'ref' }}>
      {REFERENCES.map((r, i) => (
        <li
          key={r.key}
          id={`ref-${i + 1}`}
          style={{
            display: 'flex',
            gap: '0.85rem',
            padding: '0.75rem 0',
            borderBottom: `1px solid ${T.ruleSoft}`,
            scrollMarginTop: 90,
            fontSize: '0.85rem',
            lineHeight: 1.6,
          }}
        >
          <span style={{ fontFamily: T.mono, fontSize: '0.75rem', color: T.faint, paddingTop: 2, minWidth: 22 }}>
            {i + 1}.
          </span>
          <span>
            <span style={{ color: T.ink }}>{r.authors}</span>{' '}
            <span style={{ color: T.muted }}>({r.year}).</span>{' '}
            <span style={{ fontStyle: 'italic', color: T.body }}>{r.title}.</span>{' '}
            <span style={{ color: T.muted }}>{r.where}.</span>
            {r.note && (
              <span style={{ display: 'block', marginTop: 3, color: T.faint, fontSize: '0.8rem' }}>
                {r.note}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

// ─── paper furniture ──────────────────────────────────────────────────────────
export function Abstract({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        margin: '2rem 0',
        padding: '1.5rem 1.6rem',
        background: T.card,
        border: `1px solid ${T.rule}`,
        borderRadius: 3,
      }}
    >
      <div
        style={{
          fontSize: '0.63rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: T.accent,
          marginBottom: '0.9rem',
        }}
      >
        Abstract
      </div>
      <div style={{ fontSize: '0.96rem', lineHeight: 1.75, color: T.body }}>{children}</div>
    </div>
  );
}

/**
 * The chart stock itself: a graticule, a little grain, and a warm vignette at
 * the edges, all fixed behind the content and inert to the pointer.
 *
 * Plain opacity rather than a blend mode. A fixed, blended, full-page overlay
 * is one of the reliable ways to make a long document scroll badly.
 */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

export function ChartStock() {
  return (
    <>
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          backgroundImage: `repeating-linear-gradient(0deg, rgba(44,95,102,0.045) 0 1px, transparent 1px 72px),
             repeating-linear-gradient(90deg, rgba(44,95,102,0.045) 0 1px, transparent 1px 72px)`,
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          opacity: 0.055,
          backgroundImage: GRAIN,
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(120% 90% at 50% 40%, rgba(0,0,0,0) 55%, rgba(92,70,36,0.10) 100%)',
        }}
      />
    </>
  );
}

/**
 * A hairline double rule, the way a chart divides its panels. The two lines
 * carry a trace of red and cyan, so the division reads as two plates that did
 * not quite line up rather than as a border.
 */
export function Rule({ tight = false }: { tight?: boolean }) {
  return (
    <div aria-hidden style={{ margin: tight ? '1.2rem 0' : '2.4rem 0' }}>
      <div
        style={{
          height: 1,
          background: T.rule,
          boxShadow: '0 0 0 0 transparent, -1px 0 0 rgba(172,54,32,0.13)',
        }}
      />
      <div
        style={{
          height: 1,
          marginTop: 2,
          opacity: 0.55,
          background: T.rule,
          boxShadow: '1px 0 0 rgba(30,112,124,0.16)',
        }}
      />
    </div>
  );
}

/**
 * An expandable aside.
 *
 * Children are not rendered until it has been opened once, so the figures that
 * live inside these do not mount, allocate canvases or observe anything for
 * readers who never open them.
 */
export function Detail({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: ReactNode;
}) {
  const [opened, setOpened] = useState(false);

  return (
    <details
      onToggle={e => {
        if ((e.currentTarget as HTMLDetailsElement).open) setOpened(true);
      }}
      style={{
        margin: '1.8rem 0',
        border: `1px solid ${T.rule}`,
        borderRadius: 3,
        background: 'rgba(245,239,224,0.5)',
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          padding: '0.85rem 1.1rem',
          display: 'flex',
          alignItems: 'baseline',
          gap: '0.7rem',
          fontSize: '0.72rem',
          letterSpacing: '0.13em',
          textTransform: 'uppercase',
          color: T.sea,
        }}
      >
        <span>{label}</span>
        {note && (
          <span style={{ color: T.faint, letterSpacing: '0.04em', textTransform: 'none', fontSize: '0.76rem' }}>
            {note}
          </span>
        )}
      </summary>
      <div style={{ padding: '0.2rem 1.1rem 1.1rem', borderTop: `1px solid ${T.ruleSoft}` }}>
        {opened ? children : null}
      </div>
    </details>
  );
}

// ─── layout pieces ────────────────────────────────────────────────────────────
export function Figure({
  n,
  title,
  hint,
  children,
  controls,
  caption,
}: {
  n: string;
  title: string;
  hint?: string;
  children: ReactNode;
  controls?: ReactNode;
  caption?: ReactNode;
}) {
  return (
    <figure
      style={{
        position: 'relative',
        margin: '2.6rem 0',
        background: T.card,
        border: `1px solid ${T.rule}`,
        boxShadow: `0 0 0 1px rgba(44,95,102,0.07), 0 1px 0 rgba(255,255,255,0.5) inset`,
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      {/* plate corner ticks */}
      {[
        { top: 5, left: 5 },
        { top: 5, right: 5 },
        { bottom: 5, left: 5 },
        { bottom: 5, right: 5 },
      ].map((pos, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: 'absolute',
            width: 6,
            height: 6,
            borderTop: i < 2 ? `1px solid ${T.rule}` : undefined,
            borderBottom: i >= 2 ? `1px solid ${T.rule}` : undefined,
            borderLeft: i % 2 === 0 ? `1px solid ${T.rule}` : undefined,
            borderRight: i % 2 === 1 ? `1px solid ${T.rule}` : undefined,
            zIndex: 2,
            ...pos,
          }}
        />
      ))}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: '0.5rem 0.9rem',
          padding: '0.95rem 1.15rem',
          borderBottom: `1px solid ${T.ruleSoft}`,
        }}
      >
        <span
          style={{
            fontFamily: T.mono,
            fontSize: '0.66rem',
            letterSpacing: '0.08em',
            color: T.accent,
            background: T.accentSoft,
            padding: '0.2rem 0.5rem',
            borderRadius: 4,
            whiteSpace: 'nowrap',
          }}
        >
          Plate {n}
        </span>
        <span style={{ fontFamily: T.serif, fontSize: '1rem', color: T.ink, textShadow: chrom(0.55) }}>
          {title}
        </span>
        {hint && (
          <span style={{ fontSize: '0.75rem', color: T.faint, marginLeft: 'auto' }}>{hint}</span>
        )}
      </div>

      <div style={{ padding: '1.15rem' }}>{children}</div>

      {controls && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem 1.4rem',
            alignItems: 'flex-end',
            padding: '1rem 1.15rem',
            borderTop: `1px solid ${T.ruleSoft}`,
            background: T.paper,
          }}
        >
          {controls}
        </div>
      )}

      {caption && (
        <figcaption
          style={{
            padding: '0.9rem 1.15rem',
            borderTop: `1px solid ${T.ruleSoft}`,
            fontSize: '0.83rem',
            lineHeight: 1.65,
            color: T.muted,
          }}
        >
          <span style={{ color: T.ink }}>Plate {n}.</span> {caption}
        </figcaption>
      )}
    </figure>
  );
}

/** A canvas sized by aspect ratio, on the dark ground the field uses. */
export function Stage({
  canvasRef,
  ratio = 16 / 9,
  dark = true,
  onPointerDown,
  style,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  ratio?: number;
  dark?: boolean;
  onPointerDown?: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  style?: React.CSSProperties;
}) {
  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointerDown}
      style={{
        display: 'block',
        width: '100%',
        aspectRatio: String(ratio),
        borderRadius: 8,
        background: dark ? T.ground : T.paperSunk,
        touchAction: 'none',
        cursor: onPointerDown ? 'pointer' : 'default',
        ...style,
      }}
    />
  );
}

export function Readout({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.6rem' }}>
      {items.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontSize: '0.64rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: T.faint,
            }}
          >
            {k}
          </span>
          <span style={{ fontFamily: T.mono, fontSize: '0.9rem', color: T.ink }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

export function Note({ kind = 'note', children }: { kind?: 'note' | 'watch'; children: ReactNode }) {
  const watch = kind === 'watch';
  return (
    <aside
      style={{
        margin: '1.8rem 0',
        padding: '1rem 1.1rem',
        borderLeft: `2px solid ${watch ? '#b08247' : T.accent}`,
        background: watch ? '#faf5ec' : T.accentSoft,
        borderRadius: '0 3px 3px 0',
        fontSize: '0.92rem',
        lineHeight: 1.7,
        color: T.body,
      }}
    >
      <span
        style={{
          display: 'block',
          fontSize: '0.63rem',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: watch ? '#8a6534' : T.accent,
          marginBottom: '0.4rem',
        }}
      >
        {watch ? 'Where this goes wrong' : 'Principle'}
      </span>
      {children}
    </aside>
  );
}

// ─── code ─────────────────────────────────────────────────────────────────────
const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'of', 'in', 'while',
  'new', 'class', 'export', 'import', 'from', 'interface', 'type', 'true', 'false', 'null',
  'undefined', 'continue', 'break', 'this', 'async', 'await',
]);

const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('[^'\n]*'|"[^"\n]*"|`[^`]*`)|(\b\d+\.?\d*\b)|([A-Za-z_$][\w$]*)/g;

function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;

  while ((m = TOKEN.exec(code))) {
    if (m.index > i) out.push(code.slice(i, m.index));
    const [text, comment, str, num, word] = m;
    let color: string | undefined;
    let italic = false;

    if (comment) {
      color = '#a3a599';
      italic = true;
    } else if (str) {
      color = '#5f7052';
    } else if (num) {
      color = '#96652f';
    } else if (word && KEYWORDS.has(word)) {
      color = '#8a5a44';
    }

    if (color) {
      out.push(
        <span key={key++} style={{ color, fontStyle: italic ? 'italic' : 'normal' }}>
          {text}
        </span>,
      );
    } else {
      out.push(text);
    }
    i = m.index + text.length;
  }
  if (i < code.length) out.push(code.slice(i));
  return out;
}

export function Code({ children, caption }: { children: string; caption?: string }) {
  return (
    <div style={{ margin: '1.6rem 0' }}>
      <pre
        style={{
          margin: 0,
          padding: '1rem 1.1rem',
          background: T.paperSunk,
          border: `1px solid ${T.rule}`,
          borderRadius: caption ? '3px 3px 0 0' : 3,
          overflowX: 'auto',
          fontFamily: T.mono,
          fontSize: '0.795rem',
          lineHeight: 1.75,
          color: '#2c2f27',
        }}
      >
        <code>{highlight(children.trim())}</code>
      </pre>
      {caption && (
        <div
          style={{
            padding: '0.6rem 1.1rem',
            border: `1px solid ${T.rule}`,
            borderTop: 'none',
            borderRadius: '0 0 3px 3px',
            background: T.card,
            fontSize: '0.78rem',
            color: T.muted,
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}

// ─── prose ────────────────────────────────────────────────────────────────────
export function P({ children }: { children: ReactNode }) {
  return (
    <p style={{ margin: '0 0 1.25rem', fontSize: '1.02rem', lineHeight: 1.78, color: T.body }}>
      {children}
    </p>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return (
    <h3
      style={{
        margin: '2.6rem 0 1rem',
        fontFamily: T.serif,
        fontSize: '1.32rem',
        fontWeight: 400,
        lineHeight: 1.3,
        color: T.ink,
      }}
    >
      {children}
    </h3>
  );
}

export function Em({ children }: { children: ReactNode }) {
  return <em style={{ fontStyle: 'italic', color: T.ink }}>{children}</em>;
}

export function K({ children }: { children: ReactNode }) {
  return (
    <code
      style={{
        fontFamily: T.mono,
        fontSize: '0.86em',
        background: T.paperSunk,
        border: `1px solid ${T.ruleSoft}`,
        borderRadius: 4,
        padding: '0.08em 0.34em',
        color: '#3d4036',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </code>
  );
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul style={{ margin: '0 0 1.4rem', paddingLeft: '1.1rem', color: T.body }}>
      {items.map((it, i) => (
        <li key={i} style={{ margin: '0 0 0.6rem', fontSize: '1rem', lineHeight: 1.72 }}>
          {it}
        </li>
      ))}
    </ul>
  );
}

/** Tracks which chapter is currently in view, for the contents rail. */
/**
 * Which section the contents rail should mark.
 *
 * Deliberately arithmetic rather than an IntersectionObserver. An observer
 * watching a narrow band leaves the highlight stale whenever nothing is inside
 * that band, which happens at the very top of the document and in the middle of
 * any section taller than the band. Picking the last section whose top has
 * passed a reading line is always defined, for every scroll position.
 */
export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  const key = ids.join(',');

  const pick = useCallback(() => {
    const line = window.scrollY + window.innerHeight * 0.3;
    let best = ids[0];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      const top = el.getBoundingClientRect().top + window.scrollY;
      if (top <= line) best = id;
    }
    // the last section can be shorter than the final screenful, so it would
    // otherwise never win. At the bottom of the document, it does.
    const atEnd =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (atEnd) best = ids[ids.length - 1];

    setActive(a => (a === best ? a : best));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    pick();
    window.addEventListener('scroll', pick, { passive: true });
    window.addEventListener('resize', pick);
    return () => {
      window.removeEventListener('scroll', pick);
      window.removeEventListener('resize', pick);
    };
  }, [pick]);

  return active;
}
