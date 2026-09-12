/**
 * Reorders src/masterclass/references.ts to match first-citation order in the
 * document, which is what the References section claims the numbering means.
 *
 * Run after editing the prose: `npm run refs`. It reports when the order was
 * already correct, so it doubles as a check.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const refsPath = path.join(root, 'src/masterclass/references.ts');
const docPath = path.join(root, 'src/masterclass/Masterclass.tsx');

const refsSrc = fs.readFileSync(refsPath, 'utf8');
const doc = fs.readFileSync(docPath, 'utf8');

// first-citation order, walking the document top to bottom
const order = [];
for (const m of doc.matchAll(/<Cite[\s\S]{0,140}?\/>/g)) {
  for (const q of m[0].matchAll(/['"]([a-zA-Z0-9]+)['"]/g)) {
    if (!order.includes(q[1])) order.push(q[1]);
  }
}

// Split the array literal into one entry per reference. Anchor on "= [" and
// not on the first "[" after the declaration, which belongs to Reference[].
const open = refsSrc.indexOf('export const REFERENCES');
if (open < 0) throw new Error('could not find the REFERENCES declaration');
const assign = refsSrc.indexOf('= [', open);
const start = assign + '= ['.length;
const end = refsSrc.lastIndexOf('];');
const body = refsSrc.slice(start, end);

const entries = [];
let depth = 0;
let current = '';
for (const ch of body) {
  if (ch === '{') depth++;
  if (depth > 0) current += ch;
  if (ch === '}') {
    depth--;
    if (depth === 0) {
      entries.push(current.trim());
      current = '';
    }
  }
}

const keyed = new Map();
for (const e of entries) {
  const k = e.match(/key:\s*'([^']+)'/)?.[1];
  if (!k) throw new Error(`entry without a key:\n${e.slice(0, 80)}`);
  keyed.set(k, e);
}

const missing = order.filter(k => !keyed.has(k));
if (missing.length) throw new Error(`cited but not defined: ${missing.join(', ')}`);
const uncited = [...keyed.keys()].filter(k => !order.includes(k));
if (uncited.length) {
  console.error(`WARNING, defined but never cited: ${uncited.join(', ')}`);
  console.error('An uncited reference is padding. Cite it or remove it.');
}

const wasCorrect = [...keyed.keys()].join(',') === order.concat(uncited).join(',');
const sorted = order.concat(uncited).map(k => keyed.get(k));
const rebuilt =
  refsSrc.slice(0, start) + '\n  ' + sorted.join(',\n  ') + ',\n' + refsSrc.slice(end);

fs.writeFileSync(refsPath, rebuilt);
console.log(
  wasCorrect
    ? `already in first-citation order (${order.length} references)`
    : `reordered ${order.length} references to match first citation`,
);
console.log(order.map((k, i) => `${i + 1}. ${k}`).join('  '));
