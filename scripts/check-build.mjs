#!/usr/bin/env node
/**
 * npm run check-build — validates dist/ against platform limits.
 *  file names (A-Z a-z 0-9 . - _), file count <= 8000, total size (<= 30 MB YouTube, target < 25 MB),
 *  initial download (< 5 MB target, 15 MB hard), index.html + playgama-bridge-config.json present,
 *  config valid and placements identical to src/config/ads.ts, Bridge script is first in <head>,
 *  no source maps, no external URLs in index.html / JS.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const DIST = path.join(root, 'dist')
const MB = 1024 * 1024
const LIMITS = { files: 8000, totalHard: 30 * MB, totalTarget: 25 * MB, initialTarget: 5 * MB, initialHard: 15 * MB }
const SAFE = /^[A-Za-z0-9._-]+$/

const errors = []
const warnings = []
const ok = (m) => console.log(`  ✓ ${m}`)

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name)
    return d.isDirectory() ? walk(p) : [p]
  })
}

if (!fs.existsSync(DIST)) {
  console.error('dist/ missing — run npm run build first')
  process.exit(1)
}
const files = walk(DIST)
const rel = (f) => path.relative(DIST, f).split(path.sep).join('/')
const size = (f) => fs.statSync(f).size

console.log('check-build')
// names
const badNames = files.filter((f) => rel(f).split('/').some((seg) => !SAFE.test(seg)))
if (badNames.length) errors.push(`unsafe file names: ${badNames.map(rel).join(', ')}`)
else ok('file names ASCII-safe')
// count
if (files.length > LIMITS.files) errors.push(`${files.length} files > ${LIMITS.files}`)
else ok(`${files.length} files (<= ${LIMITS.files})`)
// maps
const maps = files.filter((f) => f.endsWith('.map'))
if (maps.length) errors.push(`source maps shipped: ${maps.map(rel).join(', ')}`)
else ok('no source maps')
// total
const total = files.reduce((s, f) => s + size(f), 0)
if (total > LIMITS.totalHard) errors.push(`total ${(total / MB).toFixed(2)} MB > 30 MB`)
else if (total > LIMITS.totalTarget) warnings.push(`total ${(total / MB).toFixed(2)} MB > 25 MB target`)
else ok(`total ${(total / MB).toFixed(2)} MB (target < 25 MB)`)

// index + config
const indexPath = path.join(DIST, 'index.html')
const cfgPath = path.join(DIST, 'playgama-bridge-config.json')
if (!fs.existsSync(indexPath)) errors.push('index.html missing in archive root')
else ok('index.html at root')
let cfg = null
if (!fs.existsSync(cfgPath)) errors.push('playgama-bridge-config.json missing next to index.html')
else {
  try {
    cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
    ok('playgama-bridge-config.json valid JSON')
  } catch (e) {
    errors.push(`playgama-bridge-config.json invalid: ${e.message}`)
  }
}
if (cfg) {
  const { INTERSTITIAL_PLACEMENTS, REWARDED_PLACEMENTS } = await import(path.join(root, 'src/config/ads.ts'))
  const same = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join()
  const inter = (cfg.advertisement?.interstitial?.placements ?? []).map((p) => p.id)
  const rew = (cfg.advertisement?.rewarded?.placements ?? []).map((p) => p.id)
  if (!same(inter, INTERSTITIAL_PLACEMENTS)) errors.push(`interstitial placements differ from config/ads.ts: ${inter}`)
  else if (!same(rew, REWARDED_PLACEMENTS)) errors.push(`rewarded placements differ from config/ads.ts: ${rew}`)
  else ok(`placements match config/ads.ts (${inter.length} interstitial, ${rew.length} rewarded)`)
  if ('minimumDelayBetweenInterstitial' in (cfg.advertisement ?? {}))
    warnings.push('minimumDelayBetweenInterstitial set — brief says keep platform default')
}

// index.html: Bridge first script, sync; no external URLs
let html = ''
if (fs.existsSync(indexPath)) {
  html = fs.readFileSync(indexPath, 'utf8')
  const head = html.split(/<\/head>/i)[0] ?? ''
  const firstScript = head.match(/<script\b[^>]*>/i)?.[0] ?? ''
  if (!/src="[^"]*playgama-bridge\.js"/.test(firstScript)) errors.push(`first <head> script is not the Bridge: ${firstScript}`)
  else if (/\b(async|defer|type="module")\b/.test(firstScript)) errors.push('Bridge script must load synchronously')
  else ok('Bridge script is the first <head> script, loaded synchronously')
  if (!fs.existsSync(path.join(DIST, 'playgama-bridge.js'))) errors.push('playgama-bridge.js not shipped (local mode)')
  const ext = [...html.matchAll(/(?:src|href)="(https?:)?\/\/[^"]+"/g)].map((m) => m[0])
  if (ext.length) errors.push(`external resources in index.html: ${ext.join(', ')}`)
  else ok('no external resources in index.html')
  if (!/<title>Spy Lab Academy Tycoon<\/title>/.test(html)) errors.push('<title> is not exactly "Spy Lab Academy Tycoon"')
  else ok('title "Spy Lab Academy Tycoon"')
}
// game JS: no external fetch targets (the Bridge runtime itself is allowed to talk to platforms)
const ownJs = files.filter((f) => f.endsWith('.js') && !f.endsWith('playgama-bridge.js'))
const extInJs = []
for (const f of ownJs) {
  const src = fs.readFileSync(f, 'utf8')
  for (const m of src.matchAll(/["'`](https?:\/\/[^"'`\s]+)["'`]/g)) {
    const url = m[1]
    if (/^https?:\/\/(www\.)?w3\.org\//.test(url)) continue // XML namespaces
    if (/threejs\.org|github\.com\/mrdoob/.test(url)) continue // three.js warning strings
    extInJs.push(`${rel(f)}: ${url}`)
  }
  if (/localStorage|sessionStorage|indexedDB|document\.cookie/.test(src)) {
    // three.js / preact never use these; any hit is ours and forbidden (rule 3.2.1)
    errors.push(`${rel(f)} references localStorage/sessionStorage/indexedDB/cookie`)
  }
}
if (extInJs.length) warnings.push(`URL strings in game JS (verify none is fetched):\n      ${extInJs.join('\n      ')}`)
else ok('no external URLs in game JS')

// initial download
const manifestPath = path.join(root, 'build-meta', 'vite-manifest.json')
if (!fs.existsSync(manifestPath)) {
  warnings.push('build-meta/vite-manifest.json missing — initial download not computed')
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const initial = new Set(['index.html', 'playgama-bridge.js', 'playgama-bridge-config.json'])
  const visit = (key, followDynamic) => {
    const e = manifest[key]
    if (!e) return
    initial.add(e.file)
    for (const c of e.css ?? []) initial.add(c)
    for (const a of e.assets ?? []) initial.add(a)
    for (const i of e.imports ?? []) visit(i, false)
    if (followDynamic) for (const d of e.dynamicImports ?? []) if (BOOT_PATH.has(d)) visit(d, true)
  }
  // Modules loaded before game_ready: entry -> game/boot (+ current language JSON, worst case one).
  const BOOT_PATH = new Set(['src/game/boot.ts'])
  const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry)
  visit(entryKey, true)
  const langFiles = Object.keys(manifest).filter((k) => /src\/i18n\/(?!en)\w+\.json$/.test(k))
  const biggestLang = langFiles.map((k) => manifest[k].file).sort((a, b) => size(path.join(DIST, b)) - size(path.join(DIST, a)))[0]
  if (biggestLang) initial.add(biggestLang)
  // Core audio from src/config/audio.ts
  const { AUDIO } = await import(path.join(root, 'src/config/audio.ts'))
  for (const g of ['music', 'sfx']) for (const [id, m] of Object.entries(AUDIO[g])) if (m.core) initial.add(`assets/audio/${id}.mp3`)
  // Core models (src/config/models.ts: core flag) + their animation libraries
  const { MODELS, CHARACTERS, ANIM_LIBS } = await import(path.join(root, 'src/config/models.ts'))
  for (const m of Object.values(MODELS)) if (m.core) initial.add(`assets/models/${m.file}`)
  for (const c of Object.values(CHARACTERS)) if (c.core) {
    initial.add(`assets/models/${c.file}`)
    initial.add(`assets/models/${ANIM_LIBS[c.anims]}`)
  }
  let initialBytes = 0
  const missing = []
  for (const f of initial) {
    const p = path.join(DIST, f)
    if (fs.existsSync(p)) initialBytes += size(p)
    else missing.push(f)
  }
  if (missing.length) warnings.push(`initial files not found: ${missing.join(', ')}`)
  const mb = (initialBytes / MB).toFixed(2)
  if (initialBytes > LIMITS.initialHard) errors.push(`initial download ${mb} MB > 15 MB hard limit`)
  else if (initialBytes > LIMITS.initialTarget) warnings.push(`initial download ${mb} MB > 5 MB target`)
  else ok(`initial download ${mb} MB (target < 5 MB, ${initial.size} files)`)
  fs.writeFileSync(
    path.join(root, 'build-meta', 'initial-files.json'),
    JSON.stringify({ bytes: initialBytes, files: [...initial].sort() }, null, 2),
  )
}

for (const w of warnings) console.log(`  ! ${w}`)
for (const e of errors) console.log(`  ✗ ${e}`)
console.log(errors.length ? `check-build FAILED (${errors.length})` : `check-build OK${warnings.length ? ` with ${warnings.length} warning(s)` : ''}`)
process.exit(errors.length ? 1 : 0)
