#!/usr/bin/env node
// npm run package — zips dist/ (index.html at the archive root) to spy-lab-vX.Y.Z.zip
import fs from 'node:fs'
import path from 'node:path'
import { ZipArchive } from 'archiver'

const root = path.resolve(import.meta.dirname, '..')
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const dist = path.join(root, 'dist')
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html missing — run npm run build first')
  process.exit(1)
}
// the build must carry this version (telemetry build_version), else it is a stale dist/
const assets = path.join(dist, 'assets')
const stamped = fs.readdirSync(assets).filter((f) => f.endsWith('.js')).some((f) => fs.readFileSync(path.join(assets, f), 'utf8').includes(`\`${version}\``))
if (!stamped) {
  console.error(`dist/ was not built as ${version} (stale build?) — run npm run build first`)
  process.exit(1)
}
const out = path.join(root, `spy-lab-v${version}.zip`)
const output = fs.createWriteStream(out)
const zip = new ZipArchive({ zlib: { level: 9 } })
zip.pipe(output)
zip.glob('**/*', { cwd: dist, dot: false, ignore: ['**/*.map', '.vite/**'] })
await zip.finalize()
await new Promise((r) => output.on('close', r))
console.log(`package: ${path.basename(out)} ${(fs.statSync(out).size / 1024).toFixed(0)} KB`)
