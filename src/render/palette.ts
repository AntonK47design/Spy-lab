/**
 * The ONE place for world colours (docs/ART_BIBLE.md). Builders reference these names only.
 * Value ladder: void -> floors -> walls -> interactables/characters -> UI.
 */
export const PAL = {
  // void + plot
  void: 0x1e1a33,
  voidDeep: 0x14111f,
  curbTop: 0xeadfc8,
  curbSide: 0xb7a88a,
  curbShadow: 0x4f4466,
  // outdoor
  pavingA: 0xe8d7b0,
  pavingB: 0xdcc89c,
  road: 0x5a6070,
  roadLine: 0xfff3e0,
  // bakery + corridor floors
  bakeryA: 0xfff4e8,
  bakeryB: 0xf7cfd8,
  corridorA: 0xf6e7c8,
  corridorB: 0xead6ad,
  grout: 0xc9b48c,
  // walls
  wall: 0xf3eee6,
  wallSkirt: 0xc9bfb0,
  wallTrim: 0x2f6bff,
  bakeryWall: 0xffe3e8,
  bakeryTrim: 0xff6b5e,
  // brand
  brand: 0x2f6bff,
  brandYellow: 0xffd23f,
  white: 0xffffff,
  coral: 0xff6b5e,
  // interactables
  cash: 0x3ddc84,
  star: 0xffc83d,
  orange: 0xff7a2e,
  kit: 0xffd23f,
  // locked rooms (blueprint)
  blueprint: 0x5ab4ff,
  blueprintEdge: 0xbfe3ff,
  // devices built in code (safes, laser rigs)
  steel: 0x8f9bb0,
  steelDark: 0x5d6779,
  laser: 0xff3b3b,
  dark: 0x22283a,
  wood: 0xc98b4f,
} as const

/** Room floors: one distinct material/colour per room (A/B checker). */
export const ROOM_FLOOR: Record<string, [number, number]> = {
  mission_control: [0x3b5b8f, 0x34527f],
  vault: [0x2fa6a0, 0x2a958f],
  laser: [0x3a2f5a, 0x332a50],
  cipher: [0x2e9e5b, 0x298d51],
  disguise: [0xe58bb0, 0xd97ea4],
  gadget: [0xd99a3a, 0xc98c33],
  driving: [0xd9503a, 0xc74734],
  hack: [0x2f6bff, 0x2a60e6],
}

/** Rarity tier colours. */
export const RARITY = {
  common: 0xa7b0be,
  rare: 0x3d8bff,
  epic: 0xa35cff,
  legendary: 0xffc83d,
} as const
