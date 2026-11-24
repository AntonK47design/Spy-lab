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

/** Floor trail shown under the guide arrow while its target is behind a wall (route through doors). */
export const GUIDE_TRAIL = {
  /** Metres between two chevrons. */
  spacing: 0.9,
  /** Chevrons drift toward the target at this speed (m/s). */
  flow: 1.6,
  /** Maximum chevrons drawn (one instanced mesh). */
  max: 48,
  /** No chevrons this close to the hero / the target (m). */
  skipHero: 0.8,
  skipTarget: 1.0,
  size: 0.6,
  /** Height above y = 0 (floor tiles end at 0.05). */
  lift: 0.08,
  color: 0xf2b134,
  /** Dark rim under every chevron so the trail reads on pale floors. */
  outlineColor: 0x14213d,
  outlineScale: 1.3,
  /** Turns of the route (doorways): a bigger, brighter, pulsing chevron pointing along the next leg. */
  cornerColor: 0xff9f1a,
  cornerSize: 1.2,
  cornerPulse: 0.18,
  cornerPulseHz: 1.6,
  /** No corner marker while the hero stands this close to it (m). */
  cornerSkipHero: 0.6,
  /** Seconds between route re-plans while walking. */
  replanSeconds: 0.2,
} as const
