/**
 * PHASE 0 PLACEHOLDER: a box-built academy cross-section to prove renderer,
 * camera, input, loop and draw-call budget. Replaced by real models in Phase 1.
 */
import {
  CapsuleGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  Scene,
  SphereGeometry,
  BoxGeometry,
  type Material,
  type BufferGeometry,
} from 'three'
import { ACADEMY_LAYOUT as L, PALETTE as P } from '../config/layout'
import { StaticBatch } from '../render/geometry'

export interface AcademyBounds {
  top: number
  bottom: number
}

const CADETS = 6

export class PlaceholderAcademy {
  readonly scene = new Scene()
  readonly cashStack: Mesh
  readonly bounds: AcademyBounds
  private elevator: Mesh
  private cadets: InstancedMesh
  private heads: InstancedMesh
  private shadows: InstancedMesh
  private t = 0
  private disposables: (BufferGeometry | Material)[] = []
  private tmp = new Object3D()
  private mat = new Matrix4()
  private pulse = 0

  constructor() {
    const s = this.scene
    s.background = new Color(P.night)

    s.add(new HemisphereLight(0xfff6e8, 0x40324a, 1.6))
    const sun = new DirectionalLight(0xffffff, 1.4)
    sun.position.set(4, 10, 8)
    s.add(sun)

    const staticGeo = this.buildStatic()
    const staticMat = new MeshLambertMaterial({ vertexColors: true, flatShading: true })
    s.add(new Mesh(staticGeo, staticMat))
    this.disposables.push(staticGeo, staticMat)

    // Elevator car
    const carGeo = new BoxGeometry(L.shaftWidth - 0.3, 1.6, 1.2)
    const carMat = new MeshLambertMaterial({ color: P.mustard, flatShading: true })
    this.elevator = new Mesh(carGeo, carMat)
    this.elevator.position.set(0, 0.8, 0)
    s.add(this.elevator)
    this.disposables.push(carGeo, carMat)

    // Cash stack (tap target)
    const cashGeo = new BoxGeometry(0.7, 0.45, 0.5)
    const cashMat = new MeshLambertMaterial({ color: 0x5fbf5a, emissive: 0x1a4d18, flatShading: true })
    this.cashStack = new Mesh(cashGeo, cashMat)
    const vx = L.shaftWidth / 2 + L.roomWidth * 0.72
    this.cashStack.position.set(vx, -L.floorHeight + 0.45, 0.6)
    this.cashStack.name = 'cash_stack'
    s.add(this.cashStack)
    this.disposables.push(cashGeo, cashMat)

    // Cadets: instanced body + head + blob shadow (3 draw calls for all cadets)
    const bodyGeo = new CapsuleGeometry(0.22, 0.45, 3, 8)
    const bodyMat = new MeshLambertMaterial({ color: P.petrol, flatShading: true })
    const headGeo = new SphereGeometry(0.2, 8, 6)
    const headMat = new MeshLambertMaterial({ color: P.skin, flatShading: true })
    const shadowGeo = new CircleGeometry(0.32, 12)
    shadowGeo.rotateX(-Math.PI / 2)
    const shadowMat = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false })
    this.cadets = new InstancedMesh(bodyGeo, bodyMat, CADETS)
    this.heads = new InstancedMesh(headGeo, headMat, CADETS)
    this.shadows = new InstancedMesh(shadowGeo, shadowMat, CADETS)
    s.add(this.cadets, this.heads, this.shadows)
    this.disposables.push(bodyGeo, bodyMat, headGeo, headMat, shadowGeo, shadowMat)

    this.bounds = { top: L.bakeryHeight + 1.2, bottom: -L.floors * L.floorHeight - 0.6 }
    this.update(0)
  }

  private buildStatic(): BufferGeometry {
    const b = new StaticBatch()
    const FH = L.floorHeight
    const D = L.roomDepth
    const RW = L.roomWidth
    const SW = L.shaftWidth
    const buildingW = SW + RW * 2
    const depthBottom = -L.floors * FH - 3
    const backZ = -D / 2 - 0.2

    // Sky backdrop and street
    b.box(80, 30, 0.2, 0, 15, -6, P.sky)
    b.box(80, 0.4, 6, 0, -0.2, -1, P.street)
    b.box(80, 0.12, 1.2, 0, 0.06, 1.6, 0xb8bcc6) // sidewalk
    // Earth: back panel, side masses and floor slabs
    b.box(80, -depthBottom, 0.3, 0, depthBottom / 2, backZ - 0.2, P.earthDark)
    const sideW = 30
    b.box(sideW, -depthBottom, D + 0.6, buildingW / 2 + sideW / 2 + 0.2, depthBottom / 2 - 0.2, -0.1, P.earth)
    b.box(sideW, -depthBottom, D + 0.6, -(buildingW / 2 + sideW / 2 + 0.2), depthBottom / 2 - 0.2, -0.1, P.earth)
    for (let k = 1; k <= L.floors + 1; k++) {
      b.box(buildingW + 0.4, 0.35, D + 0.6, 0, -(k - 1) * FH - 0.4, -0.1, P.earth)
    }
    b.box(buildingW + 0.4, 3, D + 0.6, 0, -L.floors * FH - 1.9, -0.1, P.earth)

    // Neighbour facades on the street
    b.box(4, 5, 2, -buildingW / 2 - 3, 2.5, -3, 0xd9a6a0)
    b.box(4, 4, 2, buildingW / 2 + 3, 2, -3, 0xa7c4a0)
    b.box(3, 6, 2, -buildingW / 2 - 7, 3, -3.5, 0xc9b6d9)
    b.box(3.5, 4.5, 2, buildingW / 2 + 7, 2.25, -3.5, 0xe6cf9a)

    // Bakery (ground floor, cross-section)
    const BH = L.bakeryHeight
    b.box(buildingW, BH, 0.2, 0, BH / 2, backZ, P.pastelPink) // back wall
    b.box(0.25, BH, D, -buildingW / 2, BH / 2, 0, P.cream)
    b.box(0.25, BH, D, buildingW / 2, BH / 2, 0, P.cream)
    b.box(buildingW + 0.6, 0.3, D + 0.4, 0, BH + 0.15, 0, P.coral) // roof slab
    for (let i = 0; i < 6; i++) {
      // striped awning
      const w = (buildingW + 0.6) / 6
      b.box(w, 0.18, 1, -buildingW / 2 - 0.3 + w * (i + 0.5), BH - 0.2, D / 2 + 0.4, i % 2 ? P.cream : P.coral)
    }
    b.box(buildingW * 0.45, 0.9, 0.7, -buildingW * 0.18, 0.45, -0.3, 0xc98b5a) // counter
    b.box(1.2, 1.6, 1, buildingW * 0.3, 0.8, -0.6, P.steel) // oven (hides the lift)
    b.box(0.8, 0.5, 0.05, buildingW * 0.3, 1.0, -0.08, 0x2b2b2b)
    for (let i = 0; i < 4; i++) b.box(0.35, 0.2, 0.35, -buildingW * 0.32 + i * 0.5, 1.0, -0.3, P.mustard) // pastries

    // Lift shaft
    const shaftTop = BH
    const shaftBottom = -L.floors * FH
    b.box(SW, shaftTop - shaftBottom, 0.15, 0, (shaftTop + shaftBottom) / 2, backZ + 0.05, 0x3a4152)
    b.box(0.08, shaftTop - shaftBottom, 0.08, -SW / 2 + 0.1, (shaftTop + shaftBottom) / 2, 0.4, P.steel)
    b.box(0.08, shaftTop - shaftBottom, 0.08, SW / 2 - 0.1, (shaftTop + shaftBottom) / 2, 0.4, P.steel)

    // Underground rooms
    const roomColors: [number, number][] = [
      [P.petrol, P.pastelBlue], // -1 Mission Control | Vault Workshop
    ]
    for (let k = 1; k <= L.floors; k++) {
      const yBottom = -k * FH
      const yMid = yBottom + FH / 2 - 0.2
      for (const side of [-1, 1]) {
        const cx = side * (SW / 2 + RW / 2)
        const unlocked = k === 1
        const colors = roomColors[k - 1]
        const wallColor = unlocked && colors ? (side < 0 ? colors[0] : colors[1]) : P.locked
        b.box(RW - 0.1, FH - 0.4, 0.15, cx, yMid, backZ + 0.05, wallColor)
        b.box(RW - 0.1, 0.12, D, cx, yBottom + 0.06, 0, unlocked ? 0x6b5b4f : 0x4a4d57)
        if (!unlocked) {
          // construction placeholder: hazard stripes + crates
          for (let i = 0; i < 5; i++) {
            b.box(0.5, 0.18, 0.06, cx - RW / 2 + 0.5 + i * 0.65, yBottom + 1.6, backZ + 0.15, i % 2 ? P.mustard : 0x1e1e1e)
          }
          b.box(0.7, 0.6, 0.6, cx - side * 0.8, yBottom + 0.42, 0, 0xa07a4f)
          b.box(0.5, 0.45, 0.5, cx - side * 0.2, yBottom + 0.35, 0.4, 0xb58a5a)
        }
      }
    }
    // Floor -1 props: Mission Control desk + screen, Vault Workshop safe
    const mcx = -(SW / 2 + RW / 2)
    b.box(2.4, 0.8, 0.8, mcx, -FH + 0.52, -0.4, 0x2d3748)
    b.box(2.2, 1.0, 0.08, mcx, -FH + 1.7, backZ + 0.2, 0x46c2cb)
    const vx = SW / 2 + RW / 2
    b.box(1.1, 1.3, 0.9, vx - 0.6, -FH + 0.77, -0.5, 0x6d7a8c)
    b.box(0.4, 0.4, 0.06, vx - 0.6, -FH + 0.85, -0.03, P.mustard)
    return b.build()
  }

  /** Pulse the tap target briefly (feedback). */
  bump(): void {
    this.pulse = 1
  }

  update(dt: number): void {
    this.t += dt
    const FH = L.floorHeight
    // Elevator rides between bakery and floor -1
    const cycle = (Math.sin(this.t * 0.6) + 1) / 2
    this.elevator.position.y = 0.95 - cycle * FH

    // Cadets train in the Vault Workshop (floor -1, right) and Mission Control (left)
    const m = this.mat
    for (let i = 0; i < CADETS; i++) {
      const right = i < 4
      const baseX = right ? L.shaftWidth / 2 + 0.6 + (i % 4) * 0.7 : -(L.shaftWidth / 2 + 1 + (i - 4) * 1.4)
      const x = baseX + Math.sin(this.t * 1.3 + i) * 0.12
      const hop = Math.max(0, Math.sin(this.t * 4 + i * 1.7)) * 0.12
      const y = -FH + 0.12
      const z = 0.5 + (i % 2) * 0.35
      this.tmp.position.set(x, y + 0.45 + hop, z)
      this.tmp.rotation.set(0, Math.sin(this.t + i) * 0.4, 0)
      this.tmp.updateMatrix()
      this.cadets.setMatrixAt(i, this.tmp.matrix)
      this.tmp.position.y = y + 0.98 + hop
      this.tmp.updateMatrix()
      this.heads.setMatrixAt(i, this.tmp.matrix)
      m.makeTranslation(x, y + 0.01, z)
      this.shadows.setMatrixAt(i, m)
    }
    this.cadets.instanceMatrix.needsUpdate = true
    this.heads.instanceMatrix.needsUpdate = true
    this.shadows.instanceMatrix.needsUpdate = true

    // Cash stack idle bob + tap pulse
    this.pulse = Math.max(0, this.pulse - dt * 4)
    const sc = 1 + Math.sin(this.t * 3) * 0.04 + this.pulse * 0.25
    this.cashStack.scale.setScalar(sc)
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose()
    this.cadets.dispose()
    this.heads.dispose()
    this.shadows.dispose()
    this.scene.clear()
  }
}

