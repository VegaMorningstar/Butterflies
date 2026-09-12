/**
 * The bibliography.
 *
 * Cited by key rather than by number, so the numbering in the text is derived
 * from position in this array and cannot drift out of sync with it.
 *
 * Entries deliberately omit page ranges where the exact pagination is not
 * certain. A reference with a missing page range is still findable. A
 * reference with an invented one is worse than no reference at all.
 */

export interface Reference {
  key: string;
  authors: string;
  year: string;
  title: string;
  where: string;
  note?: string;
}

export const REFERENCES: Reference[] = [
  {
    key: 'maister',
    authors: 'Maister, D. H.',
    year: '1985',
    title: 'The psychology of waiting lines',
    where:
      'In J. A. Czepiel, M. R. Solomon & C. F. Surprenant (Eds.), The Service Encounter. Lexington Books',
    note: 'Source of the eight propositions, including that occupied time feels shorter than unoccupied time.',
  },
  {
    key: 'nah',
    authors: 'Nah, F. F.-H.',
    year: '2004',
    title: 'A study on tolerable waiting time: How long are web users willing to wait?',
    where: 'Behaviour & Information Technology, 23(3)',
  },
  {
    key: 'kahneman93',
    authors: 'Kahneman, D., Fredrickson, B. L., Schreiber, C. A., & Redelmeier, D. A.',
    year: '1993',
    title: 'When more pain is preferred to less: Adding a better end',
    where: 'Psychological Science, 4(6)',
    note: 'The experiment behind the peak-end rule.',
  },
  {
    key: 'redelmeier',
    authors: 'Redelmeier, D. A., & Kahneman, D.',
    year: '1996',
    title:
      "Patients' memories of painful medical treatments: Real-time and retrospective evaluations of two minimally invasive procedures",
    where: 'Pain, 66(1)',
  },
  {
    key: 'card',
    authors: 'Card, S. K., Robertson, G. G., & Mackinlay, J. D.',
    year: '1991',
    title: 'The Information Visualizer, an information workspace',
    where: "Proceedings of CHI '91, ACM",
    note: 'Where the 0.1, 1 and 10 second interaction timescales are laid out.',
  },
  {
    key: 'nielsen',
    authors: 'Nielsen, J.',
    year: '1993',
    title: 'Usability Engineering',
    where: 'Morgan Kaufmann',
    note: 'Chapter 5 restates the three response-time limits for interface work.',
  },
  {
    key: 'doherty',
    authors: 'Doherty, W. J., & Thadhani, A. J.',
    year: '1982',
    title: 'The economic value of rapid response time',
    where: 'IBM Corporation',
    note: 'The origin of the 400 ms figure now usually called the Doherty threshold.',
  },
  {
    key: 'inp',
    authors: 'Google (web.dev)',
    year: '2024',
    title: 'Interaction to Next Paint',
    where: 'web.dev/articles/inp',
    note: 'The modern field form of the response thresholds. INP replaced First Input Delay as a Core Web Vital in 2024 and treats 200ms or less as good, which is roughly where the older laboratory numbers landed.',
  },
  {
    key: 'farin',
    authors: 'Farin, G.',
    year: '2002',
    title: 'Curves and Surfaces for CAGD: A Practical Guide',
    where: 'Morgan Kaufmann, 5th edition',
    note: 'Standard treatment of the cubic Bezier curves the wing outline is made of.',
  },
  {
    key: 'html',
    authors: 'WHATWG',
    year: 'current',
    title: 'HTML Living Standard',
    where: 'html.spec.whatwg.org',
    note: 'The canvas 2D context, and the rule that animation frame callbacks only run for a fully active document.',
  },
  {
    key: 'porterduff',
    authors: 'Porter, T., & Duff, T.',
    year: '1984',
    title: 'Compositing digital images',
    where: "Computer Graphics (SIGGRAPH '84), 18(3)",
    note: 'Defines the compositing operators that canvas exposes, source-atop among them.',
  },
  {
    key: 'aldous',
    authors: 'Aldous, D.',
    year: '1989',
    title: 'Probability Approximations via the Poisson Clumping Heuristic',
    where: 'Springer',
    note: 'The formal treatment of the fact that random points clump.',
  },
  {
    key: 'wertheimer',
    authors: 'Wertheimer, M.',
    year: '1923',
    title: 'Untersuchungen zur Lehre von der Gestalt II',
    where: 'Psychologische Forschung, 4',
    note: 'The grouping laws, including proximity and good continuation.',
  },
  {
    key: 'glass',
    authors: 'Glass, L.',
    year: '1969',
    title: 'Moire effect from random dots',
    where: 'Nature, 223',
    note: 'On the visual system finding structure in fields of dots.',
  },
  {
    key: 'cook86',
    authors: 'Cook, R. L.',
    year: '1986',
    title: 'Stochastic sampling in computer graphics',
    where: 'ACM Transactions on Graphics, 5(1)',
    note: 'Why jittered sampling beats both a regular lattice and uniform random placement.',
  },
  {
    key: 'cook84',
    authors: 'Cook, R. L., Porter, T., & Carpenter, L.',
    year: '1984',
    title: 'Distributed ray tracing',
    where: "Computer Graphics (SIGGRAPH '84), 18(3)",
  },
  {
    key: 'thomasjohnston',
    authors: 'Thomas, F., & Johnston, O.',
    year: '1981',
    title: 'The Illusion of Life: Disney Animation',
    where: 'Abbeville Press',
    note: 'The twelve principles in their original form.',
  },
  {
    key: 'lasseter',
    authors: 'Lasseter, J.',
    year: '1987',
    title: 'Principles of traditional animation applied to 3D computer animation',
    where: "Computer Graphics (SIGGRAPH '87), 21(4)",
    note: 'The translation of those principles to work done by machine rather than by hand.',
  },
  {
    key: 'schmitt',
    authors: 'Schmitt, O. H.',
    year: '1938',
    title: 'A thermionic trigger',
    where: 'Journal of Scientific Instruments, 15(1)',
    note: 'The two-threshold circuit that the hover state machine borrows from.',
  },
  {
    key: 'valhead',
    authors: 'Head, V.',
    year: '2016',
    title: 'Designing Interface Animation: Meaningful Motion for User Experience',
    where: 'Rosenfeld Media',
    note: 'The animation principles worked through for interfaces rather than for characters. The most directly useful book here for a designer.',
  },
  {
    key: 'nabors',
    authors: 'Nabors, R.',
    year: '2017',
    title: 'Animation at Work',
    where: 'A Book Apart',
    note: 'Short, and good on the prior question of whether a motion earns its place at all.',
  },
  {
    key: 'material3',
    authors: 'Google',
    year: 'current',
    title: 'Material Design 3: Motion',
    where: 'm3.material.io/styles/motion',
    note: 'A shipping design system stating easing and duration as concrete tokens, which is the form these decisions usually reach a team in.',
  },
  {
    key: 'cssunits',
    authors: 'W3C',
    year: 'current',
    title: 'CSS Values and Units Module Level 4',
    where: 'w3.org/TR/css-values-4',
    note: 'Defines the CSS reference pixel, which is why one CSS pixel is roughly the same physical size across devices.',
  },
  {
    key: 'mq4',
    authors: 'W3C',
    year: 'current',
    title: 'Media Queries Level 4',
    where: 'w3.org/TR/mediaqueries-4',
    note: 'The pointer feature, used here to tell a touch device from a mouse one.',
  },
  {
    key: 'hints',
    authors: 'W3C',
    year: 'current',
    title: 'Resource Hints',
    where: 'w3.org/TR/resource-hints',
    note: 'preconnect, used to open the font connections early.',
  },
  {
    key: 'mq5',
    authors: 'W3C',
    year: 'current',
    title: 'Media Queries Level 5',
    where: 'w3.org/TR/mediaqueries-5',
    note: 'prefers-reduced-motion.',
  },
  {
    key: 'wcag',
    authors: 'W3C',
    year: '2023',
    title: 'Web Content Accessibility Guidelines (WCAG) 2.2',
    where: 'w3.org/TR/WCAG22',
    note: 'Success Criterion 2.3.3, Animation from Interactions. 2.2 is the current Recommendation; the criterion is unchanged from 2.1.',
  },
  {
    key: 'applehig',
    authors: 'Apple',
    year: 'current',
    title: 'Human Interface Guidelines: Motion',
    where: 'developer.apple.com/design/human-interface-guidelines/motion',
    note: 'Includes the platform guidance on honouring a reduced motion preference.',
  },
];

const INDEX = new Map(REFERENCES.map((r, i) => [r.key, i + 1]));

export function refNumber(key: string): number {
  const n = INDEX.get(key);
  if (!n) throw new Error(`unknown reference: ${key}`);
  return n;
}
