// Generates the Holo Damascus backdrop: contour lines of a domain-warped noise field,
// traced with marching squares into one SVG path. Usage: node gen.js [seed]
// Writes scene.svg (the mod's scene) and prototype.html (light + dark preview).
const fs = require('fs')
const path = require('path')

// --- knobs -----------------------------------------------------------------
const SEED = Number(process.argv[2] ?? 7)
const W = 1600, H = 1000        // design space; output is doubled so curve midpoints stay integers
const STEP = 5                  // sampling grid, px
const BAND = 0.085              // field distance between line pairs
const PAIR = 0.02               // gap inside a pair (the skin's double lines)
const SCALE = 1 / 520           // feature size
const WARP = 1.9                // how hard the field folds over itself
const EPS = 0.9                 // simplification tolerance, px
const MIN_POINTS = 5            // drop specks
const STROKE = 2.2              // in doubled space, so 1.1px at 1600 wide

// --- noise -----------------------------------------------------------------
const rand = (() => { let s = SEED * 2654435761 >>> 0; return () => ((s = Math.imul(s ^ s >>> 15, 2246822507) + 0x9e3779b9 >>> 0) / 4294967296) })()
const P = Array.from({ length: 256 }, (_, i) => i)
for (let i = 255; i > 0; i--) { const j = rand() * (i + 1) | 0; [P[i], P[j]] = [P[j], P[i]] }
const G = Array.from({ length: 256 }, () => { const a = rand() * Math.PI * 2; return [Math.cos(a), Math.sin(a)] })
const grad = (ix, iy, dx, dy) => { const g = G[P[(ix + P[iy & 255]) & 255]]; return g[0] * dx + g[1] * dy }
const fade = t => t * t * t * (t * (t * 6 - 15) + 10)
function perlin(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fade(fx), v = fade(fy)
  const a = grad(ix, iy, fx, fy), b = grad(ix + 1, iy, fx - 1, fy)
  const c = grad(ix, iy + 1, fx, fy - 1), d = grad(ix + 1, iy + 1, fx - 1, fy - 1)
  return a + u * (b - a) + v * (c - a + u * (d - b - c + a))
}
const fbm = (x, y) => perlin(x, y) + 0.5 * perlin(x * 2.03 + 11.7, y * 2.03 - 4.2)
function field(px, py) {
  const x = px * SCALE, y = py * SCALE * 1.25
  const wx = fbm(x + 31.4, y + 7.9), wy = fbm(x - 17.3, y + 54.1)
  return fbm(x + WARP * wx, y + WARP * wy)
}

// --- marching squares --------------------------------------------------------
const nx = Math.ceil(W / STEP) + 1, ny = Math.ceil(H / STEP) + 1
const f = new Float64Array(nx * ny)
let lo = Infinity, hi = -Infinity
for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
  const v = f[j * nx + i] = field(i * STEP, j * STEP)
  lo = Math.min(lo, v); hi = Math.max(hi, v)
}
function contours(level) {
  // each crossing lives on a grid edge; key edges so segments chain into polylines
  const pt = new Map(), adj = new Map()
  const cross = (i, j, horiz) => {
    const key = (j * nx + i) * 2 + (horiz ? 0 : 1)
    if (!pt.has(key)) {
      const a = f[j * nx + i], b = horiz ? f[j * nx + i + 1] : f[(j + 1) * nx + i], t = (level - a) / (b - a)
      pt.set(key, horiz ? [(i + t) * STEP, j * STEP] : [i * STEP, (j + t) * STEP])
    }
    return key
  }
  const link = (a, b) => { (adj.get(a) ?? adj.set(a, []).get(a)).push(b); (adj.get(b) ?? adj.set(b, []).get(b)).push(a) }
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const tl = f[j * nx + i] > level, tr = f[j * nx + i + 1] > level
    const bl = f[(j + 1) * nx + i] > level, br = f[(j + 1) * nx + i + 1] > level
    const e = []
    if (tl !== tr) e.push(cross(i, j, true))
    if (tr !== br) e.push(cross(i + 1, j, false))
    if (bl !== br) e.push(cross(i, j + 1, true))
    if (tl !== bl) e.push(cross(i, j, false))
    if (e.length === 2) link(e[0], e[1])
    else if (e.length === 4) { link(e[0], tl ? e[1] : e[3]); link(e[2], tl ? e[3] : e[1]) }
  }
  const seen = new Set(), lines = []
  const walk = start => {
    const out = [start]; seen.add(start)
    for (let cur = start; ;) {
      const nxt = adj.get(cur).find(k => !seen.has(k))
      if (nxt === undefined) break
      seen.add(nxt); out.push(nxt); cur = nxt
    }
    return out
  }
  for (const k of adj.keys()) if (!seen.has(k) && adj.get(k).length === 1) lines.push({ keys: walk(k), closed: false })
  for (const k of adj.keys()) if (!seen.has(k)) lines.push({ keys: walk(k), closed: true })
  return lines.map(l => ({ pts: l.keys.map(k => pt.get(k)), closed: l.closed }))
}

// --- simplify + emit -----------------------------------------------------------
function rdp(p, eps) {
  if (p.length < 3) return p
  const [ax, ay] = p[0], [bx, by] = p[p.length - 1], len = Math.hypot(bx - ax, by - ay) || 1
  let far = 0, idx = 0
  for (let i = 1; i < p.length - 1; i++) {
    const d = Math.abs((p[i][0] - ax) * (by - ay) - (p[i][1] - ay) * (bx - ax)) / len
    if (d > far) { far = d; idx = i }
  }
  return far <= eps ? [p[0], p[p.length - 1]] : [...rdp(p.slice(0, idx + 1), eps).slice(0, -1), ...rdp(p.slice(idx), eps)]
}
// Vertices are even integers in doubled space, so midpoints are exact and the
// `t` shorthand (control reflected through each midpoint) draws a smooth spline.
function emit({ pts, closed }) {
  let p = rdp(pts, EPS).map(([x, y]) => [Math.round(x) * 2, Math.round(y) * 2])
  p = p.filter((q, i) => i === 0 || q[0] !== p[i - 1][0] || q[1] !== p[i - 1][1])
  if (p.length < MIN_POINTS) return ''
  if (closed) p = [...p, p[0], p[1]]
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const start = closed ? mid(p[0], p[1]) : p[0]
  let [cx, cy] = start, d = `M${cx} ${cy}`
  const rel = (x, y) => { const s = `${x - cx}${y - cy < 0 ? '' : ' '}${y - cy}`; cx = x; cy = y; return s }
  const m1 = mid(p[1], p[2])
  d += `q${p[1][0] - cx}${p[1][1] - cy < 0 ? '' : ' '}${p[1][1] - cy} ${rel(m1[0], m1[1])}`
  for (let i = 2; i < p.length - 1; i++) { const m = mid(p[i], p[i + 1]); d += `t${rel(m[0], m[1])}` }
  if (!closed) d += `t${rel(p[p.length - 1][0], p[p.length - 1][1])}`
  return d
}
let d = ''
for (let base = Math.ceil(lo / BAND) * BAND; base < hi; base += BAND) {
  for (const level of [base, base + PAIR]) for (const line of contours(level)) d += emit(line)
}

// --- scene ---------------------------------------------------------------------
// Holo blotches: soft colour pools under the line mask, laid out on rings around the
// centre so the whole disc stays covered while the group turns.
const SPIN = 70                 // seconds per full turn of the sheen; lower = livelier
const hues = ['#ff5a4f', '#ffb02e', '#f4e04d', '#3ddc84', '#2fd6d0', '#4d7cff', '#8b5cf6', '#f062c0']
const ring = (n, dist, r, shift) => Array.from({ length: n }, (_, k) => {
  const a = (k / n) * Math.PI * 2 + shift
  return [hues[(k * 3 + shift * 2 | 0) % hues.length], Math.round(W + dist * Math.cos(a)), Math.round(H + dist * Math.sin(a)), r]
})
const pools = [[hues[5], W, H, 560], ...ring(6, 760, 620, 0.4), ...ring(11, 1560, 680, 1.1)]
const css = (light, dark) => `
.bg{fill:${light.bg}}.base{fill:${light.base}}.pool{opacity:${light.pool}}.hi{opacity:${light.hi}}
@media (prefers-color-scheme:dark){.bg{fill:${dark.bg}}.base{fill:${dark.base}}.pool{opacity:${dark.pool}}.hi{opacity:${dark.hi}}}
.dark .bg{fill:${dark.bg}}.dark .base{fill:${dark.base}}.dark .pool{opacity:${dark.pool}}.dark .hi{opacity:${dark.hi}}
.holo{transform-origin:${W}px ${H}px;animation:spin ${SPIN}s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.holo{animation:none}}`
const scene = (cls = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W * 2} ${H * 2}" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"${cls && ` class="${cls}"`}>
<style>${css(
  { bg: '#e6e9ef', base: '#8f99ad', pool: 0.85, hi: 0.9 },
  { bg: '#0e0f13', base: '#59627a', pool: 1, hi: 0 },
)}</style>
<defs>
<path id="dm" fill="none" stroke-width="${STROKE}" stroke-linecap="round" d="${d}"/>
<mask id="dmm" maskUnits="userSpaceOnUse" x="0" y="0" width="${W * 2}" height="${H * 2}"><use href="#dm" stroke="#fff"/></mask>
${pools.map(([c], i) => `<radialGradient id="p${i}"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`).join('')}
</defs>
<rect class="bg" width="100%" height="100%"/>
<use class="hi" href="#dm" stroke="#fff" transform="translate(1.6 1.6)"/>
<g mask="url(#dmm)"><rect class="base" width="100%" height="100%"/><g class="holo">${pools.map(([, x, y, r], i) => `<circle class="pool" cx="${x}" cy="${y}" r="${r}" fill="url(#p${i})"/>`).join('')}</g></g>
</svg>`

const out = scene()
fs.writeFileSync(path.join(__dirname, 'scene.svg'), out)
fs.writeFileSync(path.join(__dirname, 'prototype.html'), `<!doctype html><meta charset="utf-8"><title>Holo Damascus prototype</title>
<style>html,body{margin:0}.pane{height:100vh}</style>
<div class="pane">${scene('light')}</div><div class="pane">${scene('dark')}</div>`)
const hooks = path.join(__dirname, '..', 'hooks')
if (fs.existsSync(hooks)) fs.writeFileSync(path.join(hooks, 'scene.ts'), `// Generated by tools/gen.js; do not edit by hand.\nexport const SCENE = ${JSON.stringify(out)}\n`)
console.log(`seed ${SEED}: field ${lo.toFixed(2)}..${hi.toFixed(2)}, scene ${out.length} chars (limit 131072)`)
if (out.length > 131072) { console.error('TOO BIG: raise STEP/EPS/BAND'); process.exit(1) }
