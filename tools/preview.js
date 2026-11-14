// Builds the README images: the real backdrop scene behind a mock chat window with sample text.
// Usage: node tools/preview.js   (needs Google Chrome; writes docs/light.png and docs/dark.png)
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const root = path.join(__dirname, '..')
const src = fs.readFileSync(path.join(root, 'hooks', 'scene.ts'), 'utf8')
const SCENE = JSON.parse(src.slice(src.indexOf('"')))
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// Same anchors and roles as hooks/register.tsx.
const modes = {
  light: { s0: '#e6e9ef', s1: '#eff1f5', s2: '#f8f9fb', t1: '#1c1e24', t2: '#474b55', t3: '#5a5f6b', line: '#c9ced8', accent: '#5548e0', danger: '#b9342f', success: '#177a5f', warning: '#946608', pro: '#a13bb5' },
  dark: { s0: '#0e0f13', s1: '#15171c', s2: '#1b1e24', t1: '#eef0f4', t2: '#c6cad3', t3: '#a2a7b2', line: '#2c303a', accent: '#9a90ff', danger: '#f0807b', success: '#4fd0aa', warning: '#e0b04a', pro: '#dd8cec' },
}
const page = (mode, c) => `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{font:15px/1.55 -apple-system,system-ui,sans-serif;color:${c.t1};background:${c.s0}}
.bg{position:fixed;inset:0}.bg svg{display:block}
.app{position:relative;display:flex;height:100%}
.glass{background:${c.s1}b3;backdrop-filter:blur(4px);border:1px solid ${c.line}}
.side{width:250px;border-width:0 1px 0 0;padding:18px 14px;font-size:13.5px;color:${c.t2}}
.side h4{margin:18px 8px 6px;font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:${c.t3}}
.side div{padding:6px 8px;border-radius:7px}.side .on{background:${c.s2};color:${c.t1}}
.new{background:${c.accent};color:#fff!important;text-align:center;font-weight:600}
.main{flex:1;display:flex;flex-direction:column;align-items:center;padding:34px 24px 26px}
.col{width:100%;max-width:720px;display:flex;flex-direction:column;gap:16px;flex:1}
.me{align-self:flex-end;max-width:76%;padding:10px 15px;border-radius:16px;background:${c.s2};border:1px solid ${c.line}}
.card{padding:16px 18px;border-radius:14px}
.card p{margin:0 0 10px}.muted{color:${c.t3};font-size:13px}
pre{margin:0;padding:14px 16px;border-radius:10px;background:${c.s2};border:1px solid ${c.line};font:13px/1.6 ui-monospace,Menlo,monospace}
.k{color:${c.accent}}.s{color:${c.success}}.n{color:${c.pro}}.f{color:${c.danger}}.v{color:${c.warning}}.c{color:${c.t3}}
.tool{display:flex;gap:8px;align-items:center;font-size:13px;color:${c.t2}}.dot{width:8px;height:8px;border-radius:50%;background:${c.success}}
.box{margin-top:auto;padding:14px 16px;border-radius:16px;color:${c.t3};display:flex;justify-content:space-between}
.send{width:26px;height:26px;border-radius:50%;background:${c.accent}}
</style>
<div class="bg">${SCENE.replace('<svg ', `<svg class="${mode}" `).replace(/@media \(prefers-color-scheme:dark\)\{[^@]*?\}\}/, '')}</div>
<div class="app">
  <div class="side glass">
    <div class="new">New session</div>
    <h4>Today</h4><div class="on">Greeting helper</div><div>Tidy the changelog</div><div>Flaky test hunt</div>
    <h4>Yesterday</h4><div>Colour palette ideas</div><div>Release checklist</div>
  </div>
  <div class="main"><div class="col">
    <div class="me">Write a small function that greets someone by name, with a test.</div>
    <div class="card glass">
      <p>Here is a greeting helper and a quick check that it works.</p>
      <pre><span class="c">// greet.ts</span>
<span class="k">export function</span> <span class="f">greet</span>(<span class="v">name</span>: <span class="k">string</span>, <span class="v">times</span> = <span class="n">1</span>) {
  <span class="k">const</span> <span class="v">line</span> = <span class="s">\`Hello, \${name}!\`</span>
  <span class="k">return</span> <span class="f">Array</span>(<span class="v">times</span>).<span class="f">fill</span>(<span class="v">line</span>).<span class="f">join</span>(<span class="s">' '</span>)
}

<span class="f">assert</span>(<span class="f">greet</span>(<span class="s">'Ada'</span>, <span class="n">2</span>) === <span class="s">'Hello, Ada! Hello, Ada!'</span>)</pre>
    </div>
    <div class="tool"><span class="dot"></span>Ran 1 test, 1 passed</div>
    <div class="card glass"><p style="margin:0">The test passes. <span class="muted">Want a version that handles an empty name?</span></p></div>
    <div class="box glass"><span>Reply…</span><span class="send"></span></div>
  </div></div>
</div>`

fs.mkdirSync(path.join(root, 'docs'), { recursive: true })
for (const [mode, c] of Object.entries(modes)) {
  const html = path.join(root, 'docs', `.preview-${mode}.html`)
  fs.writeFileSync(html, page(mode, c))
  execFileSync(CHROME, ['--headless=new', '--hide-scrollbars', '--force-device-scale-factor=2', '--window-size=1280,800', '--virtual-time-budget=2000', `--screenshot=${path.join(root, 'docs', `${mode}.png`)}`, `file://${html}`], { stdio: 'ignore' })
  fs.rmSync(html)
  console.log(`docs/${mode}.png`)
}
