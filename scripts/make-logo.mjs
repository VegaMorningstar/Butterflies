/**
 * Regenerates public/favicon.svg from the wing geometry in src/butterfly.ts.
 *
 * The mark and the field on screen are then the same shape by construction:
 * change the wing outline and run "npm run logo" to keep them in step.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'src/butterfly.ts'), 'utf8');

// pull the two outline literals straight out of the source
function grab(name) {
  const m = src.match(new RegExp(`export const ${name}: WingOutline = \\{([\\s\\S]*?)\\n\\};`));
  if (!m) throw new Error(`could not find ${name}`);
  const body = m[1];
  const start = JSON.parse(body.match(/start:\s*(\[[^\]]*\])/)[1]);
  const curvesRaw = body.match(/curves:\s*\[([\s\S]*)\]/)[1];
  const triples = [...curvesRaw.matchAll(/\[\s*(\[[^\]]*\])\s*,\s*(\[[^\]]*\])\s*,\s*(\[[^\]]*\])\s*\]/g)];
  const curves = triples.map(t => [JSON.parse(t[1]), JSON.parse(t[2]), JSON.parse(t[3])]);
  return { start, curves };
}

const SS = 150;
const cx = SS / 2;
const cy = SS * 0.5;
const wr = SS * 0.43;
const wh = SS * 0.4;
const P = (u, v) => [cx + wr * u, cy + wh * v];
const r = n => Math.round(n * 100) / 100;

function toPath(outline) {
  const [sx, sy] = P(...outline.start);
  let d = `M${r(sx)} ${r(sy)}`;
  for (const [c1, c2, e] of outline.curves) {
    const a = P(...c1);
    const b = P(...c2);
    const p = P(...e);
    d += `C${r(a[0])} ${r(a[1])} ${r(b[0])} ${r(b[1])} ${r(p[0])} ${r(p[1])}`;
  }
  return d + 'Z';
}

const fore = grab('FOREWING');
const hind = grab('HINDWING');
const forePath = toPath(fore);
const hindPath = toPath(hind);

// The apex, spot and antenna tip, all read from the same expressions the
// renderer uses in paintWings / paintBody.
const apex = P(1.02, -0.5);
const spot = P(0.58, -0.14);
const spotR = SS * 0.026;
const antennaTipX = cx + SS * 0.064;
const antennaTipY = cy - wh * 0.8;

// art bounds: the wing box plus the antennae above it
const artX = 3;
const artW = 144;
const artTop = antennaTipY - 3;
const artBottom = cy + wh * 0.84;
const artH = artBottom - artTop;

// fit into a 100 unit square with padding
const VB = 100;
const targetW = 92;
const scale = targetW / artW;
const tx = (VB - artW * scale) / 2 - artX * scale;
const ty = (VB - artH * scale) / 2 - artTop * scale;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}">
<defs>
<radialGradient id="w" cx="50%" cy="42%" r="62%">
<stop offset="0" stop-color="#dfe4e8"/>
<stop offset=".42" stop-color="#f8fafb"/>
<stop offset="1" stop-color="#fff"/>
</radialGradient>
<radialGradient id="a" gradientUnits="userSpaceOnUse" cx="${r(apex[0])}" cy="${r(apex[1])}" r="${r(wr * 0.34)}">
<stop offset="0" stop-color="#2f3136" stop-opacity=".95"/>
<stop offset=".5" stop-color="#3d4046" stop-opacity=".55"/>
<stop offset="1" stop-color="#787c82" stop-opacity="0"/>
</radialGradient>
<radialGradient id="s" gradientUnits="userSpaceOnUse" cx="${r(spot[0])}" cy="${r(spot[1])}" r="${r(spotR)}">
<stop offset="0" stop-color="#2a2b2f"/>
<stop offset=".62" stop-color="#32343a" stop-opacity=".9"/>
<stop offset="1" stop-color="#4e5158" stop-opacity="0"/>
</radialGradient>
<clipPath id="fw"><path d="${forePath}"/></clipPath>
</defs>
<rect width="${VB}" height="${VB}" rx="22" fill="#0b0e12"/>
<g transform="translate(${r(tx)} ${r(ty)}) scale(${r(scale)})">
<g id="h">
<path d="${hindPath}" fill="url(#w)" stroke="#4a4e55" stroke-opacity=".3" stroke-width="1"/>
<path d="${forePath}" fill="url(#w)" stroke="#4a4e55" stroke-opacity=".36" stroke-width="1"/>
<g clip-path="url(#fw)"><rect x="0" y="0" width="${SS}" height="${SS}" fill="url(#a)"/></g>
<ellipse cx="${r(spot[0])}" cy="${r(spot[1])}" rx="${r(spotR)}" ry="${r(spotR * 0.88)}" transform="rotate(-14 ${r(spot[0])} ${r(spot[1])})" fill="url(#s)"/>
</g>
<use href="#h" transform="translate(${SS} 0) scale(-1 1)"/>
<path d="M${cx} ${r(cy - wh * 0.52)}c2.6 0 3.4 2.4 3.4 6.2 0 9.4-1.5 22-3.4 26.6-1.9-4.6-3.4-17.2-3.4-26.6 0-3.8.8-6.2 3.4-6.2Z" fill="#7b818a" fill-opacity=".72"/>
<circle cx="${cx}" cy="${r(cy - wh * 0.5)}" r="${r(SS * 0.019)}" fill="#7b818a" fill-opacity=".8"/>
<g stroke="#9aa0a8" stroke-opacity=".62" stroke-width="1.5" fill="none" stroke-linecap="round">
<path d="M${r(cx - SS * 0.007)} ${r(cy - wh * 0.54)}Q${r(cx - SS * 0.046)} ${r(cy - wh * 0.68)} ${r(2 * cx - antennaTipX)} ${r(antennaTipY)}"/>
<path d="M${r(cx + SS * 0.007)} ${r(cy - wh * 0.54)}Q${r(cx + SS * 0.046)} ${r(cy - wh * 0.68)} ${r(antennaTipX)} ${r(antennaTipY)}"/>
</g>
</g>
</svg>`;

const compact = svg.replace(/\n/g, '');
fs.writeFileSync(path.join(root, 'public/favicon.svg'), svg + '\n');

console.log('wrote public/favicon.svg');
console.log('raw bytes      :', Buffer.byteLength(compact));
console.log('data uri bytes :', Buffer.byteLength('data:image/svg+xml,' + encodeURIComponent(compact)));
console.log();
console.log('forewing path:', forePath);
console.log('hindwing path:', hindPath);
