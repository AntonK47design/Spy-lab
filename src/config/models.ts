/**
 * Model catalog (files produced by `npm run assets` from assets-src/models, all CC0 Quaternius).
 * `scale` normalizes each pack to world units (a person ~1.75 tall, a desk ~0.8 tall).
 * `core` models are part of the initial download, the rest stream in after game_ready.
 */
export interface ModelDef {
  file: string
  scale: number
  core: boolean
  /** Material-name -> color overrides (sRGB hex) applied when baking. */
  tint?: Record<string, number>
}

const home = (n: string, core = true): ModelDef => ({ file: `interior_home_${n}.glb`, scale: 0.5, core })
const furn = (n: string, core = true): ModelDef => ({ file: `interior_furniture_${n}.glb`, scale: 0.85, core })
const food = (n: string): ModelDef => ({ file: `food_${n}.glb`, scale: 0.26, core: true })
const cyber = (n: string, scale = 0.9, core = true): ModelDef => ({ file: `props_cyber_${n}.glb`, scale, core })
const street = (n: string, scale = 1): ModelDef => ({ file: `city_streets_${n}.glb`, scale, core: true })

export const MODELS = {
  // bakery
  oven: home('Kitchen_Oven_Large'),
  kitchenDrawers: home('Kitchen_2Drawers'),
  kitchenCabinet: home('Kitchen_Cabinet1'),
  fridge: home('Kitchen_Fridge'),
  tableRound: home('Table_RoundSmall'),
  stool: home('Stool'),
  plant1: { file: 'interior_home_Houseplant_1.glb', scale: 1.1, core: true },
  plant4: { file: 'interior_home_Houseplant_4.glb', scale: 1.3, core: true },
  plant7: { file: 'interior_home_Houseplant_7.glb', scale: 1.0, core: true },
  carpetRound: home('Carpet_Round'),
  carpet: home('Carpet_1'),
  window: home('Window_Large1'),
  floorLamp: home('Light_Floor1'),
  deskLamp: home('Light_Desk'),
  shelfSmall: home('Shelf_Small1'),
  bookshelf: home('Bookshelf'),
  drawer: home('Drawer_2'),
  couch: home('Couch_Medium1'),
  chair: home('Chair_1'),
  trash: home('Trashcan_Green'),
  door: home('Door_1'),
  croissant: food('Croissant'),
  cupcake: food('Cupcake'),
  donut1: food('Donut1'),
  donut2: food('Donut2'),
  donut3: food('Donut3'),
  bread: food('Bread'),
  pancakes: food('Pancakes_Stack'),
  waffle: food('Waffle'),
  // offices / labs
  desk: furn('Desk'),
  officeChair: furn('OfficeChair'),
  bookcase: furn('Bookcase_Books'),
  table: furn('Table'),
  computer: cyber('Computer', 0.8),
  computerLarge: cyber('Computer_Large', 0.75),
  tv1: cyber('TV_1', 0.8),
  tv2: cyber('TV_2', 0.8),
  fence: cyber('Fence', 1.1),
  lightSquare: cyber('Light_Square', 1),
  hazard: cyber('Sign_Corner_Hazard', 0.9),
  ac: cyber('AC', 0.8),
  lootbox: cyber('Lootbox', 1.2),
  // street
  streetStraight: street('Street_Straight', 2),
  streetlight: street('Streetlight_Single', 2.6),
  signNoParking: street('Sign_NoParking', 2.6),
} as const satisfies Record<string, ModelDef>

export type ModelId = keyof typeof MODELS

export interface CharacterDef {
  file: string
  anims: 'men' | 'women'
  core: boolean
}

export const CHARACTERS = {
  director: { file: 'characters_men_Suit.glb', anims: 'men', core: true },
  cadetHoodie: { file: 'characters_men_Casual_Hoodie.glb', anims: 'men', core: true },
  cadetCasualW: { file: 'characters_women_Casual.glb', anims: 'women', core: true },
  cadetCasual2: { file: 'characters_men_Casual_2.glb', anims: 'men', core: false },
  cadetAdventurer: { file: 'characters_women_Adventurer.glb', anims: 'women', core: false },
  agentSuitW: { file: 'characters_women_Suit.glb', anims: 'women', core: false },
  formalW: { file: 'characters_women_Formal.glb', anims: 'women', core: false },
  instructorM: { file: 'characters_men_Worker.glb', anims: 'men', core: false },
  instructorW: { file: 'characters_women_Worker.glb', anims: 'women', core: false },
} as const satisfies Record<string, CharacterDef>

export type CharacterId = keyof typeof CHARACTERS

export const ANIM_LIBS = {
  men: 'anims_characters_men.glb',
  women: 'anims_characters_women.glb',
} as const

export const CHARACTER_HEIGHT = 1.75
