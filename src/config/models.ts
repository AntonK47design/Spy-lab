/**
 * Model catalog (built by `npm run assets` from assets-src/models; only referenced files are built).
 * Props: KayKit CC0 packs (Restaurant / Furniture / Prototype / City Builder Bits) — one chunky style.
 * Characters: Quaternius CC0 (temporary until Kenney Mini Characters arrive).
 * `scale` normalizes each pack to world units (a person ~1.75 tall, a counter ~0.9 tall).
 */
export interface ModelDef {
  file: string
  scale: number
  core: boolean
  /** Material-name -> color overrides (sRGB hex) applied when baking. */
  tint?: Record<string, number>
}

const R = 0.85
const kk = (pack: 'restaurant' | 'furniture' | 'prototype' | 'city', n: string, scale = R, core = true): ModelDef => ({
  file: `kaykit_${pack}_${n}.glb`,
  scale,
  core,
})

export const MODELS = {
  // bakery (Restaurant Bits)
  counter: kk('restaurant', 'kitchencounter_straight_A'),
  counterDeco: kk('restaurant', 'kitchencounter_straight_A_decorated'),
  oven: kk('restaurant', 'oven'),
  fridge: kk('restaurant', 'fridge_A_decorated'),
  stove: kk('restaurant', 'stove_multi_decorated'),
  crateBuns: kk('restaurant', 'crate_buns'),
  crate: kk('restaurant', 'crate'),
  crateLid: kk('restaurant', 'crate_lid'),
  tableRound: kk('restaurant', 'table_round_A_decorated'),
  tableRoundSmall: kk('restaurant', 'table_round_A_small_decorated'),
  chairA: kk('restaurant', 'chair_A'),
  stool: kk('restaurant', 'chair_stool'),
  menu: kk('restaurant', 'menu'),
  shelfPaper: kk('restaurant', 'shelf_papertowel_decorated'),
  jarA: kk('restaurant', 'jar_A_large'),
  jarB: kk('restaurant', 'jar_B_medium'),
  bun: kk('restaurant', 'food_ingredient_bun'),
  pillar: kk('restaurant', 'pillar_A'),
  // offices / labs (Furniture Bits)
  deskLong: kk('furniture', 'table_medium_long'),
  deskSmall: kk('furniture', 'table_small'),
  officeChair: kk('furniture', 'chair_B'),
  shelfBig: kk('furniture', 'shelf_B_large_decorated'),
  cabinet: kk('furniture', 'cabinet_medium_decorated'),
  lamp: kk('furniture', 'lamp_standing'),
  lampTable: kk('furniture', 'lamp_table'),
  frameLarge: kk('furniture', 'pictureframe_large_A'),
  frameLargeB: kk('furniture', 'pictureframe_large_B'),
  rugStripes: kk('furniture', 'rug_rectangle_stripes_A'),
  rugOval: kk('furniture', 'rug_oval_A'),
  cactus: kk('furniture', 'cactus_medium_A'),
  cactusSmall: kk('furniture', 'cactus_small_A'),
  couch: kk('furniture', 'couch_pillows'),
  armchair: kk('furniture', 'armchair'),
  books: kk('furniture', 'book_set'),
  // training / construction (Prototype Bits)
  targetStand: kk('prototype', 'target_stand_A_Decorated'),
  dummy: kk('prototype', 'Dummy_Base'),
  targetWall: kk('prototype', 'target_wall_large_A'),
  boxA: kk('prototype', 'Box_A'),
  boxB: kk('prototype', 'Box_B'),
  boxC: kk('prototype', 'Box_C'),
  barrel: kk('prototype', 'Barrel_A'),
  pallet: kk('prototype', 'Pallet_Small_Decorated_A'),
  palletB: kk('prototype', 'Pallet_Small_Decorated_B'),
  // street (City Builder Bits, miniature scale)
  road: kk('city', 'road_straight', 4),
  streetlight: kk('city', 'streetlight', 4),
  bench: kk('city', 'bench', 4.5),
  wagon: kk('city', 'car_stationwagon', 3.6),
  bush: kk('city', 'bush', 4),
  hydrant: kk('city', 'firehydrant', 4),
  taxi: kk('city', 'car_taxi', 3.6),
  sedan: kk('city', 'car_sedan', 3.6),
  trash: kk('city', 'trash_A', 4),
  dumpster: kk('city', 'dumpster', 3.6),
  buildingA: kk('city', 'building_A', 3.4),
  buildingB: kk('city', 'building_B', 3.4),
  buildingC: kk('city', 'building_C', 3.4),
  buildingD: kk('city', 'building_D', 3.4),
} as const satisfies Record<string, ModelDef>

export type ModelId = keyof typeof MODELS

export interface CharacterDef {
  file: string
  anims: 'kenney'
  core: boolean
}

const ken = (n: string, core = true): CharacterDef => ({ file: `characters_kenney_character-${n}.glb`, anims: 'kenney', core })

/** Kenney Mini Characters (CC0) — chunky, big heads (Kickoff look). Roles read by outfit. */
export const CHARACTERS = {
  director: ken('male-d'), // black suit, red tie
  cadetM1: ken('male-a'),
  cadetF1: ken('female-a'),
  cadetM2: ken('male-f'),
  cadetF2: ken('female-d'),
  cadetM3: ken('female-c', false),
  cadetF3: ken('female-e', false),
  clerk: ken('female-b', false), // gets the coral bakery apron colour
  runner: ken('male-b', false), // orange runner shirt
  instructor: ken('male-e', false), // white coat + glasses
  agentM: ken('male-c', false),
  agentF: ken('female-f', false),
} as const satisfies Record<string, CharacterDef>

export type CharacterId = keyof typeof CHARACTERS

export const ANIM_LIBS = {
  kenney: 'anims_characters_kenney.glb',
} as const

export const CHARACTER_HEIGHT = 1.7

/** Clip names per role in the shared library (first match wins). */
export const CLIPS = {
  Idle: ['idle', 'Idle'],
  Walk: ['walk', 'Walk'],
  Run: ['sprint', 'Run'],
  Wave: ['emote-yes', 'Wave'],
  Interact: ['interact-right', 'Interact'],
  Carry: ['holding-both'],
  Sit: ['sit'],
} as const
