#!/usr/bin/env node
// Renders the theme-aware SVGs that README.md embeds, from data/profile.json,
// and refreshes the generated blocks between <!-- name:start/end --> markers.
//
//   node scripts/render.mjs            render from the checked-in data
//   node scripts/render.mjs --refresh  update the numbers with the GitHub CLI, then render
//
// No dependencies and no external fonts or images: every SVG is self-contained,
// so GitHub can serve it straight from this repository in light and dark themes.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataFile = join(root, 'data', 'profile.json');
const readmeFile = join(root, 'README.md');

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

// Primer-adjacent tokens. The chart series color passes 3:1 against both surfaces.
const THEMES = {
  light: {
    fg: '#1f2328', muted: '#59636e', faint: '#6e7781',
    border: '#d1d9e0', surface: '#f6f8fa', grid: '#d8dee4',
    accent: '#0969da', violet: '#8250df', green: '#1a7f37', series: '#2a78d6',
  },
  dark: {
    fg: '#f0f6fc', muted: '#9198a1', faint: '#7d8590',
    border: '#3d444d', surface: '#151b23', grid: '#2a313c',
    accent: '#4493f8', violet: '#ab7df8', green: '#3fb950', series: '#3987e5',
  },
};

const LANGUAGE_COLORS = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572a5',
  Swift: '#f05138', HTML: '#e34c26', Astro: '#ff5a03',
};

// ---------------------------------------------------------------- helpers

const esc = (value) => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const round = (n) => Math.round(n * 10) / 10;

// Approximate advance widths (em) for the system UI font: close enough to size
// pills and wrap copy. Cards refuse copy that would need more lines than they have.
function textWidth(text, size, { mono = false, bold = false } = {}) {
  if (mono) return [...text].length * size * 0.6;
  let em = 0;
  for (const ch of text) {
    if (" .,:;'’|!ilI".includes(ch)) em += 0.27;
    else if ('ftjr()[]-/'.includes(ch)) em += 0.35;
    else if ('mwMW@'.includes(ch)) em += 0.82;
    else if (/[A-Z]/.test(ch)) em += 0.64;
    else if (/[0-9]/.test(ch)) em += 0.56;
    else em += 0.53;
  }
  return em * size * (bold ? 1.06 : 1);
}

function wrap(text, width, size) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const compact = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n));

const DAY = 86_400_000;
const isoDate = (date) => date.toISOString().slice(0, 10);
const utcDate = (iso) => new Date(`${iso}T00:00:00Z`);
const addDays = (date, days) => new Date(date.getTime() + days * DAY);
const startOfWeek = (date) => {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return addDays(day, -((day.getUTCDay() + 6) % 7));
};
const formatDate = (iso, options) => utcDate(iso).toLocaleDateString('en-US', { timeZone: 'UTC', ...options });

function svg({ width, height, title, defs = '', style = '', body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title">
<title id="title">${esc(title)}</title>
<style>
text { font-family: ${SANS}; }
.mono { font-family: ${MONO}; }
${style.trim()}
@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
</style>
${defs ? `<defs>\n${defs.trim()}\n</defs>\n` : ''}${body.trim()}
</svg>
`;
}

// ---------------------------------------------------------------- hero

function hero(t, data) {
  const W = 900;
  const H = 300;
  const cx = 725;
  const cy = 150;
  const angles = [-90, -30, 30, 90, 150, 210];
  const nodes = data.hero.nodes.map((label, i) => {
    const a = (angles[i] * Math.PI) / 180;
    return { label, x: cx + 140 * Math.cos(a), y: cy + 100 * Math.sin(a), w: textWidth(label, 13, { mono: true }) + 26 };
  });

  const wires = nodes.map((n, i) => {
    const out = `M${cx} ${cy}L${round(n.x)} ${round(n.y)}`;
    const back = `M${round(n.x)} ${round(n.y)}L${cx} ${cy}`;
    const outward = i % 2 === 0;
    const timing = `animation-duration:${(2.6 + (i % 3) * 0.5).toFixed(1)}s;animation-delay:-${(i * 0.7).toFixed(1)}s`;
    return `<path d="${out}" class="wire"/>
<path d="${out}" class="flow${outward ? '' : ' in'}"/>
<path d="${outward ? out : back}" pathLength="100" class="packet" style="${timing}"/>`;
  }).join('\n');

  const pills = nodes.map((n) => `<g transform="translate(${round(n.x - n.w / 2)} ${round(n.y - 14)})">
<rect width="${round(n.w)}" height="28" rx="14" class="node"/>
<text x="${round(n.w / 2)}" y="18.5" text-anchor="middle" class="mono" font-size="13" fill="${t.fg}">${esc(n.label)}</text>
</g>`).join('\n');

  const [command, ...flags] = data.hero.prompt;
  // Stretches a radial gradient around the diagram's center so it fades out before the banner's edges.
  const ellipse = (sx, sy) => `translate(${cx} ${cy}) scale(${sx} ${sy}) translate(${-cx} ${-cy})`;
  const statusWidth = 30 + textWidth(data.hero.status, 13, { mono: true }) + 14;

  return svg({
    width: W,
    height: H,
    title: `${data.name}. ${data.hero.tagline.join(' ')}`,
    defs: `
<linearGradient id="core" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.violet}"/></linearGradient>
<radialGradient id="glow" cx="${cx}" cy="${cy}" r="150" gradientUnits="userSpaceOnUse" gradientTransform="${ellipse(1.3, 0.95)}"><stop offset="0" stop-color="${t.accent}" stop-opacity=".16"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient>
<radialGradient id="fade" cx="${cx}" cy="${cy}" r="200" gradientUnits="userSpaceOnUse" gradientTransform="${ellipse(1.2, 0.78)}"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="${t.border}"/></pattern>
<mask id="grid"><rect width="${W}" height="${H}" fill="url(#fade)"/></mask>`,
    style: `
.wire { fill: none; stroke: ${t.border}; stroke-width: 1.5; }
.flow { fill: none; stroke: ${t.accent}; stroke-opacity: .5; stroke-width: 1.5; stroke-dasharray: 2 8; animation: flow 1.4s linear infinite; }
.flow.in { animation-direction: reverse; }
.packet { fill: none; stroke: ${t.accent}; stroke-width: 5; stroke-linecap: round; stroke-dasharray: .6 99.4; animation: travel 3s linear infinite; }
.node { fill: ${t.surface}; stroke: ${t.border}; }
.halo { fill: none; stroke: ${t.accent}; stroke-width: 2; transform-box: fill-box; transform-origin: center; animation: halo 3s ease-out infinite; }
.live { animation: live 2s ease-in-out infinite; }
.cursor { animation: blink 1.1s steps(1) infinite; }
@keyframes flow { to { stroke-dashoffset: -20; } }
@keyframes travel { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -100; } }
@keyframes halo { 0% { transform: scale(1); opacity: .6; } 80%, 100% { transform: scale(1.8); opacity: 0; } }
@keyframes live { 50% { opacity: .35; } }
@keyframes blink { 50% { fill-opacity: 0; } }`,
    body: `
<rect width="${W}" height="${H}" fill="url(#dots)" mask="url(#grid)"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
<g transform="translate(32 38)">
<rect width="${round(statusWidth)}" height="28" rx="14" fill="${t.accent}" fill-opacity=".08" stroke="${t.accent}" stroke-opacity=".35"/>
<circle cx="16" cy="14" r="4.5" fill="${t.green}" class="live"/>
<text x="30" y="18.5" class="mono" font-size="13" fill="${t.fg}">${esc(data.hero.status)}</text>
</g>
<text x="32" y="126" font-size="48" font-weight="700" letter-spacing="-1" fill="${t.fg}">${esc(data.name)}</text>
<text x="32" y="170" font-size="20" fill="${t.fg}">${esc(data.hero.tagline[0])}</text>
<text x="32" y="198" font-size="20" fill="${t.muted}">${esc(data.hero.tagline[1])}</text>
<text x="32" y="262" class="mono" font-size="13" fill="${t.muted}"><tspan fill="${t.green}">$</tspan> <tspan fill="${t.fg}">${esc(command)}</tspan> <tspan fill="${t.accent}">${esc(flags.join(' '))}</tspan><tspan class="cursor" fill="${t.fg}">▍</tspan></text>
${wires}
${pills}
<circle cx="${cx}" cy="${cy}" r="30" class="halo"/>
<circle cx="${cx}" cy="${cy}" r="30" fill="url(#core)"/>
<text x="${cx}" y="${cy + 4.5}" text-anchor="middle" class="mono" font-size="13" font-weight="700" fill="#ffffff">${esc(data.hero.center)}</text>`,
  });
}

// ---------------------------------------------------------------- OpenWork card

function niceStep(max) {
  for (const step of [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]) {
    if (Math.ceil(max / step) <= 3) return step;
  }
  return 10 ** Math.ceil(Math.log10(max));
}

// A column with a 4px rounded data end and a square baseline.
function column(x, y, w, h) {
  const r = Math.min(4, h, w / 2);
  const base = y + h;
  return `M${round(x)} ${round(base)}V${round(y + r)}Q${round(x)} ${round(y)} ${round(x + r)} ${round(y)}H${round(x + w - r)}Q${round(x + w)} ${round(y)} ${round(x + w)} ${round(y + r)}V${round(base)}Z`;
}

function openworkCard(t, data) {
  const W = 900;
  const H = 260;
  const o = data.openwork;
  const weeks = o.weekly;
  const plot = { x: 476, y: 92, w: 396, h: 110 };
  const baseline = plot.y + plot.h;
  const max = Math.max(...weeks.map((w) => w.merged), 1);
  const step = niceStep(max);
  const top = Math.max(max * 1.12, step);
  const band = plot.w / weeks.length;
  const barWidth = Math.min(24, band * 0.62);
  const yOf = (value) => baseline - (value / top) * plot.h;

  const ticks = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  const grid = ticks.map((v) => `<line x1="${plot.x}" x2="${plot.x + plot.w}" y1="${round(yOf(v))}" y2="${round(yOf(v))}" stroke="${v === 0 ? t.border : t.grid}" stroke-width="1"/>
<text x="${plot.x - 10}" y="${round(yOf(v) + 4)}" text-anchor="end" font-size="11" class="tick" fill="${t.faint}">${v}</text>`).join('\n');

  const peak = weeks.reduce((best, w, i) => (w.merged > weeks[best].merged ? i : best), 0);
  const labelled = new Set([peak, weeks.length - 1]);
  let month = '';
  const columns = weeks.map((w, i) => {
    const x = plot.x + band * i + (band - barWidth) / 2;
    const y = yOf(w.merged);
    const parts = [];
    if (w.merged > 0) parts.push(`<path d="${column(x, y, barWidth, baseline - y)}" fill="${t.series}"/>`);
    if (labelled.has(i)) {
      parts.push(`<text x="${round(x + barWidth / 2)}" y="${round(y - 7)}" text-anchor="middle" font-size="12" font-weight="600" fill="${t.fg}">${w.merged}</text>`);
    }
    const m = formatDate(w.week, { month: 'short' });
    if (m !== month) {
      month = m;
      parts.push(`<text x="${round(x + barWidth / 2)}" y="${baseline + 18}" text-anchor="middle" font-size="11" fill="${t.faint}">${m}</text>`);
    }
    return parts.join('\n');
  }).join('\n');

  const since = formatDate(weeks[0].week, { month: 'long', year: 'numeric' });
  const updated = formatDate(o.updated, { month: 'short', day: 'numeric', year: 'numeric' });
  const repoX = 28 + textWidth('OpenWork', 24, { bold: true }) + 12;
  const rank = o.contributorRank ? `#${o.contributorRank}` : '—';

  return svg({
    width: W,
    height: H,
    title: `OpenWork: ${o.mergedPrs} merged pull requests since ${since}, ${rank} all-time contributor to ${o.repo}. Merged PRs per week peaked at ${weeks[peak].merged}.`,
    style: '.tick { font-variant-numeric: tabular-nums; }',
    body: `
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="${t.surface}" stroke="${t.border}"/>
<text x="28" y="52" font-size="24" font-weight="700" fill="${t.fg}">OpenWork</text>
<text x="${round(repoX)}" y="51" class="mono" font-size="13" fill="${t.faint}">${esc(o.repo)}</text>
<text x="28" y="76" font-size="14" fill="${t.muted}">${esc(o.tagline)}</text>
<text x="28" y="158" font-size="60" font-weight="700" letter-spacing="-1.5" fill="${t.fg}">${o.mergedPrs}</text>
<text x="28" y="184" font-size="15" fill="${t.muted}">merged pull requests</text>
<text x="28" y="204" font-size="13" fill="${t.faint}">since ${esc(since)}</text>
<text x="236" y="138" font-size="30" font-weight="700" fill="${t.fg}">${rank}</text>
<text x="236" y="158" font-size="13" fill="${t.muted}">all-time contributor</text>
<text x="236" y="198" font-size="30" font-weight="700" fill="${t.fg}">${compact(o.repoStars)}</text>
<text x="236" y="218" font-size="13" fill="${t.muted}">GitHub stars on the project</text>
<text x="28" y="240" font-size="12" fill="${t.faint}">Updated ${esc(updated)}</text>
<text x="${plot.x - 30}" y="52" font-size="13" font-weight="600" fill="${t.muted}">Merged PRs per week</text>
${grid}
${columns}`,
  });
}

// ---------------------------------------------------------------- project cards

function projectCard(t, p) {
  const W = 420;
  const H = 150;
  const pad = 22;
  const lines = wrap(p.description, W - pad * 2 - 16, 13.5);
  if (lines.length > 2) throw new Error(`${p.slug}: the description needs ${lines.length} lines; the card has two.`);

  const footer = [];
  let x = 0;
  const addText = (text, { mono = false } = {}) => {
    footer.push(`<text x="${round(x)}" y="4" font-size="12.5"${mono ? ' class="mono"' : ''} fill="${t.muted}">${esc(text)}</text>`);
    x += textWidth(text, 12.5, { mono }) + 18;
  };
  if (p.language) {
    footer.push(`<circle cx="5" cy="0" r="5" fill="${LANGUAGE_COLORS[p.language] ?? t.faint}"/>`);
    x = 15;
    addText(p.language);
  }
  if (p.stars >= 3) addText(`★ ${p.stars}`);
  if (p.install) addText(p.install, { mono: true });
  else if (p.site) addText(p.site);

  return svg({
    width: W,
    height: H,
    title: `${p.name}: ${p.description}`,
    body: `
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="12" fill="${t.surface}" stroke="${t.border}"/>
<text x="${pad}" y="32" class="mono" font-size="11" letter-spacing=".6" fill="${t.faint}">${esc(p.category.toUpperCase())}</text>
<text x="${pad}" y="58" font-size="19" font-weight="700" fill="${t.fg}">${esc(p.name)}</text>
<text x="${W - pad}" y="58" text-anchor="end" font-size="16" fill="${t.faint}">↗</text>
${lines.map((line, i) => `<text x="${pad}" y="${84 + i * 20}" font-size="13.5" fill="${t.muted}">${esc(line)}</text>`).join('\n')}
<g transform="translate(${pad} 128)">
${footer.join('\n')}
</g>`,
  });
}

// ---------------------------------------------------------------- link chips

const ICONS = {
  globe: '<circle cx="8" cy="8" r="6.5"/><ellipse cx="8" cy="8" rx="2.8" ry="6.5"/><path d="M1.5 8h13"/>',
  person: '<circle cx="8" cy="5.4" r="2.9"/><path d="M2.6 14.4c.8-3 2.9-4.6 5.4-4.6s4.6 1.6 5.4 4.6"/>',
  mail: '<rect x="1.5" y="3.5" width="13" height="9" rx="2"/><path d="m2.2 4.6 5.8 4.3 5.8-4.3"/>',
  compass: '<circle cx="8" cy="8" r="6.5"/><path d="m10.6 5.4-1.5 3.7-3.7 1.5 1.5-3.7z"/>',
};

function chip(t, link) {
  const H = 34;
  const labelWidth = textWidth(link.label, 13.5) * 1.06;
  const W = Math.ceil(38 + labelWidth + 10 + 12 + 14);
  return svg({
    width: W,
    height: H,
    title: link.label,
    body: `
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="${H / 2}" fill="${t.surface}" stroke="${t.border}"/>
<g transform="translate(14 9)" fill="none" stroke="${t.accent}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[link.icon]}</g>
<text x="38" y="21.5" font-size="13.5" fill="${t.fg}">${esc(link.label)}</text>
<text x="${W - 14}" y="21.5" text-anchor="end" font-size="12" fill="${t.faint}">↗</text>`,
  });
}

// ---------------------------------------------------------------- README blocks

const picture = (path, alt, width) => `<picture><source media="(prefers-color-scheme: dark)" srcset="${path}-dark.svg"><img src="${path}-light.svg" alt="${esc(alt)}"${width ? ` width="${width}"` : ''}></picture>`;

function blocks(data) {
  const o = data.openwork;
  const links = data.links
    .map((l) => `<a href="${l.href}">${picture(`assets/links/${l.slug}`, l.label)}</a>`)
    .join('\n');
  const projects = data.featured
    .map((p) => `<a href="https://github.com/${p.repo}">${picture(`assets/projects/${p.slug}`, `${p.name}: ${p.description}`, '49%')}</a>`)
    .join('\n');
  const weekly = [
    '<details>',
    '<summary>Merged PRs per week, as a table</summary>',
    '',
    '| Week of | Merged PRs |',
    '| --- | ---: |',
    ...o.weekly.map((w) => `| ${formatDate(w.week, { month: 'short', day: 'numeric' })} | ${w.merged} |`),
    '',
    '</details>',
  ].join('\n');
  return { links: `<p align="center">\n${links}\n</p>`, projects: `<p align="center">\n${projects}\n</p>`, weekly };
}

function updateReadme(data) {
  let readme;
  try {
    readme = readFileSync(readmeFile, 'utf8');
  } catch {
    return;
  }
  for (const [name, content] of Object.entries(blocks(data))) {
    const pattern = new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`);
    readme = readme.replace(pattern, `$1\n${content}\n$2`);
  }
  writeFileSync(readmeFile, readme);
}

// ---------------------------------------------------------------- refresh

const gh = (args) => JSON.parse(execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }));
const searchCount = (q) => gh(['api', '-X', 'GET', 'search/issues', '-f', `q=${q}`, '-f', 'per_page=1']).total_count;

function refresh(data) {
  const o = data.openwork;
  const merged = `repo:${o.repo} author:${data.login} is:pr is:merged`;
  o.mergedPrs = searchCount(merged);
  o.repoStars = gh(['api', `repos/${o.repo}`]).stargazers_count;
  const contributors = gh(['api', `repos/${o.repo}/contributors?per_page=100`]);
  const index = contributors.findIndex((c) => c.login.toLowerCase() === data.login.toLowerCase());
  o.contributorRank = index >= 0 ? index + 1 : null;

  // One search per complete Monday-to-Sunday week (UTC). The search API allows
  // 30 requests a minute, so maxWeeks stays well below that.
  const thisWeek = startOfWeek(new Date());
  const weeks = [];
  for (let w = startOfWeek(utcDate(o.since)); w < thisWeek; w = addDays(w, 7)) weeks.push(w);
  o.weekly = weeks.slice(-o.maxWeeks).map((w) => ({
    week: isoDate(w),
    merged: searchCount(`${merged} merged:${isoDate(w)}..${isoDate(addDays(w, 6))}`),
  }));
  while (o.weekly.length > 1 && o.weekly[0].merged === 0) o.weekly.shift();
  o.updated = new Date().toLocaleDateString('en-CA');

  for (const p of data.featured) {
    const repo = gh(['api', `repos/${p.repo}`]);
    p.stars = repo.stargazers_count;
    if (repo.language) p.language = repo.language;
  }
}

// ---------------------------------------------------------------- main

const data = JSON.parse(readFileSync(dataFile, 'utf8'));
if (process.argv.includes('--refresh')) {
  refresh(data);
  writeFileSync(dataFile, `${JSON.stringify(data, null, 2)}\n`);
}
if (!data.openwork.weekly.length) {
  throw new Error('data/profile.json has no weekly numbers yet; run with --refresh.');
}

const write = (path, content) => {
  const file = join(root, 'assets', path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
};

for (const [mode, t] of Object.entries(THEMES)) {
  write(`hero-${mode}.svg`, hero(t, data));
  write(`openwork-${mode}.svg`, openworkCard(t, data));
  for (const p of data.featured) write(`projects/${p.slug}-${mode}.svg`, projectCard(t, p));
  for (const l of data.links) write(`links/${l.slug}-${mode}.svg`, chip(t, l));
}
updateReadme(data);
console.log(`Rendered ${2 + data.featured.length * 2 + data.links.length * 2 + 2} SVGs · ${data.openwork.mergedPrs} merged OpenWork PRs · updated ${data.openwork.updated}`);
