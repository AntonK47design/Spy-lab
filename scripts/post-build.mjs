#!/usr/bin/env node
// Moves Vite's manifest out of dist/ (it must not ship) into build-meta/ for check-build.
import fs from 'node:fs'
import path from 'node:path'
const root = path.resolve(import.meta.dirname, '..')
const src = path.join(root, 'dist', '.vite', 'manifest.json')
const destDir = path.join(root, 'build-meta')
fs.mkdirSync(destDir, { recursive: true })
if (fs.existsSync(src)) {
  fs.copyFileSync(src, path.join(destDir, 'vite-manifest.json'))
  fs.rmSync(path.join(root, 'dist', '.vite'), { recursive: true, force: true })
}
console.log('post-build: manifest -> build-meta/vite-manifest.json')
