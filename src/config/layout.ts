/** Academy cross-section dimensions (world units) and camera framing. */
export const ACADEMY_LAYOUT = {
  roomWidth: 3.6,
  roomDepth: 3,
  shaftWidth: 1.4,
  floorHeight: 3,
  wall: 0.15,
  bakeryHeight: 3.4,
  /** Floors below ground: -1 .. -floors */
  floors: 5,
} as const

export const CAMERA = {
  fov: 30,
  /** Safe rectangle that must always be visible (world units). */
  safeWidth: 9.2,
  safeFloorsPortrait: 4,
  safeFloorsLandscape: 3,
  zoomMin: 0.6,
  zoomMax: 1.35,
  /** Seconds for the focus glide. */
  glide: 0.45,
  dragThresholdPx: 8,
} as const

export const PALETTE = {
  night: 0x14213d,
  petrol: 0x1f5f6b,
  petrolDark: 0x163f48,
  mustard: 0xf2b134,
  coral: 0xf2665c,
  cream: 0xfff3e0,
  pastelPink: 0xf7c6d0,
  pastelMint: 0xbfe8d6,
  pastelBlue: 0xb9d7f0,
  earth: 0x3b2a2a,
  earthDark: 0x2a1d1f,
  sky: 0x9fd3e8,
  street: 0x4a4e5a,
  steel: 0x8a94a6,
  locked: 0x5d6270,
  skin: 0xf1c27d,
} as const
