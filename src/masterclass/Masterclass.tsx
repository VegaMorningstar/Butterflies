/**
 * "How this was built": a short, illustrated account of the loading screen,
 * written for someone who designs things rather than someone maintaining this
 * codebase.
 *
 * The main thread of the document is design language, the reasoning behind
 * loading screens, and the sequence of decisions that produced this one.
 * Implementation lives in <Detail> blocks, which do not mount their contents
 * until opened, so the reader chooses the depth and pays only for what they
 * open.
 */

import { useEffect, useState } from 'react';

import {
  AnatomyDemo,
  BakeDemo,
  EasingDemo,
  FlapDemo,
  HoverDemo,
  LayerDemo,
  PlacementDemo,
  ReleaseDemo,
  ResolutionDemo,
  WaitDemo,
} from './demos';

import { DomVsCanvasDemo, FieldCount, FrameDemo } from './demos-arch';
import { SpriteSpaceDemo, StateMachineDemo, TimelineDemo } from './demos-diagram';

import {
  Abstract,
  ChartStock,
  Cite,
  Code,
  Detail,
  Em,
  H3,
  K,
  List,
  Note,
  P,
  ReferenceList,
  Rule,
  T,
  chrom,
  useActiveSection,
} from './kit';

const CHAPTERS = [
  { id: 'brief', n: '1', title: 'What a wait is for' },
  { id: 'wait', n: '2', title: 'Occupied time' },
  { id: 'shape', n: '3', title: 'Drawing the animal' },
  { id: 'field', n: '4', title: 'Covering a plane' },
  { id: 'flap', n: '5', title: 'The flap' },
  { id: 'answer', n: '6', title: 'Answering the pointer' },
  { id: 'motion', n: '7', title: 'Borrowed from animators' },
  { id: 'release', n: '8', title: 'The exit' },
  { id: 'takeaway', n: '9', title: 'What transfers' },
  { id: 'references', n: '', title: 'References' },
];

function useScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setP(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return p;
}

function Chapter({
  id,
  n,
  title,
  deck,
  children,
}: {
  id: string;
  n: string;
  title: string;
  deck?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ scrollMarginTop: 84, padding: '3rem 0 0.5rem' }}>
      <Rule />
      <h2
        style={{
          margin: '0 0 0.8rem',
          fontFamily: T.serif,
          fontSize: 'clamp(1.7rem, 4.4vw, 2.2rem)',
          fontWeight: 300,
          lineHeight: 1.15,
          letterSpacing: '-0.015em',
          color: T.ink,
          textShadow: chrom(0.8),
        }}
      >
        {n && (
          <span style={{ color: T.accent, fontFamily: T.mono, fontSize: '0.52em', marginRight: '0.7rem' }}>
            {n}
          </span>
        )}
        {title}
      </h2>

      {deck && (
        <p
          style={{
            margin: '0 0 1.6rem',
            fontFamily: T.serif,
            fontSize: '1.08rem',
            lineHeight: 1.55,
            color: T.muted,
            fontStyle: 'italic',
          }}
        >
          {deck}
        </p>
      )}

      {children}
    </section>
  );
}

export default function Masterclass({ onReplay }: { onReplay: () => void }) {
  const progress = useScrollProgress();
  const active = useActiveSection(CHAPTERS.map(c => c.id));
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const id = window.location.hash.slice(1);
    const el = id ? document.getElementById(id) : null;
    if (el) el.scrollIntoView();
    else window.scrollTo(0, 0);
  }, []);

  const jump = (id: string) => {
    setMenu(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${id}`);
  };

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: T.paper,
        fontFamily: T.sans,
        color: T.body,
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <ChartStock />

      {/* ── bar ── */}
      <header
        className="sticky top-0"
        style={{
          zIndex: 30,
          background: 'rgba(239,231,213,0.9)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderBottom: `1px solid ${T.rule}`,
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div className="mx-auto flex items-center gap-3 px-4 sm:px-6" style={{ maxWidth: 1100, height: 54 }}>
          <button
            onClick={onReplay}
            title="Put the butterflies back"
            style={{
              appearance: 'none',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.4rem 0',
              fontFamily: T.sans,
              fontSize: '0.72rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: T.sea,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>&#8634;</span>
            <span className="hidden sm:inline">Replay the field</span>
            <span className="sm:hidden">Replay</span>
          </button>

          <span
            className="hidden md:block"
            style={{
              marginLeft: 'auto',
              fontFamily: T.serif,
              fontSize: '0.86rem',
              color: T.ink,
              letterSpacing: '0.04em',
              textShadow: chrom(0.4),
            }}
          >
            Wings and Wind
          </span>

          <button
            className="lg:hidden"
            onClick={() => setMenu(m => !m)}
            style={{
              marginLeft: 'auto',
              appearance: 'none',
              cursor: 'pointer',
              background: 'transparent',
              border: `1px solid ${T.rule}`,
              borderRadius: 2,
              padding: '0.35rem 0.85rem',
              fontFamily: T.sans,
              fontSize: '0.68rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: T.body,
            }}
          >
            {menu ? 'Close' : 'Contents'}
          </button>
        </div>

        <div style={{ height: 2, background: T.ruleSoft }}>
          <div style={{ height: '100%', width: `${progress * 100}%`, background: T.accent }} />
        </div>
      </header>

      {/* ── mobile contents ── */}
      {menu && (
        <div
          className="lg:hidden"
          style={{
            position: 'fixed',
            inset: '56px 0 0',
            zIndex: 25,
            background: T.paper,
            overflowY: 'auto',
            padding: '1.2rem 1.25rem 3rem',
          }}
        >
          {CHAPTERS.map(c => (
            <button
              key={c.id}
              onClick={() => jump(c.id)}
              style={{
                display: 'flex',
                gap: '0.9rem',
                width: '100%',
                textAlign: 'left',
                appearance: 'none',
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid ${T.ruleSoft}`,
                padding: '0.9rem 0',
                cursor: 'pointer',
                fontFamily: T.sans,
                fontSize: '1rem',
                color: active === c.id ? T.ink : T.muted,
              }}
            >
              <span style={{ fontFamily: T.mono, fontSize: '0.72rem', color: T.accent, minWidth: 16 }}>
                {c.n}
              </span>
              {c.title}
            </button>
          ))}
        </div>
      )}

      {/* ── body ── */}
      <div className="mx-auto flex gap-10 px-5 sm:px-6" style={{ maxWidth: 1100, position: 'relative', zIndex: 1 }}>
        <aside className="hidden lg:block" style={{ width: 178, flexShrink: 0 }}>
          <nav style={{ position: 'sticky', top: 90, padding: '3rem 0' }}>
            <div
              style={{
                fontSize: '0.6rem',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: T.faint,
                marginBottom: '0.9rem',
              }}
            >
              Contents
            </div>
            {CHAPTERS.map(c => {
              const on = active === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => jump(c.id)}
                  style={{
                    display: 'flex',
                    gap: '0.6rem',
                    width: '100%',
                    textAlign: 'left',
                    appearance: 'none',
                    background: 'transparent',
                    border: 'none',
                    borderLeft: `2px solid ${on ? T.accent : 'transparent'}`,
                    padding: '0.38rem 0 0.38rem 0.7rem',
                    cursor: 'pointer',
                    fontFamily: T.sans,
                    fontSize: '0.8rem',
                    lineHeight: 1.3,
                    color: on ? T.ink : T.muted,
                  }}
                >
                  <span style={{ fontFamily: T.mono, fontSize: '0.62rem', color: T.accent, paddingTop: 2, minWidth: 12 }}>
                    {c.n}
                  </span>
                  {c.title}
                </button>
              );
            })}
          </nav>
        </aside>

        <main style={{ flex: 1, minWidth: 0, maxWidth: 690, margin: '0 auto', paddingBottom: '4rem' }}>
          {/* ── title block ── */}
          <div style={{ padding: '3.4rem 0 0.5rem' }}>
            <div
              style={{
                fontSize: '0.64rem',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: T.accent,
                marginBottom: '1.1rem',
              }}
            >
              An illustrated build report
            </div>
            <h1
              style={{
                margin: '0 0 1rem',
                fontFamily: T.serif,
                fontSize: 'clamp(2.1rem, 6.4vw, 3.1rem)',
                fontWeight: 300,
                lineHeight: 1.08,
                letterSpacing: '-0.025em',
                color: T.ink,
                textShadow: chrom(1.15),
              }}
            >
              A field of butterflies, and the reasoning underneath it
            </h1>
            <p
              style={{
                margin: '0 0 1.5rem',
                fontFamily: T.serif,
                fontSize: '1.08rem',
                lineHeight: 1.5,
                color: T.muted,
                fontStyle: 'italic',
              }}
            >
              What a loading screen is for, and how this one was drawn, arranged, animated and
              taken away again
            </p>

            <Abstract>
              <P>
                The screen you just cleared is a single canvas. This is the short version of how it
                was designed: why the wait offers you something to do rather than something to
                watch, how the animal was drawn and the field arranged, how the motion was tuned,
                and how the exit was choreographed to be the part you remember.
              </P>
              <P>
                Nine sections and nine plates in the main thread, about a fifteen minute read. Six
                further plates and all of the implementation sit folded into the marked asides, so
                you can take the argument straight through and open the machinery only where you
                want it.
              </P>
            </Abstract>
          </div>

          {/* ══ 1 ══ */}
          <Chapter
            id="brief"
            n="1"
            title="What a wait is for"
            deck="One question decides everything downstream, and it is not a visual question."
          >
            <P>
              A loading screen is an apology. Something is not ready, and the person in front of you
              has to sit with that. There are only three honest things you can offer them in
              exchange: you can tell them how long it will take, you can take their attention
              somewhere else, or you can give them something to do.
            </P>
            <P>
              Those are a progress bar, an animation, and a toy. This is the third, and the choice
              writes the rest of the brief. A toy has to answer instantly, reward poking at it, and
              above all <Em>let the person be the one who ends it</Em>. The moment someone dismisses
              the screen themselves, the wait stops being something done to them.
            </P>
            <P>
              That last claim is a design judgement, not a measured result, and it is worth saying
              which it is. What the evidence supports is the narrower point in section 2.
            </P>

            <List
              items={[
                <>
                  <strong>No asset downloads.</strong> A loading screen that waits for its own images
                  is a joke at your own expense.
                </>,
                <>
                  <strong>Sixty frames a second on a phone.</strong> The budget is set by the weakest
                  device that will realistically see it.
                </>,
                <>
                  <strong>Discoverable without instructions.</strong> If it needs a paragraph, it has
                  failed.
                </>,
                <>
                  <strong>It must get out of the way.</strong> The exit is the most important
                  animation in the piece.
                </>,
              ]}
            />
          </Chapter>

          {/* ══ 2 ══ */}
          <Chapter
            id="wait"
            n="2"
            title="Occupied time"
            deck="You cannot make the network faster. You can only change what six seconds feel like."
          >
            <P>
              The useful research here predates the web. Maister&apos;s propositions on queue
              psychology <Cite k="maister" /> hold that occupied time feels shorter than unoccupied
              time, that uncertain waits feel longer than known ones, and that unexplained waits feel
              longer than explained ones. Work on tolerable waiting in web interfaces{' '}
              <Cite k="nah" /> reaches compatible conclusions about how fast patience runs out.
            </P>
            <P>Plate 1 is that first proposition, run on you. Both waits are exactly six seconds.</P>

            <WaitDemo />

            <P>
              Notice what the occupied wait is not doing. It is not entertaining you and it is not
              informing you. It is giving your attention somewhere to go that answers back. That
              loop is the entire mechanism, and it matters more than the polish on either side of
              it.
            </P>

            <Note>
              If you cannot shorten a wait, put a response loop inside it <Cite k="maister" />.
            </Note>

            <H3>The ending is what gets remembered</H3>
            <P>
              Retrospective judgements of an episode are dominated by its most intense moment and its
              ending rather than by its average or its length <Cite k="kahneman93" />. The effect is
              strong enough that a longer unpleasant procedure with a gentler ending is remembered as
              preferable to a shorter one that stops at its worst <Cite k="redelmeier" />.
            </P>
            <P>
              A loading screen has an unusually clean version of this, because its ending is the only
              part anyone will describe to someone else. That is why section 8 is the longest one
              here, and why the exit got more attention than everything it interrupts.
            </P>

            <H3>Say it late</H3>
            <P>
              There is a line of text at the foot of the field, and it is held back for 1.6 seconds.
              For that first stretch there is no instruction at all: the field arrives, you look at
              it, and if you move you discover the interaction yourself, which is worth far more than
              being told. The text is for the person who did not move.
            </P>

            <Detail label="Response thresholds" note="the three numbers worth memorising">
              <P>
                Around <K>100ms</K> a response reads as instantaneous and the thing you touched feels
                like an object; by <K>1s</K> the sense of direct manipulation is gone; past{' '}
                <K>10s</K> attention leaves <Cite k={['card', 'nielsen']} />. Between the first two
                sits the Doherty threshold at about <K>400ms</K>, past which operators stop feeling
                in command <Cite k="doherty" />.
              </P>
              <P>
                The field answers on the next frame, about 16 milliseconds. That is the reason it
                feels like cloth rather than like a video of cloth.
              </P>
            </Detail>
          </Chapter>

          {/* ══ 3 ══ */}
          <Chapter
            id="shape"
            n="3"
            title="Drawing the animal"
            deck="No image files anywhere, which turns out to be a design constraint more than a technical one."
          >
            <P>
              The butterfly is a function rather than an asset: two closed bezier outlines{' '}
              <Cite k="farin" /> and a handful of gradients, evaluated at startup. That was chosen
              for delivery reasons, but it changed the drawing. A shape you have to describe in
              numbers is a shape you have to look at properly first.
            </P>

            <H3>Pick a real species</H3>
            <P>
              This is a Cabbage White, <Em>Pieris rapae</Em>. It has three features that survive
              being drawn at a wingspan of about 55 pixels: white plates with almost no pattern, a
              charcoal smudge at the leading corner of each forewing, and one dark spot per wing.
            </P>
            <P>
              Generic shapes read as clip art. A specific one reads as an observation, even to a
              viewer who cannot name the species. That principle is not about butterflies.
            </P>

            <AnatomyDemo />

            <H3>Restraint at the size it ships</H3>
            <P>
              Only the right wing pair is authored; the left is the same path through a flipped
              transform, which makes symmetry structural instead of something you maintain by hand.
              Everything else is deliberately almost invisible. Veins sit at 0.22 alpha, the wing
              outlines at 0.32 and 0.38, the antennae at 0.34.
            </P>
            <P>
              At the size these actually render you are not drawing an illustration, you are
              seasoning a texture. Turn the veins up to something you can comfortably see on one
              butterfly and the whole field becomes scratchy noise.
            </P>

            <Note kind="watch">
              Design at the size it ships. A drawing that is beautiful at 400 pixels in isolation is
              usually the wrong drawing for a field of them at 55, and you will not find out until
              you assemble the field.
            </Note>

            <Detail label="How it is actually drawn" note="medium, sprite baking, coordinate space">
              <P>
                The field is one <K>&lt;canvas&gt;</K> rather than one element per butterfly{' '}
                <Cite k="html" />. Plate 3 is why: both arms draw the same butterflies from the same
                image, and only the count changes.
              </P>
              <P>
                <Em>On the timings below.</Em> Both plates measure main-thread time to issue canvas
                work on your own machine, not GPU time, and browsers deliberately coarsen their
                clocks. Treat the ratios as the finding and the absolute milliseconds as
                indicative. Both arms run against the same data and produce the same output, which
                is what makes the comparison worth anything.
              </P>
              <DomVsCanvasDemo />
              <P>
                None of the artwork changes once drawn, so it is painted once at startup into small
                offscreen canvases and stamped from then on. Each sprite is cropped to its true
                bounds, because a transparent pixel still costs a blend.
              </P>
              <SpriteSpaceDemo />
              <BakeDemo />
              <P>
                Layer tinting uses the Porter and Duff <K>source-atop</K> operator{' '}
                <Cite k="porterduff" />, so a careless full-canvas rectangle lands only inside the
                wing silhouette. One paint, three tinted copies, no second outline to maintain.
              </P>
              <Code caption="src/butterfly.ts, tint()">{`
ctx.globalCompositeOperation = 'source-atop';
ctx.fillStyle = 'rgba(15, 20, 27, ' + cfg.dark + ')';
ctx.fillRect(0, 0, SS, SS);   // a full rectangle, clipped by what is there
`}</Code>
            </Detail>
          </Chapter>

          {/* ══ 4 ══ */}
          <Chapter
            id="field"
            n="4"
            title="Covering a plane"
            deck="Thousands of objects have to read as one surface without ever reading as a pattern."
          >
            <P>
              The field has a contradictory job. At rest it should look like a near-solid white
              surface. But it must obviously be made of individual animals, because the entire payoff
              depends on those animals leaving separately.
            </P>
            <P>
              How you distribute them decides this, and the wrong choice fails in a way that is hard
              to see until you know to look for it.
            </P>

            <PlacementDemo />

            <P>
              <strong>Uniform random</strong> is the common instinct and the worst result. Randomness
              clumps: gaps and piles are the expected behaviour of a random point process, not bad
              luck <Cite k="aldous" />.
            </P>
            <P>
              <strong>A strict grid</strong> covers evenly and announces itself.
            </P>
            <P>
              <strong>The half-step stagger</strong> is the trap, and the most useful thing in this
              section. Offsetting alternate rows by half a cell is the standard fix for a grid
              looking rigid. It covers beautifully. It also builds a triangular lattice, and the
              visual system organises regularly spaced elements into contours by proximity and good
              continuation <Cite k={['wertheimer', 'glass']} />. Switch the plate to Half-step, turn
              on Trace the lattice, and you will not be able to unsee the diagonals afterwards.
            </P>
            <P>
              <strong>Jittered</strong> keeps the grid, because the grid is the only thing
              guaranteeing coverage, then destroys the evidence of it. Each butterfly lands within
              about a third of a cell of its mark, and each row gets its own random horizontal phase
              rather than a fixed offset.
            </P>
            <P>
              This is stratified sampling. Cook&apos;s work on stochastic sampling{' '}
              <Cite k={['cook86', 'cook84']} /> sets out the same trade: a regular lattice gives
              structured artefacts, uniform random gives noisy clumping, and jittering within cells
              buys the coverage of the first with the silence of the second. Renderers adopted it to
              kill aliasing; it applies just as well to things a person looks at directly.
            </P>

            <LayerDemo />

            <P>
              One grid of butterfly-shaped objects cannot close its own gaps, because the shape is
              wide, thin and concave at the corners. Three interleaved grids can. Depth is carried
              entirely by tone: the back layer sits in shade, the front catches a raked highlight and
              is the only one that casts a shadow.
            </P>
            <P>
              There is no blur anywhere in the stack. Blur costs a pass per frame, and at this scale
              it reads as out of focus rather than as far away, which is a different and less useful
              impression. Push the tone separation too far and the back layer stops reading as a
              butterfly at all: it becomes background, and the coverage it was providing is wasted.
            </P>

            <Detail label="How many butterflies" note="it depends on your screen">
              <FieldCount />
              <P>
                There is no fixed head count. The field is built from a fixed pixel pitch, with
                column spacings of 46, 50 and 56 pixels and rows at 0.62 of that, so the number is
                whatever it takes to cover the window. Every layer runs one column and one row past
                each edge, so a row shifted sideways still reaches the side of the screen.
              </P>
            </Detail>
          </Chapter>

          {/* ══ 5 ══ */}
          <Chapter
            id="flap"
            n="5"
            title="The flap"
            deck="A hinge that is not in the artwork."
          >
            <P>
              A wingbeat has one requirement everything else follows from: the body must stay put
              while the wings move. Scale the whole insect and you have not animated a flap, you have
              animated a squash. So the wings and the body are two separate sprites with two separate
              transforms.
            </P>

            <FlapDemo />

            <P>
              Turn the hinge off. Same fold value, same timing, same artwork, and it reads as
              something being stepped on. The separation is doing all the work.
            </P>
            <P>
              The rest is small lies that help. The sprite keeps 7 percent of its width at full fold
              rather than collapsing, so a closed butterfly still has an edge. The wings gain 12
              percent height as they close, because a folding membrane bunches. They rise slightly.
              The whole thing loses 16 percent opacity when shut, because a closed wing presents less
              surface to the light. Each is too subtle to notice alone. Remove them all and the flap
              goes flat.
            </P>

            <Note>
              You are not simulating a wing. You are producing the read of a wing at 55 pixels, seen
              for a fraction of a second, among thousands of others.
            </Note>

            <Detail label="The squeeze trick" note="why the fold costs one draw call">
              <P>
                Folding two wings over the back would mean rotating each half around the body axis:
                two draw calls per butterfly. But the wing sprite is symmetric about that exact axis,
                so scaling the whole sprite horizontally toward it is pixel-identical to folding two
                halves inward.
              </P>
              <Code caption="src/App.tsx, per butterfly, per frame">{`
// fold: 0 = wings flat open, 1 = wings closed over the back
const fold = amp * (1 - Math.cos(b.ph)) * 0.5;
const sx = (1 - fold * 0.93) * b.sz;
const sy = (1 + fold * 0.12) * b.sz;
const lift = -fold * SS * 0.05 * b.sz;
`}</Code>
              <P>
                The phase runs linearly and <K>(1 - cos) / 2</K> maps it onto a value that eases into
                both extremes and moves fastest through the middle, which is the velocity profile of
                a real wingbeat. The easing comes free from the trigonometry, with no curve to author.
              </P>
            </Detail>
          </Chapter>

          {/* ══ 6 ══ */}
          <Chapter
            id="answer"
            n="6"
            title="Answering the pointer"
            deck="The response is the affordance. The instruction text only pretends to be."
          >
            <P>
              Nothing about a screen full of butterflies says it can be touched. Most people have
              already moved the pointer and found out before the text arrives, so the response has to
              be legible from a single sweep.
            </P>

            <HoverDemo />

            <H3>Attack fast, release slow</H3>
            <P>
              A butterfly wakes at <K>0.17</K> of the remaining distance per frame and settles at{' '}
              <K>0.045</K>, so it comes alive about four times faster than it calms down. Press Make
              it symmetric and watch what disappears: with equal rates the disturbance sticks to the
              pointer like a mask, and the field stops reading as thousands of independent animals.
            </P>
            <P>
              The asymmetry is what makes the pointer drag a wake, and the wake is what implies each
              butterfly decided to settle in its own time. Animators call it follow-through{' '}
              <Cite k={['thomasjohnston', 'lasseter']} />.
            </P>

            <H3>The pause that makes it visible</H3>
            <P>
              Once shut, the wings stay shut for 0.42 seconds before beating. Drag Hold to zero and
              the closed pose vanishes from perception, because the wings pass through it faster than
              you can register it. This is anticipation, and it has a second job here: closed wings
              are what let the dark ground show through, which is what opens a visible hole where
              your pointer is.
            </P>
            <P>
              Influence falls off as distance squared rather than linearly, which keeps the effect
              concentrated in the middle and soft at the rim. A linear falloff draws a visible circle
              travelling through the field, and once you can see the circle you are looking at a
              cursor effect rather than at startled animals.
            </P>

            <Detail label="Two thresholds, not one" note="the state machine and why it needs hysteresis">
              <StateMachineDemo />
              <P>
                A butterfly shuts at <K>0.5</K> and only re-arms below <K>0.12</K>. A single
                threshold would let one sitting exactly on the line trigger and reset every few
                frames, which looks like a fault. Two thresholds is hysteresis, standardised by
                Schmitt&apos;s trigger circuit <Cite k="schmitt" /> for precisely this reason.
              </P>
              <P>
                Any time a continuous signal drives a discrete state change you want this, and
                forgetting it is one of the most common sources of flickering interface behaviour.
              </P>
            </Detail>
          </Chapter>

          {/* ══ 7 ══ */}
          <Chapter
            id="motion"
            n="7"
            title="Borrowed from animators"
            deck="Most of these decisions were settled in the 1930s by people drawing on paper."
          >
            <P>
              The twelve principles <Cite k="thomasjohnston" /> are not about cartoons. They are
              observations about how perception assigns intention to moving shapes, which is exactly
              an interface animation&apos;s problem. Lasseter&apos;s account of applying them in code{' '}
              <Cite k="lasseter" /> is the more directly useful reference once the in-betweens are
              interpolated by a machine.
            </P>

            <EasingDemo />

            <P>
              The four lanes cover the same distance in the same time and read as four different
              events. Linear reads as machinery, because nothing with mass accelerates instantly.
              Ease out is the shape of arriving. The release uses cubic ease in, because something
              leaving under its own power starts slowly and gains on you. Get it backwards and the
              swarm looks like it is being sucked upward by something off-screen.
            </P>

            <List
              items={[
                <>
                  <strong>Anticipation.</strong> The hold before beating, and the agitation that runs
                  ahead of the clearing front.
                </>,
                <>
                  <strong>Staging.</strong> Only the front layer casts shadows, so the eye is told
                  where the near plane is without being asked.
                </>,
                <>
                  <strong>Follow through.</strong> The slow settle, and the stragglers who go late.
                </>,
                <>
                  <strong>Secondary action.</strong> A sway and a rotational wobble, offset per
                  individual so neighbours never move in lockstep.
                </>,
                <>
                  <strong>Arcs.</strong> Rise and spread share an easing, so the path bends instead of
                  running straight.
                </>,
              ]}
            />

            <Note>
              If a motion feels mechanical the fault is almost never the duration. It is that
              everything is doing the same thing at the same time with the same curve.
            </Note>
          </Chapter>

          {/* ══ 8 ══ */}
          <Chapter
            id="release"
            n="8"
            title="The exit"
            deck="The part everyone remembers, so it gets more attention than everything it interrupts."
          >
            <P>
              The naive implementation is a radial delay: further from the click means later
              departure. It works, and it reads as a wipe, because a smooth gradient of delays
              produces a smooth boundary.
            </P>

            <ReleaseDemo />

            <H3>Two things are happening, not one</H3>
            <P>
              Under the cursor, a fingertip has touched a butterfly. That is contact, and contact
              travels <Em>downward</Em> through the stack: front layer, then the one beneath, then
              the one beneath that. Everywhere else nothing has been touched. What spreads is alarm,
              passed neighbour to neighbour, and a panicking butterfly does not care which layer its
              panicking neighbour is in.
            </P>
            <P>
              So the release is two phases with different logic, and switching the contact phase off
              in the plate makes the whole thing flatter: it stops saying anything about what a
              fingertip is.
            </P>

            <H3>Quantise the distance</H3>
            <P>
              Distance is floored into rings about one wingspan wide rather than used continuously.
              That single decision turns a wipe into a wave: the field clears one discrete shell at a
              time, and shells are legible in a way gradients are not. The first rings are spaced
              four times further apart than the later ones, because the opening is the part worth
              watching and at full cadence it is over before the eye can separate it.
            </P>
            <P>
              Some butterflies hesitate, weighted by distance from the click, which follows from the
              model: near the click the alarm is contact and everyone goes at once, further out it is
              second-hand and second-hand panic is uneven.
            </P>

            <H3>Wind up from each departure, not from the click</H3>

            <TimelineDemo />

            <P>
              There is a real pause between the contact phase and the outward wave. On paper that is
              a stall, and it does not read as one, because the wind-up for each butterfly is
              measured backwards from its own launch rather than forwards from the click.
            </P>
            <P>
              Every butterfly knows when it is leaving, so it can start stirring 1.5 seconds before
              and beating hard 0.6 seconds before. The agitation inherits the ordering of the
              departure for free and rolls outward exactly as the clearing does. There is always a
              wide band of stirring ahead of a narrow band of hard beating, ahead of the front
              itself. The gap is full of tension rather than empty.
            </P>

            <H3>Overlap the ending</H3>
            <P>
              The page underneath does not wait for the last butterfly. The handoff fires when the
              final departing butterfly is about two thirds through its flight, so the content
              arrives through a thinning swarm rather than after an empty beat. Sequential handoffs
              feel slow even when they are fast, because the eye notices the seam.
            </P>
            <P>
              And a press during the release means the field has been seen. Rather than cutting, the
              clock driving the whole sequence speeds up until what remains fits in about four tenths
              of a second, so you still watch it happen, just hurried. Deriving that rate from what is
              actually left means the wait after a skip is the same wherever you press it.
            </P>

            <Note>
              A transition is a story with an actor in it, not a curve applied to opacity. Decide what
              is physically happening and to whom, and most of the timings derive themselves.
            </Note>

            <Detail label="Inside one frame" note="the render loop, and two clocks">
              <FrameDemo />
              <P>
                Ground, three fields back to front with the front layer&apos;s shadows just before
                it, the cursor glow, then the vignette. Switching shadows to every layer costs
                measurably more for a difference you cannot see, which is why only the front layer
                casts one.
              </P>
              <P>
                The loop keeps two clocks. One drives per-butterfly integration and is clamped hard,
                because a large step makes it unstable. The other carries the release schedule and is
                clamped loosely, because it has to track the wall clock: an earlier version shared a
                single clamp, and any device that could not hold twenty frames a second then took
                proportionally <Em>longer</Em> to clear the field, which is precisely backwards for a
                loading screen.
              </P>
              <Note kind="watch">
                Any constant expressed as a fraction per frame is a frame rate assumption in
                disguise. The skip wind-up had the same fault: an ease of 0.34 per frame takes the
                same eight frames at any refresh rate, which is a fifth of a second at 60fps and most
                of a second at 10.
              </Note>
            </Detail>
          </Chapter>

          {/* ══ 9 ══ */}
          <Chapter id="takeaway" n="9" title="What transfers" deck="Almost none of it is about butterflies.">
            <List
              items={[
                <>
                  <strong>Decide what the wait is for before designing it.</strong> Progress,
                  distraction or agency. It is a product decision, not a visual one.
                </>,
                <>
                  <strong>Let the response be the affordance.</strong> Something that answers on the
                  next frame teaches faster than any label.
                </>,
                <>
                  <strong>Structure first, then break the structure.</strong> A grid guarantees
                  coverage, jitter removes the evidence, and pure randomness gives you neither{' '}
                  <Cite k="cook86" />.
                </>,
                <>
                  <strong>Asymmetric timings read as alive.</strong> Fast attack, slow release, for
                  anything responding to input.
                </>,
                <>
                  <strong>Hold the pose.</strong> An action too fast to register did not happen, no
                  matter how correct the curve was.
                </>,
                <>
                  <strong>Give the exit a story.</strong> Decide what is physically happening and to
                  whom, and the timings follow.
                </>,
                <>
                  <strong>Overlap your transitions.</strong> Sequential feels slow, overlapping feels
                  continuous.
                </>,
                <>
                  <strong>Vary per individual.</strong> Mechanical motion is usually everything doing
                  the same thing on the same curve at the same moment.
                </>,
              ]}
            />

            <Detail label="Making it survive real devices" note="resolution, touch, and an honest gap">
              <ResolutionDemo />
              <P>
                Fill cost scales with the square of the device pixel ratio, so it is capped. The CSS
                pixel is defined against a reference pixel rather than a hardware one{' '}
                <Cite k="cssunits" />, which is why a 55 pixel wingspan is about the same physical
                size everywhere and none of the sizing constants need per-device adjustment.
              </P>
              <P>
                The cap keys off the <K>pointer</K> media feature <Cite k="mq4" /> rather than
                viewport width. Width tells you about the window, not the hardware: a desktop browser
                dragged narrow is still a desktop GPU, and a phone in landscape is often wider than
                any sensible breakpoint.
              </P>
              <P>
                Touch has no hover, so the whole response in section 6 had to be rebuilt from
                touchmove. The trap on the far side: those handlers call <K>preventDefault</K>, which
                suppresses the click the browser would otherwise synthesise, so left running they
                silently swallow every tap on the revealed page.
              </P>
              <P>
                Fonts load through <K>&lt;link&gt;</K> behind <K>preconnect</K> hints{' '}
                <Cite k="hints" /> rather than a CSS <K>@import</K>, which would put the two requests
                in series.
              </P>
              <Note kind="watch">
                This build does not honour <K>prefers-reduced-motion</K> <Cite k="mq5" />. For a full
                screen of continuous movement that is a real accessibility failure, covered directly
                by WCAG 2.1 Success Criterion 2.3.3 <Cite k="wcag" />. The skip helps and is not a
                substitute. The honest fix is a static field with the release available immediately.
              </Note>
            </Detail>

            <Rule tight />
            <P>
              The loading screen is one file, <K>src/App.tsx</K>, with the artwork in{' '}
              <K>src/butterfly.ts</K>. The fastest way to understand any of it is to change a number
              and watch what breaks. Set <K>FALL</K> equal to <K>RISE</K> and lose the wake. Set{' '}
              <K>HOLD</K> to zero and lose the closed pose. Replace the per-row random phase with a
              fixed half step and summon the lattice from section 4.
            </P>

            <div style={{ marginTop: '2rem' }}>
              <button
                onClick={onReplay}
                style={{
                  appearance: 'none',
                  border: `1px solid ${T.rule}`,
                  cursor: 'pointer',
                  borderRadius: 2,
                  padding: '0.8rem 2rem',
                  background: T.ink,
                  color: T.paper,
                  fontFamily: T.sans,
                  fontSize: '0.72rem',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                }}
              >
                Put the butterflies back
              </button>
            </div>
          </Chapter>

          {/* ══ references ══ */}
          <Chapter id="references" n="" title="References">
            <P>
              In order of first citation. Where a page range could not be confirmed it is omitted
              rather than guessed.
            </P>
            <ReferenceList />
          </Chapter>

          <footer
            style={{
              marginTop: '2.5rem',
              paddingTop: '1.4rem',
              paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
              borderTop: `1px solid ${T.rule}`,
              fontSize: '0.72rem',
              letterSpacing: '0.1em',
              color: T.faint,
              textTransform: 'uppercase',
            }}
          >
            Pieris rapae · Canvas 2D · No animation library
          </footer>
        </main>
      </div>
    </div>
  );
}
