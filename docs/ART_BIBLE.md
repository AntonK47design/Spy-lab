# Spy Lab — Art Bible

Overrides any "procedural placeholder" idea. Source: Anton's graphics spec (Kickoff lessons §8), adapted to Spy Lab.

## Look
A **bright toy diorama floating in a dark void**: chunky, bevelled, saturated, readable at a glance; sunny-afternoon
light; fixed high three-quarter camera. Theme: a cosy harbour bakery on top, a colourful secret spy academy behind it.

## Principles (checked on every screenshot)
1. Fill the frame: >= 65 % walls/furniture/characters/world UI, <= 35 % empty floor, >= 15 distinct props per frame.
2. Value ladder: void -> floors -> walls -> interactables + characters -> UI.
3. Enclosure: every activity has its own floor + visible edge (cutaway rooms, fenced zones, raised plot with curb).
4. Characters fill 9–12 % of the viewport height, faces readable.
5. World UI tells what to do: pads = price + icon + hologram ghost; stations = kit counters; cadets = request bubbles.
6. Squint test: hero, pads and stations pop first.
7. No mid-value same-on-same; every surface framed by curb, fence or line.

## Palette (`src/view/palette.ts`, the only place with hex values)
| Layer | Spy Lab |
|---|---|
| Void | `#1E1A33`, vignette `#14111F`, fog same colour 60–140 m |
| Plot curb | top `#EADFC8`, side `#B7A88A`, shadow side `#4F4466` |
| Street / outdoor | warm paving `#E8D7B0` / `#DCC89C`, 1 m checker; road `#5A6070` with cream dashes |
| Bakery floor | pastel checker `#FFF4E8` / `#F7CFD8` |
| Corridor | warm tiles `#F6E7C8` / `#EAD6AD` |
| Room floors (one material each) | Vault: teal tiles `#2FA6A0`; Laser: dark rubber with dots `#3A2F5A`; Cipher: green circuit `#2E9E5B`; Disguise: pink planks `#E58BB0`; Driving: tartan track `#D9503A`; Hack: blueprint grid `#2F6BFF` |
| Walls | interior `#F3EEE6`, brand top trim, darker skirting `#C9BFB0` |
| Brand | Spy Lab primary `#2F6BFF` + yellow `#FFD23F` + white (kits, banners, flags, trims); bakery accent coral `#FF6B5E` |
| Interactables | cash `#3DDC84`, stars `#FFC83D`, orange accents `#FF7A2E`, kits = brand yellow |
| Locked (blueprint) | `#5AB4FF` @ 35 %, edges `#BFE3FF` |
| Rarity | common `#A7B0BE`, rare `#3D8BFF`, epic `#A35CFF`, legendary animated gold `#FFC83D` |
| UI | white / saturated fills, 3–4 px outline `#1D2433`, white text with dark stroke |

## Geometry sources
- **Characters + props from CC0 packs only**, one chunky low-poly palette-texture style:
  - people: Kenney Mini Characters (Kickoff) or KayKit Adventurers-style chunky characters;
  - props: KayKit Restaurant Bits (bakery), Furniture Bits (offices), Prototype Bits (training rigs), City Builder Bits (street).
  - Current Quaternius CC0 models stay only until the chunky packs are in (style mismatch: realistic proportions).
- **Architecture procedural but bevelled**: rounded boxes with skirting, top trim, 2–3 tone accents, caps/bases. No raw primitive props.
- Missing prop -> stop and ask Anton, never ship a placeholder.

## Characters & roles
| Role | Look |
|---|---|
| Director (hero) | unique dark suit + fedora + sunglasses |
| Cadets | brand tracksuit (blue `#2F6BFF` / yellow trim), tinted per room once assigned |
| Kit runner | orange apron + crate prop |
| Counter clerk | bakery apron (coral) + cap |
| Instructor | white coat + clipboard |
| Agents (cards) | rarity ring under feet + badge above head |
Tinting via palette-cell UV remap at build time (`scripts/kit-remap`), seeded skin/hair variety, shared clips:
idle, walk, run, carry, sit, cheer, role action.

## Materials, light, render
MeshLambert everywhere (palette texture / vertex colours), canvas-drawn 64–128 px floor patterns with noise,
baked vertex AO (wall bases, under furniture, curb), ACES filmic exposure ~1.05, sun `#FFF0D6` ~2.4 with short soft
PCF shadows (Mid/High), hemisphere sky `#EEF4FF` / ground towards void ~1.45, subtle fresnel rim on characters.
Quality tiers: High DPR 2 / shadows 2048 / AA; Mid DPR 1.5 / 1024 / AA; Low DPR 1 / blob shadows / 30 fps lock.

## Camera
Perspective, FOV 48° vertical, pitch 52°, smooth follow with slight look-ahead. Visible world width ~21 m landscape,
~11 m portrait. Rooms are cutaways: back walls 2.4 m, front walls 0.3 m stubs.

## Layout (area 1: Harbour Bakery HQ)
```
                     [ blueprint ghost: next area behind construction fence + padlock + price ]
   +-----------------+---------+-----------------+
   |  MISSION CONTROL|    C    |  VAULT WORKSHOP |   rooms: own floor, cutaway walls,
   |  holo table,    |    O    |  practice safes,|   station + basket + kit chip,
   |  screens, desks |    R    |  kit crate, desk|   cash pile spot, queue lane
   +-----------------+    R    +-----------------+
   |  LASER GYM      |    I    |  CIPHER ROOM    |
   +-----------------+    D    +-----------------+
   |  DISGUISE STUDIO|    O    |  GADGET LAB     |
   +-----------------+    R    +-----------------+
   |  DRIVING SIM    |         |  HACK LAB       |
   +-----------------+---+-+---+-----------------+
   |  BAKERY: cafe tables | oven(secret) | SIGN-UP COUNTER + queue  |
   +----------------------+--------------+--------------------------+
   ======================= street (arrival: pastry van) ==========================
```
Raised plot (+0.25 m) with light curb; dark void around; distant harbour silhouettes (cranes, lighthouse).

## World UI & juice
Unlock pad: rounded tile, white dashed border, big price (cash icon + bold white number, dark outline), item icon,
blue hologram ghost; fill animates; completion = ghost turns solid with squash-and-stretch, dust ring, confetti.
Stations: kit chips "3/4"; cadets: request bubbles; "+$" floaters fly to the HUD. DOM labels via `t()`.
Icons rendered from the real 3D models at load (offscreen ortho, 128 px data URLs). One canvas decal atlas.

## HUD
Bundled rounded display font (e.g. Fredoka 600) with dark stroke + drop shadow; settings + portrait with level ring
top-left, big star on progress bar top-centre, large cash pill top-right, objective pill under the star bar with the
rendered target icon; bounce on change, rolling cash counter; no overlap at 360x640, 390x844, 844x390, 1024x768.

## Performance
<= 150 draw calls, <= 400 k triangles, Low >= 30 fps with 30 characters, heap < 250 MB, textures <= 1024 px.
Cull rooms by camera rect, distance-cull skinned characters (~26 m), 8 Hz off-screen animation, 12-tri boxes for
repeats, instancing for crowds, no shadows on far areas, no per-frame allocations.

## Review
`?showcase=1` (dev only) lineup of every prop/station/character. After each visual change: screenshots at
1280x720, 390x844, 844x390 checked against the principles. Anton has the final word on the look.
