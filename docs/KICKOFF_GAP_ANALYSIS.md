# Spy Lab vs. Kickoff-Academy-Lessons (docs/KICKOFF_LESSONS.md)

## Game card (Spy Lab mapping)

| Slot | Kickoff Academy | Spy Lab |
|---|---|---|
| Theme | Youth football academy | Secret spy academy behind a bakery |
| Hero | Coach | The Director |
| Customer NPC | Trainee: signs up, trains, graduates | Cadet: arrives as a "customer", signs up, trains, graduates |
| Arrival | Bus at the gate | Pastry delivery van at the street door |
| Check-in point | Sign-up desk | Bakery counter (the "secret order") |
| Carried supply per area | Balls / water / bibs | Training kits per room: stethoscopes (Vault), smoke capsules (Laser), code books (Cipher) |
| Stations | Goal, cones, wall, track | Practice safes, laser frames, cipher desks, disguise mirrors, driving rigs, hack terminals |
| Payoff moment | Sell for transfer fee or keep | Graduation card: keep as agent or "loan out" for a fee |
| Spectacle event | Match highlights + timing game | Missions (6 minigames) |
| Staff | Ball boy, receptionist, assistant coach, accountant | Supply runner, counter clerk, instructor per room, accountant (cash -> vault) |
| Areas | Park -> Training ground -> Stadium | Bakery HQ -> (Relocate HQ: ice cream parlor, ...) |
| Collectible | Players with rarity / OVR | Agents with rarity + 6 skills |

## Status per lesson

| # | Lesson | Spy Lab today | Gap |
|---|---|---|---|
| 1 | Spawn 2 m from first cash, 1st purchase ~0:02, 3 unlocks <= 20 s | Spawn ~3 m away, first cash 0:05, first upgrade ~0:17 | **Big**: opening is ~4x slower than the lesson |
| 2 | First customer already waiting | First cadet already training | ok |
| 3 | Opening boost (first ~50 s) | none | missing |
| 4 | Beat sheet enforced by bot | `npm run sim` checks brief pacing (0:05/0:15/0:40) | targets differ; no gap metric, 1 seed |
| 5 | Iframe keyboard focus + hint | none | missing (cheap, high value) |
| 6 | Touch hint "Drag to move" | none | missing (cheap, high value) |
| 7 | Fixed tutorial route + world arrow | yes (Marmalade + arrow + edge pointer) | ok; steps not flag-based yet |
| 8 | Tap to explain (5 s card) | tap opens room panel | partial |
| 9 | Juice everywhere | cash fly, pops, sounds (silent placeholders) | real audio missing |
| 10 | Core loop: carry stack + serve customers | hero only collects + buys | **Big design fork** |
| 11 | Fixed 60 Hz sim | variable dt (clamped) | missing |
| 12 | No primitive placeholders | safes, lasers, construction partly primitives | partial |
| 13 | Characters 9-12 % of viewport height | ~6 % | camera too far |
| 14 | Distance-cull skinned chars, 8 Hz off-screen anim | none | missing (perf) |
| 15 | Illustrated key art for covers | none yet | later (needs image AI from Anton) |
| 16 | Funnel analytics (tut_*, first_frame, minute_N) | tutorial_step only | partial |
| 17 | No interstitials in the first ~3 min | blocked during tutorial; Bridge controls delay | ok |
| 18 | CrazyGames build | Playgama only (brief) | open question |
