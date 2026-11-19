import { WebGLRenderer, SRGBColorSpace, NoToneMapping } from 'three'
import { AUTO_QUALITY, QUALITY, type QualityTier } from '../config/quality'
import { contextLost } from '../core/lifecycle'

export interface RenderTarget {
  renderer: WebGLRenderer
  canvas: HTMLCanvasElement
  width: number
  height: number
  tier: QualityTier
}

type ResizeFn = (w: number, h: number) => void

export function initialTier(): QualityTier {
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4
  const cores = navigator.hardwareConcurrency ?? 4
  const small = Math.min(screen.width, screen.height) < 500
  if (mem <= 2 || cores <= 2) return 'low'
  if (small) return 'mid'
  return 'high'
}

export function createRenderer(host: HTMLElement, onResize: ResizeFn): RenderTarget & {
  setTier(t: QualityTier): void
} {
  const canvas = document.createElement('canvas')
  canvas.id = 'game-canvas'
  host.appendChild(canvas)
  const tier = initialTier()
  const renderer = new WebGLRenderer({
    canvas,
    antialias: QUALITY[tier].antialias,
    powerPreference: 'high-performance',
    alpha: false,
    stencil: false,
  })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = NoToneMapping
  renderer.shadowMap.enabled = false // blob shadows only

  const target = {
    renderer,
    canvas,
    width: 1,
    height: 1,
    tier,
    setTier(t: QualityTier) {
      target.tier = t
      applySize()
    },
  }

  function applySize(): void {
    const w = Math.max(1, host.clientWidth)
    const h = Math.max(1, host.clientHeight)
    target.width = w
    target.height = h
    const dpr = Math.min(window.devicePixelRatio || 1, AUTO_QUALITY.maxDpr, QUALITY[target.tier].pixelRatio)
    renderer.setPixelRatio(dpr)
    renderer.setSize(w, h, false)
    onResize(w, h)
  }

  new ResizeObserver(applySize).observe(host)
  applySize()

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    contextLost.value = true
  })
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost.value = false
  })
  return target
}
