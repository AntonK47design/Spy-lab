import { MeshBasicMaterial, MeshLambertMaterial } from 'three'

/** One shared flat-shaded vertex-color material for (almost) every placeholder model. */
export const flatMat = new MeshLambertMaterial({ vertexColors: true, flatShading: true })
export const shadowMat = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })
