/**
 * Renders the hero's head once into a small transparent PNG for the HUD portrait
 * (a real render of the player model, like the Kickoff profile). Uses the game's own
 * WebGL renderer and an offscreen render target — no second context, no network.
 */
import {
  DirectionalLight, HemisphereLight, PerspectiveCamera, SRGBColorSpace, Scene, WebGLRenderTarget, type WebGLRenderer,
} from 'three'
import { Character } from '../academy/Character'
import type { CharacterId } from '../config/models'

export async function renderPortrait(renderer: WebGLRenderer, model: CharacterId, size = 192): Promise<string | null> {
  const ch = new Character({ model })
  for (let i = 0; i < 100 && !ch.ready; i++) await new Promise((r) => setTimeout(r, 30))
  if (!ch.ready) return null
  ch.root.getObjectByName('blob')?.removeFromParent()
  ch.root.rotation.y = 0.45
  ch.update(0.4) // settle into the idle pose

  const scene = new Scene()
  scene.add(ch.root)
  scene.add(new HemisphereLight(0xffffff, 0x8a7fa8, 2.3))
  const key = new DirectionalLight(0xfff0d6, 3.0)
  key.position.set(0.8, 2.2, 3.0)
  scene.add(key)
  const rim = new DirectionalLight(0x9fd8ff, 1.2)
  rim.position.set(-2, 1.6, -1.5)
  scene.add(rim)

  // frame the big Kenney head + a bit of the shoulders
  const cam = new PerspectiveCamera(22, 1, 0.1, 20)
  cam.position.set(0.3, 1.18, 3.6)
  cam.lookAt(0, 0.98, 0)

  const rt = new WebGLRenderTarget(size, size)
  rt.texture.colorSpace = SRGBColorSpace
  const prevTarget = renderer.getRenderTarget()
  const prevAlpha = renderer.getClearAlpha()
  const prevShadow = renderer.shadowMap.enabled
  renderer.shadowMap.enabled = false
  renderer.setRenderTarget(rt)
  renderer.setClearAlpha(0)
  renderer.clear()
  renderer.render(scene, cam)
  const px = new Uint8Array(size * size * 4)
  renderer.readRenderTargetPixels(rt, 0, 0, size, size, px)
  renderer.setRenderTarget(prevTarget)
  renderer.setClearAlpha(prevAlpha)
  renderer.shadowMap.enabled = prevShadow
  rt.dispose()

  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const ctx = cv.getContext('2d')
  if (!ctx) return null
  const img = ctx.createImageData(size, size)
  // WebGL rows are bottom-up
  for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4)
  ctx.putImageData(img, 0, 0)
  return cv.toDataURL('image/png')
}
