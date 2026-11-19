/**
 * Model loading + draw-call friendly preparation.
 *  - Static props are baked into plain vertex-colored geometry (material colors -> COLOR attribute)
 *    so a whole room merges into ONE mesh with the shared material.
 *  - Characters: all skinned primitives are merged into ONE SkinnedMesh with vertex colors
 *    (one draw call per character), animations come from a shared library per skeleton.
 */
import {
  AnimationClip,
  Bone,
  BufferAttribute,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Box3,
  Vector3,
  SRGBColorSpace,
  type Texture,
  type Material,
} from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { ANIM_LIBS, CHARACTERS, CHARACTER_HEIGHT, MODELS, type CharacterId, type ModelId } from '../config/models'

const loader = new GLTFLoader()
loader.setMeshoptDecoder(MeshoptDecoder)

const gltfCache = new Map<string, Promise<GLTF>>()
function loadFile(file: string): Promise<GLTF> {
  let p = gltfCache.get(file)
  if (!p) {
    p = loader.loadAsync(`assets/models/${file}`)
    gltfCache.set(file, p)
  }
  return p
}

/** Preload a set of files with progress (0..1). Failures are logged, never fatal. */
export async function preload(files: string[], onProgress?: (p: number) => void): Promise<void> {
  let done = 0
  await Promise.all(
    files.map((f) =>
      loadFile(f)
        .catch((e) => console.warn('[assets] failed', f, e))
        .finally(() => onProgress?.(++done / files.length)),
    ),
  )
}

export function coreFiles(): string[] {
  const files = new Set<string>()
  for (const m of Object.values(MODELS)) if (m.core) files.add(m.file)
  for (const c of Object.values(CHARACTERS)) if (c.core) {
    files.add(c.file)
    files.add(ANIM_LIBS[c.anims])
  }
  return [...files]
}

export function lazyFiles(): string[] {
  const core = new Set(coreFiles())
  const all = new Set<string>()
  for (const m of Object.values(MODELS)) all.add(m.file)
  for (const c of Object.values(CHARACTERS)) {
    all.add(c.file)
    all.add(ANIM_LIBS[c.anims])
  }
  return [...all].filter((f) => !core.has(f))
}

// ---------------------------------------------------------------- static props
const propCache = new Map<string, BufferGeometry | null>()
const tmpColor = new Color()
const texel = new Color()
const pixelCache = new WeakMap<object, { w: number; h: number; d: Uint8ClampedArray } | null>()

/** Read a texture's pixels once (palette atlases are tiny, e.g. 128-1024 px). */
function texturePixels(tex: Texture): { w: number; h: number; d: Uint8ClampedArray } | null {
  const img = tex.image as (CanvasImageSource & { width: number; height: number }) | undefined
  if (!img || !img.width) return null
  if (pixelCache.has(img)) return pixelCache.get(img) ?? null
  try {
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)
    const data = { w: c.width, h: c.height, d: ctx.getImageData(0, 0, c.width, c.height).data }
    pixelCache.set(img, data)
    return data
  } catch {
    pixelCache.set(img, null)
    return null
  }
}

function toFloat(attr: BufferAttribute, itemSize: number): Float32BufferAttribute {
  const n = attr.count
  const out = new Float32Array(n * itemSize)
  for (let i = 0; i < n; i++) {
    out[i * itemSize] = attr.getX(i)
    if (itemSize > 1) out[i * itemSize + 1] = attr.getY(i)
    if (itemSize > 2) out[i * itemSize + 2] = attr.getZ(i)
  }
  return new Float32BufferAttribute(out, itemSize)
}

/**
 * The prop as ONE non-indexed, vertex-colored, unit-scaled geometry (origin at the model origin,
 * sitting on y=0). Returns null if the model is not loaded (yet).
 */
export async function propGeometry(id: ModelId): Promise<BufferGeometry | null> {
  if (propCache.has(id)) return propCache.get(id) ?? null
  const def = MODELS[id] as { file: string; scale: number; tint?: Record<string, number> }
  let gltf: GLTF
  try {
    gltf = await loadFile(def.file)
  } catch {
    propCache.set(id, null)
    return null
  }
  const parts: BufferGeometry[] = []
  gltf.scene.updateMatrixWorld(true)
  gltf.scene.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const src = mesh.geometry
    const groups = src.groups.length ? src.groups : [{ start: 0, count: src.index ? src.index.count : src.getAttribute('position').count, materialIndex: 0 }]
    for (const g of groups) {
      const mat = mats[g.materialIndex ?? 0] as Material & { color?: Color; name: string; map?: Texture | null }
      let geo = new BufferGeometry()
      geo.setAttribute('position', toFloat(src.getAttribute('position') as BufferAttribute, 3))
      const nrm = src.getAttribute('normal') as BufferAttribute | undefined
      if (nrm) geo.setAttribute('normal', toFloat(nrm, 3))
      const uvAttr = src.getAttribute('uv') as BufferAttribute | undefined
      const pixels = mat.map ? texturePixels(mat.map) : null
      if (pixels && uvAttr) geo.setAttribute('uv', toFloat(uvAttr, 2))
      if (src.index) geo.setIndex(src.index.clone())
      geo = sliceGroup(geo, g.start, g.count)
      geo.applyMatrix4(mesh.matrixWorld)
      const tint = def.tint?.[mat.name]
      const base = new Color()
      if (tint !== undefined) base.setHex(tint)
      else if (mat.color) base.copy(mat.color)
      else base.setRGB(0.8, 0.8, 0.8)
      const n = geo.getAttribute('position').count
      const col = new Float32Array(n * 3)
      const uv = geo.getAttribute('uv') as BufferAttribute | undefined
      for (let i = 0; i < n; i++) {
        tmpColor.copy(base)
        if (pixels && uv && tint === undefined) {
          // palette atlas: sample the texel under this vertex (flat color cells)
          const u = uv.getX(i) - Math.floor(uv.getX(i))
          const v = uv.getY(i) - Math.floor(uv.getY(i))
          const px = Math.min(pixels.w - 1, Math.max(0, Math.floor(u * pixels.w)))
          const py = Math.min(pixels.h - 1, Math.max(0, Math.floor(v * pixels.h)))
          const o = (py * pixels.w + px) * 4
          texel.setRGB(pixels.d[o]! / 255, pixels.d[o + 1]! / 255, pixels.d[o + 2]! / 255, SRGBColorSpace)
          tmpColor.multiply(texel)
        }
        col[i * 3] = tmpColor.r
        col[i * 3 + 1] = tmpColor.g
        col[i * 3 + 2] = tmpColor.b
      }
      if (uv) geo.deleteAttribute('uv')
      geo.setAttribute('color', new Float32BufferAttribute(col, 3))
      if (!geo.getAttribute('normal')) geo.computeVertexNormals()
      parts.push(geo)
    }
  })
  if (!parts.length) {
    propCache.set(id, null)
    return null
  }
  const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js')
  const merged = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  if (!merged) {
    propCache.set(id, null)
    return null
  }
  merged.scale(def.scale, def.scale, def.scale)
  merged.computeBoundingBox()
  const bb = merged.boundingBox!
  merged.translate(0, -bb.min.y, 0)
  merged.computeBoundingBox()
  propCache.set(id, merged)
  return merged
}

/** Non-indexed copy of one index range. */
function sliceGroup(geo: BufferGeometry, start: number, count: number): BufferGeometry {
  const idx = geo.index
  const out = new BufferGeometry()
  for (const name of Object.keys(geo.attributes)) {
    const a = geo.getAttribute(name) as BufferAttribute
    const size = a.itemSize
    const arr = new Float32Array((idx ? count : count) * size)
    for (let i = 0; i < count; i++) {
      const src = idx ? idx.getX(start + i) : start + i
      for (let k = 0; k < size; k++) arr[i * size + k] = a.array[src * size + k] as number
    }
    out.setAttribute(name, new Float32BufferAttribute(arr, size))
  }
  return out
}

export function propSize(id: ModelId): Vector3 | null {
  const g = propCache.get(id)
  if (!g?.boundingBox) return null
  return g.boundingBox.getSize(new Vector3())
}

// ---------------------------------------------------------------- characters
interface CharProto {
  root: Object3D
  clips: AnimationClip[]
  scale: number
}

const charCache = new Map<string, Promise<CharProto | null>>()
export const charMaterial = new MeshLambertMaterial({ vertexColors: true })

/**
 * Prototype for a character variant: one merged SkinnedMesh (vertex colors), shared skeleton.
 * `tint` maps material names (e.g. "Purple", "Suit") to sRGB hex colors.
 */
export function characterProto(id: CharacterId, tint?: Record<string, number>): Promise<CharProto | null> {
  const key = `${id}|${tint ? JSON.stringify(tint) : ''}`
  let p = charCache.get(key)
  if (!p) {
    p = buildCharacter(id, tint).catch((e) => {
      console.warn('[assets] character failed', id, e)
      return null
    })
    charCache.set(key, p)
  }
  return p
}

async function buildCharacter(id: CharacterId, tint?: Record<string, number>): Promise<CharProto | null> {
  const def = CHARACTERS[id]
  const [gltf, lib] = await Promise.all([loadFile(def.file), loadFile(ANIM_LIBS[def.anims])])
  const root = cloneSkinned(gltf.scene)
  const skinned: SkinnedMesh[] = []
  root.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh) skinned.push(o as SkinnedMesh)
  })
  if (!skinned.length) return null
  const master = skinned[0]!.skeleton
  const boneIndex = new Map<string, number>()
  master.bones.forEach((b, i) => boneIndex.set(b.name, i))

  const parts: BufferGeometry[] = []
  for (const sm of skinned) {
    const mats = Array.isArray(sm.material) ? sm.material : [sm.material]
    const src = sm.geometry
    const remap = sm.skeleton.bones.map((b) => boneIndex.get(b.name) ?? 0)
    const groups = src.groups.length ? src.groups : [{ start: 0, count: src.index ? src.index.count : src.getAttribute('position').count, materialIndex: 0 }]
    for (const g of groups) {
      const mat = mats[g.materialIndex ?? 0] as Material & { color?: Color; name: string }
      const base = new BufferGeometry()
      base.setAttribute('position', toFloat(src.getAttribute('position') as BufferAttribute, 3))
      base.setAttribute('normal', toFloat(src.getAttribute('normal') as BufferAttribute, 3))
      base.setAttribute('skinIndex', toFloat(src.getAttribute('skinIndex') as BufferAttribute, 4))
      base.setAttribute('skinWeight', toFloat(src.getAttribute('skinWeight') as BufferAttribute, 4))
      if (src.index) base.setIndex(src.index.clone())
      const geo = sliceGroup(base, g.start, g.count)
      base.dispose()
      // bake this part's bind transform (incl. quantization scale/offset); merged mesh binds with identity
      geo.applyMatrix4(sm.bindMatrix)
      const si = geo.getAttribute('skinIndex') as BufferAttribute
      for (let i = 0; i < si.array.length; i++) (si.array as Float32Array)[i] = remap[si.array[i] as number] ?? 0
      const c = tint?.[mat.name]
      if (c !== undefined) tmpColor.setHex(c)
      else if (mat.color) tmpColor.copy(mat.color)
      else tmpColor.setRGB(0.8, 0.8, 0.8)
      const n = geo.getAttribute('position').count
      const col = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        col[i * 3] = tmpColor.r
        col[i * 3 + 1] = tmpColor.g
        col[i * 3 + 2] = tmpColor.b
      }
      geo.setAttribute('color', new Float32BufferAttribute(col, 3))
      parts.push(geo)
    }
  }
  const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js')
  const merged = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  if (!merged) return null
  // skinIndex must be an integer attribute
  const fi = merged.getAttribute('skinIndex') as BufferAttribute
  merged.setAttribute('skinIndex', new Uint16BufferAttribute(Uint16Array.from(fi.array as Float32Array), 4))
  const mesh = new SkinnedMesh(merged, charMaterial)
  mesh.name = 'body'
  mesh.castShadow = true
  mesh.frustumCulled = false
  const parent = skinned[0]!.parent ?? root
  parent.add(mesh)
  mesh.bind(new Skeleton(master.bones, master.boneInverses), new Matrix4())
  for (const sm of skinned) sm.removeFromParent()

  // normalize height
  root.updateMatrixWorld(true)
  const box = new Box3().setFromObject(root, true)
  const h = box.max.y - box.min.y
  const scale = h > 0.01 ? CHARACTER_HEIGHT / h : 1
  const wrapper = new Group()
  wrapper.add(root)
  root.scale.multiplyScalar(scale)
  root.position.y = -box.min.y * scale
  return { root: wrapper, clips: lib.animations, scale }
}

/** A fresh, independently animatable instance of a character prototype. */
export function instantiate(proto: CharProto): Object3D {
  return cloneSkinned(proto.root)
}

export function findBone(root: Object3D, name: RegExp): Bone | null {
  let found: Bone | null = null
  root.traverse((o) => {
    if (!found && (o as Bone).isBone && name.test(o.name)) found = o as Bone
  })
  return found
}

export { Matrix4 }
