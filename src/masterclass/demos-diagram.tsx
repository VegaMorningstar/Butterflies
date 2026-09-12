/**
 * Explanatory diagrams: the sprite coordinate space, the hover state machine,
 * and the timeline of a single butterfly's release.
 *
 * These three are figures rather than toys. Each one draws a structure that the
 * prose can only describe in sequence, and each is driven by the same constants
 * the loading screen runs on.
 */

import { useEffect, useRef, useState } from 'react';

import {
  BODY_BOX,
  cx,
  cy,
  getSprites,
  paintBody,
  paintWings,
  SHADOW_BOX,
  SS,
  WING_BOX,
  drawButterfly,
} from '../butterfly';

import { Check, Figure, Readout, Segmented, Slider, Stage, T, useScene } from './kit';

// ─── fig 04 · sprite space and the crop ───────────────────────────────────────
type BoxKey = 'wing' | 'body' | 'shadow';

const BOXES: Record<BoxKey, { box: typeof WING_BOX; label: string; colour: string }> = {
  wing: { box: WING_BOX, label: 'WING_BOX', colour: '#f0b46b' },
  body: { box: BODY_BOX, label: 'BODY_BOX', colour: '#7fd4c1' },
  shadow: { box: SHADOW_BOX, label: 'SHADOW_BOX', colour: '#9aa9d0' },
};

export function SpriteSpaceDemo() {
  const [which, setWhich] = useState<BoxKey>('wing');
  const [showArt, setShowArt] = useState(true);

  const ref = useScene(({ ctx, w, h }) => {
    ctx.clearRect(0, 0, w, h);

    const pad = 34;
    const scale = Math.min((w - pad * 2) / SS, (h - pad * 2) / SS);
    const ox = (w - SS * scale) / 2;
    const oy = (h - SS * scale) / 2;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);

    // the authoring square
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    ctx.fillRect(0, 0, SS, SS);

    if (showArt) {
      ctx.save();
      paintWings(ctx);
      ctx.save();
      ctx.translate(SS, 0);
      ctx.scale(-1, 1);
      paintWings(ctx);
      ctx.restore();
      paintBody(ctx);
      ctx.restore();
    }

    // grid every 25 units, so the coordinate space is legible
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 0.5 / scale;
    for (let g = 25; g < SS; g += 25) {
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, SS);
      ctx.moveTo(0, g);
      ctx.lineTo(SS, g);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1 / scale;
    ctx.strokeRect(0, 0, SS, SS);

    // the crop actually shipped
    const { box, colour } = BOXES[which];
    ctx.fillStyle = colour + '22';
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.4 / scale;
    ctx.strokeRect(box.x, box.y, box.w, box.h);

    ctx.restore();

    // labels, drawn unscaled so the type stays crisp
    ctx.font = `10px ${T.mono}`;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('0,0', ox - 16, oy - 6);
    ctx.fillText(`${SS},${SS}`, ox + SS * scale - 22, oy + SS * scale + 14);
    ctx.fillStyle = colour;
    ctx.fillText(
      `${BOXES[which].label}  ${box.w} x ${box.h}`,
      ox + box.x * scale,
      oy + box.y * scale - 6,
    );
  });

  const { box, label } = BOXES[which];
  const full = SS * SS;
  const kept = box.w * box.h;

  return (
    <Figure
      n="4"
      title="Sprite space, and the part that ships"
      hint="150 x 150 authored, less than that stored"
      controls={
        <>
          <Segmented
            label="Crop"
            value={which}
            options={[
              { value: 'wing', label: 'Wing' },
              { value: 'body', label: 'Body' },
              { value: 'shadow', label: 'Shadow' },
            ]}
            onChange={setWhich}
          />
          <Check label="Show the artwork" checked={showArt} onChange={setShowArt} />
          <Readout
            items={[
              ['Authoring square', `${full.toLocaleString()} px`],
              [label, `${kept.toLocaleString()} px`],
              ['Fill work removed', `${(100 - (kept / full) * 100).toFixed(0)}%`],
            ]}
          />
        </>
      }
      caption={
        <>
          Every path is authored inside one 150 by 150 unit square, which keeps the coordinates in
          the source readable. Only the marked rectangle is ever stored or drawn. The space
          outside it is transparent, and a transparent pixel still costs a blend if you leave it
          in the sprite, which is why the body sprite discards nine tenths of the square it was
          drawn in.
        </>
      }
    >
      <Stage canvasRef={ref} ratio={16 / 9} />
    </Figure>
  );
}

// ─── fig 09 · the hover state machine ─────────────────────────────────────────
const WAKE = 0.5;
const SLEEP = 0.12;
const HOLD = 0.42;

export function StateMachineDemo() {
  const [drive, setDrive] = useState(0);
  const [auto, setAuto] = useState(true);

  const stateRef = useRef({ hover: 0, mode: 0 as 0 | 1 | 2, hold: 0, shut: 0, ph: 0 });
  const [label, setLabel] = useState({ mode: 0, hover: 0 });
  const driveRef = useRef(drive);
  driveRef.current = drive;
  const autoRef = useRef(auto);
  autoRef.current = auto;
  const lastReport = useRef(0);

  const ref = useScene(({ ctx, w, h, d, t, dt }) => {
    const sprites = getSprites();
    const s = stateRef.current;

    // the driving signal: either a slow sweep past, or the slider
    const target = autoRef.current ? Math.max(0, Math.sin(t * 0.55)) ** 2 : driveRef.current;
    s.hover += (target - s.hover) * (target > s.hover ? 0.17 : 0.045);

    if (s.mode === 0 && s.hover > WAKE) {
      s.mode = 1;
      s.hold = HOLD;
    } else if (s.mode !== 0 && s.hover < SLEEP) {
      s.mode = 0;
      s.shut = 0;
    }

    let amp = 0.07 + s.hover * (0.88 - 0.07);
    if (s.mode === 1) {
      s.shut += (1 - s.shut) * 0.3;
      s.ph = Math.PI;
      if (s.shut > 0.96) {
        s.hold -= dt;
        if (s.hold <= 0) s.mode = 2;
      }
      amp *= s.shut;
    } else {
      s.ph += dt * (1.4 + s.hover * (27 - 1.4));
    }

    const now = performance.now();
    if (now - lastReport.current > 120) {
      lastReport.current = now;
      setLabel({ mode: s.mode, hover: s.hover });
    }

    ctx.clearRect(0, 0, w, h);

    // ── the three states, as boxes ──
    const boxW = Math.min(150, (w - 80) / 3);
    const boxH = 52;
    const gap = (w - 40 - boxW * 3) / 2;
    const top = 26;
    const names = ['0 · resting', '1 · shut, holding', '2 · beating'];

    for (let i = 0; i < 3; i++) {
      const x = 20 + i * (boxW + gap);
      const on = s.mode === i;
      ctx.fillStyle = on ? 'rgba(240,180,107,0.18)' : 'rgba(255,255,255,0.04)';
      ctx.strokeStyle = on ? '#f0b46b' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = on ? 1.8 : 1;
      ctx.beginPath();
      ctx.roundRect(x, top, boxW, boxH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = on ? '#f5e2c6' : 'rgba(255,255,255,0.5)';
      ctx.font = `11px ${T.sans}`;
      ctx.textAlign = 'center';
      ctx.fillText(names[i], x + boxW / 2, top + boxH / 2 + 4);
      ctx.textAlign = 'left';

      if (i < 2) {
        const ax = x + boxW + 4;
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ax, top + boxH / 2);
        ctx.lineTo(ax + gap - 8, top + boxH / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ax + gap - 8, top + boxH / 2);
        ctx.lineTo(ax + gap - 13, top + boxH / 2 - 3.5);
        ctx.lineTo(ax + gap - 13, top + boxH / 2 + 3.5);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.42)';
        ctx.font = `9px ${T.mono}`;
        ctx.textAlign = 'center';
        ctx.fillText(i === 0 ? 'hover > 0.5' : 'held 0.42s', ax + (gap - 8) / 2, top - 6);
        ctx.textAlign = 'left';
      }
    }

    // the re-arm arrow, running back underneath
    const backY = top + boxH + 16;
    ctx.strokeStyle = 'rgba(127,212,193,0.55)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20 + boxW * 2.5 + gap * 2, top + boxH);
    ctx.lineTo(20 + boxW * 2.5 + gap * 2, backY);
    ctx.lineTo(20 + boxW * 0.5, backY);
    ctx.lineTo(20 + boxW * 0.5, top + boxH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(127,212,193,0.75)';
    ctx.font = `9px ${T.mono}`;
    ctx.textAlign = 'center';
    ctx.fillText('hover < 0.12 · re-arm', 20 + boxW * 1.5 + gap, backY + 12);
    ctx.textAlign = 'left';

    // ── the signal, with both thresholds drawn on ──
    const gTop = backY + 26;
    const gH = Math.max(40, h - gTop - 20);
    const gx = 20;
    const gw = w - 40;

    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.strokeRect(gx, gTop, gw, gH);

    for (const [v, colour, text] of [
      [WAKE, '#f0b46b', 'WAKE 0.5'],
      [SLEEP, '#7fd4c1', 'SLEEP 0.12'],
    ] as [number, string, string][]) {
      const y = gTop + gH - v * gH;
      ctx.strokeStyle = colour;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx + gw, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = colour;
      ctx.font = `9px ${T.mono}`;
      ctx.fillText(text, gx + 4, y - 3);
    }

    const barW = 10;
    const bx = gx + gw - barW - 8;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(bx, gTop + 4, barW, gH - 8);
    ctx.fillStyle = '#f0b46b';
    ctx.fillRect(bx, gTop + gH - 4 - s.hover * (gH - 8), barW, s.hover * (gH - 8));

    // the butterfly this is actually driving
    drawButterfly(ctx, sprites, {
      x: gx + gw * 0.5,
      y: gTop + gH / 2,
      size: 0.72,
      rot: 0,
      fold: amp * (1 - Math.cos(s.ph)) * 0.5,
      layer: 2,
      d,
    });
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.globalAlpha = 1;
  });

  return (
    <Figure
      n="10"
      title="The per-butterfly state machine"
      hint="two thresholds, three states"
      controls={
        <>
          <Check label="Sweep automatically" checked={auto} onChange={setAuto} />
          {!auto && (
            <Slider label="Hover level" value={drive} min={0} max={1} onChange={setDrive} />
          )}
          <Readout
            items={[
              ['State', ['resting', 'shut, holding', 'beating'][label.mode]],
              ['Hover', label.hover.toFixed(3)],
            ]}
          />
        </>
      }
      caption={
        <>
          Each butterfly holds three states and one continuous input. The transition up happens at
          0.5 and the transition back happens at 0.12, and the gap between those two numbers is
          the whole point: a single threshold would let a butterfly sitting exactly on the line
          flip state every few frames. Turn the automatic sweep off and park the slider between
          the two dashed lines to see that nothing happens there, in either direction.
        </>
      }
    >
      <Stage canvasRef={ref} ratio={2.2} />
    </Figure>
  );
}

// ─── fig 13 · the life of one butterfly during the release ────────────────────
const STARTLE_LEAD = 1.5;
const ALARM_LEAD = 0.6;
const FD = 1.65;

export function TimelineDemo() {
  const [scrub, setScrub] = useState(0.42);
  const span = STARTLE_LEAD + FD + 0.5;

  const ref = useScene(({ ctx, w, h, d }) => {
    const sprites = getSprites();
    ctx.clearRect(0, 0, w, h);

    const padL = 22;
    const padR = 22;
    const axisY = h - 44;
    const tw = w - padL - padR;
    const toX = (t: number) => padL + ((t + STARTLE_LEAD) / span) * tw;
    const now = scrub * span - STARTLE_LEAD;

    // phase bands
    const bands: [number, number, string, string][] = [
      [-STARTLE_LEAD, -ALARM_LEAD, 'rgba(127,212,193,0.16)', 'stirring'],
      [-ALARM_LEAD, 0, 'rgba(240,180,107,0.2)', 'beating hard'],
      [0, FD, 'rgba(255,255,255,0.08)', 'in flight'],
    ];
    for (const [a, b, fill, text] of bands) {
      ctx.fillStyle = fill;
      ctx.fillRect(toX(a), 26, toX(b) - toX(a), axisY - 26);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `10px ${T.sans}`;
      ctx.textAlign = 'center';
      ctx.fillText(text, (toX(a) + toX(b)) / 2, 40);
      ctx.textAlign = 'left';
    }

    // Wing amplitude, from first stir to the end of the flight. It stops at FD
    // because past that the butterfly is off the canvas and has been culled.
    const traceEnd = FD;
    ctx.strokeStyle = '#f0b46b';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i <= 220; i++) {
      const t = -STARTLE_LEAD + (i / 220) * (STARTLE_LEAD + traceEnd);
      let amp: number;
      if (t < -ALARM_LEAD) amp = 0.4;
      else if (t < 0) amp = 0.92;
      else amp = 0.88;
      const x = toX(t);
      const y = axisY - 14 - amp * (axisY - 70);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();

    // alpha trace during flight only
    ctx.strokeStyle = '#9aa9d0';
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const p = i / 120;
      const alpha = 1 - Math.max(0, (p - 0.3) / 0.7) ** 1.4;
      const x = toX(p * FD);
      const y = axisY - 14 - alpha * (axisY - 70);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // axis
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, axisY);
    ctx.lineTo(w - padR, axisY);
    ctx.stroke();

    for (const [t, text] of [
      [-STARTLE_LEAD, '-1.5s'],
      [-ALARM_LEAD, '-0.6s'],
      [0, 'launch'],
      [FD, '+1.65s'],
    ] as [number, string][]) {
      const x = toX(t);
      ctx.strokeStyle = t === 0 ? '#ffffff' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = t === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 26);
      ctx.lineTo(x, axisY + 5);
      ctx.stroke();
      ctx.fillStyle = t === 0 ? '#ffffff' : 'rgba(255,255,255,0.5)';
      ctx.font = `10px ${T.mono}`;
      ctx.textAlign = 'center';
      ctx.fillText(text, x, axisY + 18);
      ctx.textAlign = 'left';
    }

    // playhead
    const px = toX(now);
    ctx.strokeStyle = '#f0b46b';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px, 20);
    ctx.lineTo(px, axisY + 5);
    ctx.stroke();

    // the butterfly at this instant, drawn on the playhead
    let amp: number;
    let alpha = 1;
    let lift = 0;
    if (now < -ALARM_LEAD) amp = now < -STARTLE_LEAD ? 0.07 : 0.4;
    else if (now < 0) amp = 0.92;
    else {
      const p = Math.min(now / FD, 1);
      amp = 0.88;
      alpha = 1 - Math.max(0, (p - 0.3) / 0.7) ** 1.4;
      lift = -(p * p * p) * (axisY - 90);
    }
    if (alpha > 0.02) {
      drawButterfly(ctx, sprites, {
        x: px,
        y: axisY - 26 + lift,
        size: 0.7,
        rot: 0,
        fold: amp * (1 - Math.cos(scrub * 34)) * 0.5,
        layer: 2,
        alpha,
        d,
      });
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `9px ${T.mono}`;
    ctx.fillText('wing amplitude', padL + 2, 20);
    ctx.fillStyle = 'rgba(154,169,208,0.75)';
    ctx.fillText('opacity', padL + 90, 20);
  });

  return (
    <Figure
      n="13"
      title="The life of one butterfly, measured from its own launch"
      hint="scrub through it"
      controls={
        <Slider
          label="Time"
          value={scrub}
          min={0}
          max={1}
          step={0.005}
          onChange={setScrub}
          format={v => `${(v * span - STARTLE_LEAD).toFixed(2)}s`}
        />
      }
      caption={
        <>
          Zero is the moment this particular butterfly leaves, not the moment of the click. Both
          wind-up stages are defined backwards from that zero, which is why agitation propagates in
          exactly the same order as departure without any extra bookkeeping. The opacity trace
          shows the other deliberate offset: fading does not begin until the flight is nearly a
          third done, so the butterfly reads as flying away rather than dissolving on the spot.
        </>
      }
    >
      <Stage canvasRef={ref} ratio={2.4} />
    </Figure>
  );
}
