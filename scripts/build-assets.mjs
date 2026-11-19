#!/usr/bin/env node
/**
 * npm run assets — packs assets-src/ (raw, never shipped) into public/assets/.
 *  - models: .glb/.gltf -> gltf-transform (prune, dedup, weld, quantize, meshopt) -> .glb
 *  - audio:  every id in src/config/audio.ts -> public/assets/audio/<id>.mp3
 *            source assets-src/audio/{music,sfx}/<id>.(mp3|ogg|wav|flac); non-mp3 via ffmpeg.
 *            Missing ids get a clearly marked SILENT placeholder file and are reported.
 *  - fonts:  .woff2/.woff/.ttf copied (subset in Phase 6)
 *  - ui:     .svg/.png copied
 * Writes build-meta/asset-report.json with placeholders + sizes.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(root, 'assets-src')
const OUT = path.join(root, 'public', 'assets')
const SAFE = /^[A-Za-z0-9._-]+$/

const { AUDIO } = await import(path.join(root, 'src/config/audio.ts'))

const report = { generatedAt: new Date().toISOString(), placeholders: [], models: [], audio: [], fonts: [], ui: [], warnings: [] }

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name)
    return d.isDirectory() ? walk(p) : [p]
  })
}

function safeName(file) {
  const base = path.basename(file)
  const clean = base.replace(/[^A-Za-z0-9._-]+/g, '_')
  if (clean !== base) report.warnings.push(`renamed "${base}" -> "${clean}" (archive allows only A-Z a-z 0-9 . - _)`)
  return clean
}

function hasFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

fs.mkdirSync(OUT, { recursive: true })

// ---------- audio ----------
const audioOut = path.join(OUT, 'audio')
fs.rmSync(audioOut, { recursive: true, force: true })
fs.mkdirSync(audioOut, { recursive: true })
const ffmpeg = hasFfmpeg()
const placeholderPath = path.join(SRC, 'placeholders', 'silence.mp3')

function ensurePlaceholder() {
  if (fs.existsSync(placeholderPath)) return true
  if (!ffmpeg) return false
  fs.mkdirSync(path.dirname(placeholderPath), { recursive: true })
  // PLACEHOLDER ONLY: 1 s of digital silence so the audio pipeline and mute logic can be
  // exercised before real assets exist. Never used as a sound design substitute.
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=22050:cl=mono', '-t', '1',
    '-c:a', 'libmp3lame', '-b:a', '32k', placeholderPath])
  return true
}

const audioSources = walk(path.join(SRC, 'audio'))
for (const group of ['music', 'sfx']) {
  for (const id of Object.keys(AUDIO[group])) {
    const dest = path.join(audioOut, `${id}.mp3`)
    const src = ['mp3', 'ogg', 'wav', 'flac', 'm4a']
      .map((ext) => audioSources.find((f) => path.basename(f).toLowerCase() === `${id}.${ext}`))
      .find(Boolean)
    if (src && src.endsWith('.mp3')) {
      fs.copyFileSync(src, dest)
    } else if (src && ffmpeg) {
      const br = group === 'music' ? '96k' : '80k'
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-c:a', 'libmp3lame', '-b:a', br, dest])
    } else {
      if (src && !ffmpeg) report.warnings.push(`${id}: ${path.basename(src)} needs ffmpeg to convert`)
      if (!ensurePlaceholder()) {
        report.warnings.push(`${id}: no source and no ffmpeg for a placeholder`)
        continue
      }
      fs.copyFileSync(placeholderPath, dest)
      report.placeholders.push(`audio/${group}/${id}`)
    }
    report.audio.push({ id, bytes: fs.statSync(dest).size, core: !!AUDIO[group][id].core })
  }
}

// ---------- models ----------
const modelSources = walk(path.join(SRC, 'models')).filter((f) => /\.(glb|gltf)$/i.test(f))
const modelOut = path.join(OUT, 'models')
fs.rmSync(modelOut, { recursive: true, force: true })
if (modelSources.length) {
  fs.mkdirSync(modelOut, { recursive: true })
  const { NodeIO } = await import('@gltf-transform/core')
  const { ALL_EXTENSIONS, EXTMeshoptCompression } = await import('@gltf-transform/extensions')
  const { prune, dedup, weld, quantize, meshopt } = await import('@gltf-transform/functions')
  const { MeshoptEncoder, MeshoptDecoder } = await import('meshoptimizer')
  await MeshoptEncoder.ready
  await MeshoptDecoder.ready
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
  for (const file of modelSources) {
    const rel = path.relative(path.join(SRC, 'models'), path.dirname(file))
    const name = safeName(file).replace(/\.gltf$/i, '.glb')
    const destDir = path.join(modelOut, rel.split(path.sep).map((s) => s.replace(/[^A-Za-z0-9._-]+/g, '_')).join('/'))
    fs.mkdirSync(destDir, { recursive: true })
    const dest = path.join(destDir, name)
    const doc = await io.read(file)
    await doc.transform(prune(), dedup(), weld(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
    doc.createExtension(EXTMeshoptCompression).setRequired(true)
    await io.write(dest, doc)
    report.models.push({ file: path.relative(OUT, dest), srcBytes: fs.statSync(file).size, bytes: fs.statSync(dest).size })
  }
}

// ---------- fonts & ui ----------
for (const [kind, exts] of [['fonts', /\.(woff2|woff|ttf|otf)$/i], ['ui', /\.(svg|png|webp)$/i]]) {
  const files = walk(path.join(SRC, kind)).filter((f) => exts.test(f))
  const dir = path.join(OUT, kind)
  fs.rmSync(dir, { recursive: true, force: true })
  if (!files.length) continue
  fs.mkdirSync(dir, { recursive: true })
  for (const f of files) {
    const dest = path.join(dir, safeName(f))
    fs.copyFileSync(f, dest)
    report[kind].push({ file: path.relative(OUT, dest), bytes: fs.statSync(dest).size })
  }
}
if (!report.fonts.length) report.placeholders.push('fonts (system font stack used)')
if (!modelSources.length) report.placeholders.push('models (box-built placeholder scene)')

for (const f of walk(OUT)) {
  if (!SAFE.test(path.basename(f))) report.warnings.push(`unsafe file name in output: ${path.relative(OUT, f)}`)
}

fs.mkdirSync(path.join(root, 'build-meta'), { recursive: true })
fs.writeFileSync(path.join(root, 'build-meta', 'asset-report.json'), JSON.stringify(report, null, 2))
console.log(`assets: ${report.audio.length} audio, ${report.models.length} models, ${report.fonts.length} fonts, ${report.ui.length} ui`)
if (report.placeholders.length) console.log(`PLACEHOLDERS (${report.placeholders.length}):\n  ` + report.placeholders.join('\n  '))
if (report.warnings.length) console.log(`WARNINGS:\n  ` + report.warnings.join('\n  '))
