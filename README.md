# Butterflies

An interactive loading screen. A field of ~2,500 white butterflies covers the
screen; they react to the cursor, and on click they scatter to reveal the page
underneath.

Built with React 19, Vite and Tailwind CSS v4. All of the animation is a single
2D canvas — there is no DOM element per butterfly.

## What is underneath

Releasing the field reveals **How this was built**, a long-form interactive
walkthrough of the loading screen itself, in thirteen chapters: the UX reasoning
behind the wait, why this is canvas and not DOM, the bezier construction of the
butterfly, sprite baking, field placement, the flap, the input response, the
motion principles, the release choreography, the anatomy of a single frame, and
the device work.

All twelve of its figures are live and wired to the real sprite code in
[`src/butterfly.ts`](src/butterfly.ts), so nothing in the walkthrough can drift
away from the thing it describes. Four of them measure rather than assert: DOM
against canvas, path rendering against baked sprites, the per-stage cost of one
frame, and the head count for whatever screen you are on.

It lives in [`src/masterclass/`](src/masterclass/) and is a separate chunk whose
download starts as soon as the field appears, so the wait covers a real arrival
rather than performing one. The `↺` in its header puts the butterflies back.

Any hash in the URL (`#release`, say) skips the field and lands on that chapter,
so individual chapters stay linkable.

## The mark

[`public/favicon.svg`](public/favicon.svg) is the Cabbage White on the same
near-black the field sits on. It is not redrawn by hand: `scripts/make-logo.mjs`
reads `FOREWING` and `HINDWING` out of [`src/butterfly.ts`](src/butterfly.ts),
converts the same control points into SVG path data, and rebuilds the file. So
the logo and the butterflies on screen are the same shape by construction.

```bash
pnpm logo   # after changing the wing outline
```

## Running it

The project's toolchain is pinned in `.mise.toml` (Node 22, pnpm).

```bash
pnpm install
pnpm dev      # dev server with hot reload
pnpm build    # production build to dist/
pnpm preview  # serve the production build
```

`npm` works too if you'd rather not install pnpm; the committed lockfile is
pnpm's.

## How it works

Everything lives in [`src/App.tsx`](src/App.tsx), which carries a full
architecture comment at the top. The short version:

### Drawing

Every frame clears one full-screen canvas and re-blits pre-rendered sprites.
The artwork — wing pair, body, drop shadow — is drawn once at startup into small
offscreen canvases, and the render loop only ever translates, rotates, scales
and draws those. Nothing is path-rendered per frame.

### The field

Three interleaved layers, back to front. Each is its own **jittered grid**: the
grid guarantees even coverage, then every butterfly wanders up to half a cell
off its mark, so the field reads as organic rather than stamped. Three offset
layers fill each other's gaps, which is what lets the screen read as near-solid
white while still being made of discrete butterflies.

Depth is carried by tone rather than blur: the back layer sits in shade, the
front catches a raked highlight, and only the front layer casts a drop shadow.
The shading is deliberately gentle — pushed too far, a back-layer butterfly goes
as dark as the background, reads as background, and the coverage is wasted.

Each row gets a **random horizontal phase** rather than a fixed half-step
stagger. A fixed stagger builds a triangular lattice, and a triangular lattice
reads as diagonal lines running through the whole field.

### The butterfly

Wings and body are separate sprites, so the wings can fold while the body stays
put. That hinge is what makes a flap read as a flap rather than as the whole
insect being squashed.

The wing sprite is symmetric about the body axis. That means squeezing the whole
sprite horizontally is mathematically identical to folding two halves inward —
one `drawImage` per butterfly instead of two, for pixel-identical output.

### Interaction

| | behaviour |
|---|---|
| idle | slow, shallow breathing of the wings |
| hover | wings snap shut, **hold** there for a beat, then beat fast |
| click | release — two phases, below |

The hold on hover matters: without the pause the wings pass through the closed
position too quickly for the dark underside to register.

### The release

Distance from the click is quantised into rings of fixed width (~one wingspan),
so the wave steps outward one shell of butterflies at a time. It then runs in
two phases, modelling two different things:

**Phase 1 — the poke.** A fingertip lands on one butterfly. That's contact, so
it travels straight *down* the stack at that spot: front layer, then the one
under it, then the one under that. Confined to `CONTACT_BANDS`.

**Phase 2 — the alarm.** Nothing further out has been touched; panic spreads
sideways from neighbour to neighbour, and a butterfly doesn't care which layer
its alarmed neighbour is in. So it becomes a single front rolling outward with
all three layers close together inside it.

The two phases are separated by a real gap. What keeps that from reading as a
stall is the **alarm wave**: the click startles the whole swarm to a moderate
beat immediately, and each butterfly then winds up to a hard beat over the
`ALARM_LEAD` seconds before its own launch. There is always a band of agitated
butterflies ahead of the clearing front.

## Tuning

All the knobs are grouped at the top of `src/App.tsx` and commented in place.
The ones worth reaching for first:

| constant | effect |
|---|---|
| `LAYERS[].gs`, `ROW_RATIO` | butterfly count — and therefore frame cost |
| `BASE_SZ` | butterfly size |
| `HOVER_R`, `HOLD` | reach and dwell of the cursor reaction |
| `POKE_STEP`, `PHASE_GAP` | how drawn-out the phase-1 poke is |
| `BAND_PX`, `DIST_STEP`, `SLOW_STEP` | speed and granularity of the outward wave |

Several release constants are currently set deliberately slow, so the staging is
easy to see while tuning. Expect to shorten `POKE_STEP` and `SLOW_STEP` before
shipping.

## Performance notes

Density is the whole cost. Roughly 2,500 butterflies at 2 draw calls each, plus
shadows for the front layer, is a real per-frame budget. What actually helped,
in order of payoff:

1. **Cropping sprite canvases to their true bounds.** Fill rate dominates, and a
   150×150 canvas holding an 74×91 wing is mostly transparent pixels being
   blended for nothing.
2. **The symmetric wing sprite** — halves the wing draw calls, identical output.
3. **Shadows on the front layer only.** Measured: a full-field shadow pass cost
   ~45% more frame time for a difference that wasn't visible.
4. **Capping device pixel ratio at 1.5.** At this density the extra buffer
   resolution buys almost nothing.

If it feels heavy on lower-end hardware, `ROW_RATIO` is the single cheapest dial
— it thins every layer at once.

## Project layout

```
src/App.tsx           field, animation loop, interaction, reveal sequencing
src/butterfly.ts      the art: wing paths, sprite baking, scene washes
src/scenePause.ts     parks the walkthrough's loops while the field is up
public/favicon.svg    the mark, generated (see below)
scripts/make-logo.mjs regenerates the mark from the wing geometry
src/masterclass/      the "How this was built" walkthrough (lazy loaded)
  Masterclass.tsx     chapters and prose
  demos.tsx           the art, field and motion figures
  demos-arch.tsx      DOM vs canvas, frame anatomy, live head count
  field.ts            field building shared by the figures
  kit.tsx             canvas hooks, controls, typographic pieces
src/main.tsx          React entry point
src/index.css         Tailwind import and global resets
index.html            Vite shell, metadata, font links
vite.config.ts        React + Tailwind v4 plugins, "@" alias for src/
```
