import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import playgamaBridge from '@playgama/bridge/vite'

// mode 'local': the Bridge runtime ships inside the archive. YouTube Playables and
// some partner portals block every external request (isExternalCallsSupported=false),
// so the CDN tag recommended by the docs is not an option for this game.
export default defineConfig({
  base: './',
  plugins: [playgamaBridge({ mode: 'local' }), preact()],
  build: {
    target: 'es2020',
    sourcemap: false,
    manifest: true,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 900,
  },
  define: { __BUILD_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0') },
  server: { host: true },
  preview: { host: true },
})
