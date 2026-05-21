// Generates all PWA + iOS icons from a vector SVG design.
// Run with:  node scripts/generate-icons.js

import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../public');
mkdirSync(publicDir, { recursive: true });

// ─────────────────────────────────────────────────────────
//  Wheel geometry helpers (all at 1024×1024 then scaled)
// ─────────────────────────────────────────────────────────
const S  = 1024;           // master canvas size
const cx = S / 2;
const cy = S / 2;
const R  = 390;            // wheel outer radius
const HR = 110;            // hub radius

function pt(deg) {
  const rad = (deg * Math.PI) / 180;
  return [
    (cx + R * Math.cos(rad)).toFixed(1),
    (cy + R * Math.sin(rad)).toFixed(1),
  ];
}

// 8 segments, starting at top (−90°), 45° each
// Even indices = Hannah (pink), odd = Elvie (purple)
const angles = [-90, -45, 0, 45, 90, 135, 180, 225];
const pts    = angles.map(pt);

function seg(i) {
  const [x1, y1] = pts[i];
  const [x2, y2] = pts[(i + 1) % 8];
  return `M${cx},${cy} L${x1},${y1} A${R},${R} 0 0,1 ${x2},${y2} Z`;
}

const HANNAH  = ['#FF1A6E', '#FF3D85', '#FF1A6E', '#FF3D85'];
const ELVIE   = ['#6600FF', '#7B2BFF', '#6600FF', '#7B2BFF'];

let segments = '';
for (let i = 0; i < 8; i++) {
  const fill = i % 2 === 0 ? HANNAH[Math.floor(i / 2)] : ELVIE[Math.floor(i / 2)];
  segments += `<path d="${seg(i)}" fill="${fill}"/>`;
}

// Divider lines
let dividers = '';
for (const [x, y] of pts) {
  dividers += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(255,255,255,0.22)" stroke-width="3"/>`;
}

// ─────────────────────────────────────────────────────────
//  Full SVG string
// ─────────────────────────────────────────────────────────
const SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <!-- App background gradient -->
  <radialGradient id="bg" cx="50%" cy="42%" r="62%">
    <stop offset="0%"   stop-color="#1e1e42"/>
    <stop offset="100%" stop-color="#080810"/>
  </radialGradient>

  <!-- Hub gem gradient -->
  <linearGradient id="hub" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%"   stop-color="#FFF8DC"/>
    <stop offset="28%"  stop-color="#FFD700"/>
    <stop offset="58%"  stop-color="#FFA500"/>
    <stop offset="85%"  stop-color="#FFD700"/>
    <stop offset="100%" stop-color="#8B6914"/>
  </linearGradient>

  <!-- Dome shine -->
  <radialGradient id="dome" cx="40%" cy="30%" r="58%">
    <stop offset="0%"   stop-color="rgba(255,255,255,0.20)"/>
    <stop offset="48%"  stop-color="rgba(255,255,255,0.05)"/>
    <stop offset="100%" stop-color="rgba(0,0,0,0.22)"/>
  </radialGradient>

  <!-- Hub shine -->
  <radialGradient id="hubShine" cx="35%" cy="30%" r="60%">
    <stop offset="0%"   stop-color="rgba(255,255,255,0.65)"/>
    <stop offset="55%"  stop-color="rgba(255,255,255,0.10)"/>
    <stop offset="100%" stop-color="rgba(0,0,0,0.18)"/>
  </radialGradient>

  <!-- Gold glow filter -->
  <filter id="goldGlow" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>

<!-- ── Background ── -->
<rect width="${S}" height="${S}" rx="220" ry="220" fill="url(#bg)"/>

<!-- ── Subtle background star field ── -->
${Array.from({length:28}, (_,i) => {
  const x = 50 + Math.sin(i*37.1)*440, y = 50 + Math.cos(i*61.3)*440;
  const r = 1 + (i%3)*0.8, op = 0.08 + (i%4)*0.06;
  return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r}" fill="white" opacity="${op}"/>`;
}).join('')}

<!-- ── Wheel segments ── -->
${segments}

<!-- ── Segment dividers ── -->
${dividers}

<!-- ── Dome shine overlay ── -->
<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#dome)"/>

<!-- ── Gold outer ring (layered) ── -->
<circle cx="${cx}" cy="${cy}" r="${R + 12}" fill="none" stroke="rgba(255,215,0,0.28)" stroke-width="32" filter="url(#goldGlow)"/>
<circle cx="${cx}" cy="${cy}" r="${R + 6}"  fill="none" stroke="#3A2800" stroke-width="22"/>
<circle cx="${cx}" cy="${cy}" r="${R + 6}"  fill="none" stroke="#FFD700" stroke-width="16"/>
<circle cx="${cx}" cy="${cy}" r="${R + 6}"  fill="none" stroke="#FFE566" stroke-width="6"/>
<circle cx="${cx}" cy="${cy}" r="${R + 6}"  fill="none" stroke="rgba(255,255,210,0.7)" stroke-width="2"/>

<!-- ── Outer tick marks (game-show style) ── -->
${Array.from({length:32}, (_,i) => {
  const a = (i/32)*360 - 90;
  const r1 = R + 30, r2 = R + 48;
  const rad = a * Math.PI / 180;
  const x1 = (cx + r1*Math.cos(rad)).toFixed(1), y1 = (cy + r1*Math.sin(rad)).toFixed(1);
  const x2 = (cx + r2*Math.cos(rad)).toFixed(1), y2 = (cy + r2*Math.sin(rad)).toFixed(1);
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(255,215,0,0.55)" stroke-width="${i%4===0?4:2}"/>`;
}).join('')}

<!-- ── Centre hub ── -->
<circle cx="${cx}" cy="${cy}" r="${HR + 12}" fill="#2A1800"/>
<circle cx="${cx}" cy="${cy}" r="${HR + 8}"  fill="#5A4000"/>
<circle cx="${cx}" cy="${cy}" r="${HR}"       fill="url(#hub)"/>
<circle cx="${cx}" cy="${cy}" r="${HR}"       fill="url(#hubShine)"/>

<!-- ── "R" text in hub ── -->
<text x="${cx}" y="${cy + 14}"
  font-family="Arial Black, -apple-system, Helvetica Neue, sans-serif"
  font-size="120" font-weight="900"
  fill="#2A1200"
  text-anchor="middle" dominant-baseline="middle"
  opacity="0.9">R</text>

<!-- ── Pointer triangle at top ── -->
<polygon
  points="${cx-30},${cy-R-52} ${cx+30},${cy-R-52} ${cx},${cy-R-10}"
  fill="#FFD700" filter="url(#goldGlow)"/>
<polygon
  points="${cx-28},${cy-R-50} ${cx+28},${cy-R-50} ${cx},${cy-R-12}"
  fill="#FFE566"/>
</svg>`;

// ─────────────────────────────────────────────────────────
//  Render PNG at multiple sizes
// ─────────────────────────────────────────────────────────
const SIZES = [
  { size: 512,  name: 'icon-512.png'        },
  { size: 192,  name: 'icon-192.png'        },
  { size: 180,  name: 'apple-touch-icon.png'},
  { size: 32,   name: 'favicon-32.png'      },
];

for (const { size, name } of SIZES) {
  const resvg = new Resvg(SVG, {
    fitTo: { mode: 'width', value: size },
  });
  const png = resvg.render().asPng();
  writeFileSync(join(publicDir, name), png);
  console.log(`✓  public/${name}  (${size}×${size})`);
}

console.log('\nAll icons generated.');
