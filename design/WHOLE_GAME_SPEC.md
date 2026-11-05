# Whole-game update: spec and build order (2026-11-05)

All decisions are in design/GRILL.md (14 parts plus the whole-game rules). This file is the build plan: what order, how the hard rules work,
and the renaming draft that needs approval before it ships. The look of the UI stays the same; only ease of use changes.

Every release gets a bot survey before and after, a balance and QoL pass, tests, an on-screen check, and a push only after asking.

## How the four whole-game rules will work
1. **No repeats each year.**
   - Small moments can't return within 15 years or twice with the same person.
   - Main stories already never repeat within a life.
   - The year builder prefers events you've never seen in **any** life.
2. **No two lives share a story.** A finite set of written stories can't guarantee this alone, so three layers:
   - **Main stories you've seen in any past life are held back** (the soul already keeps a seen list) until every other eligible story is used up.
   - **Many more stories tied to routes and races** (merchant, thief, priest, scholar, beast tamer, each race), so different lives draw from different pools.
   - **Stories assembled from parts** (who, where, what's at stake, the twist) for the common slots, so even a reused shape has different people,
     places and outcomes, and the world itself (rulers, wars, dragons, your past lives' legends) is different every life.
3. **Everything is real.** Each new system writes into the person, family, kingdom or world state, not just the log.
   Every release adds a test that checks a choice made early changes something measurable later.
4. **Gender-correct words.**
   - Add one helper for gendered words (หนุ่ม/สาว and the like), picked from the person it describes.
   - Replace all hard-coded ones; there are about 65 uses of "หนุ่ม" in the fantasy content alone.
   - Add a test that scans generated titles and log lines for a female character and fails on male-only words.

## Build order (17 releases)
| # | Release | Covers (see GRILL.md) |
|---|---|---|
| 1 | **Foundations** | the four rules above; removing risk lines; one-line "why it failed"; short year summary; phone fixes (bigger buttons, popups with choices in view, less scrolling); the renaming (after approval) |
| 2 | **Story engine** | stories from parts; multi-year arcs and the threads list; world news line; chapter-style year titles; log volumes and turning points; redo one moment; "live quietly for N years" and multi-year auto mode |
| 3 | **Birth** | omens, family types (orphan, adopted, noble blood, outcast), twins and siblings, star hint, half-races, rare-race unlocks, fewer and stronger talents |
| 4 | **Races** | a life path for all 8 races: rites at each race's coming of age, race events, real-but-beatable prejudice, slower growing-up for long-lived races |
| 5 | **Childhood and school** | seeds at ages 0–5, six new schools including the temple novitiate, no-school paths, school-year beats, graduation by rank, lifelong rival, mentor, teen years |
| 6 | **People** | romance stages, visible NPC lives, close circle, feelings as words, top-3 memories, tested friendships, enemies who plot, betrayal with signs, grief, staff, letters, new actions, famous people, shared time budget |
| 7 | **Family 2** | grandchildren, parenting style, kids with their own will, adoption, ageing with choices, the last scene, family reputation, 4 new callings, inheritance disputes, family secrets, divorce and children, outliving descendants, remarriage, elder home, family trade |
| 8 | **Power 2** | breakthrough trials, learned techniques and your own named one, spells as choices, spellblades, corruption, masters, craft and lore ranks, age effects, elements, seclusion, potions, style edges, plain-language Power tab, world-changing peak power |
| 9 | **Danger** | fights in beats, lasting injuries and recovery, dungeon expeditions that continue, bestiary, war roles, contract board, bounties, nemesis beast, defending your city, poison and plague, loot, dramatic gear breaks, sea and mounted fights, nerve, fleeing, a peaceful-life path |
| 10 | **Underworld and law** | thieves' guild route, prison as its own stretch of life, courts and trials, killing consequences |
| 11 | **Careers 2** | court, faith, arts and sea jobs; job story arcs; your own business; side gig; workplace politics; trade guilds; body of work; apprentices from level 3; mid-life turn; raises; hiring trials; patrons |
| 12 | **Money 2** | goods and routes, investing, taxes, gambling, land with tenants, poverty paths, lending, theft, charity, lifestyle, booms and busts |
| 13 | **Society** | kingdom cultures, the court path, yearly ruling decisions, living history, several reputations, four faction kinds, faiths, class, travel journeys |
| 14 | **Creatures** | life-long dragon bond, dragons as powers, extinction, dragon-born kinship, new creatures, pets 2, markets, bargains, beast-tamer route, habitats, breeding, flight, creatures in the turn beat |
| 15 | **Legends** | renamed and new legendary weapons including Excalibur, each usable in fights with its own events; relic will and history; forging a relic; clue-based mysteries; route sagas; wonders; prophecies; retold legends; world crises; hidden history; soul journal; gods; curses; realms; ghosts |
| 16 | **Death and the soul** | soul memories, soul ranks, unfinished business, deed-based shop unlocks, life story card, soon or far rebirth, rare recognition, route goals, last moments and cheating death, afterlife passage, undeath, graveyard family tree |
| 17 | **Ease of use** | grouped Do tab with suggestions, life goals, alerts, hints, tab summaries, auto-backup, mis-tap undo, story export, settings, sorted People list |

Foundations go first because the four rules apply to everything built after.

## Renaming draft (needs approval)
**Body ranks** are sword-only words today. Proposed style-neutral names, with your weapon style shown next to the rank (e.g. "ยอดนักรบ · สายขวาน"):

| rank | now | proposed |
|---|---|---|
| 0 | สามัญชน | คนธรรมดา |
| 1 | นักสู้ | นักรบฝึกหัด |
| 2 | นักดาบ | นักรบ |
| 3 | ยอดนักดาบ | ยอดนักรบ |
| 4 | ปรมาจารย์ดาบ | ปรมาจารย์แห่งยุทธ์ |
| 5 | นักบุญดาบ | วีรชนในตำนาน |
| 6 | เทพดาบ | เทพแห่งสงคราม |

**Magic ranks:**

| rank | now | proposed |
|---|---|---|
| 0 | ผู้ไร้เวท | ผู้ไร้เวท |
| 1 | ผู้ฝึกเวท | ผู้ฝึกเวท |
| 2 | นักเวท | นักเวท |
| 3 | จอมเวท | จอมเวท |
| 4 | อัครจอมเวท | อัครจอมเวท |
| 5 | ปราชญ์เวท | จอมเวทในตำนาน |
| 6 | จอมเวทแห่งดวงดาว | ผู้กุมดวงดาว |

**Guild tiers**, reordered so each step reads as a step up: ทองแดง → เหล็ก → เงิน → ทอง → มิธริล (today iron comes before copper).

**Legendary weapons:** renamed, plus one new weapon for each style that has none, and Excalibur.

| id | now | proposed |
|---|---|---|
| veilcutter | เวลคัตเตอร์ | ดาบฉีกม่านเวท |
| dawnchoice | อรุณาเลือก | ดาบอรุณผู้เลือกนาย |
| wyrmsbane | ไวร์มสเบน | ทวนพิฆาตมังกร |
| stormcrown | มงกุฎพายุ | มงกุฎสายฟ้าแห่งสภา |
| embersoul | คทาวิญญาณถ่าน | คทาถ่านวิญญาณ |
| grief | ดาบโศกา | ดาบโศกาอนันต์ |
| phoenixring | แหวนฟีนิกซ์ | แหวนเพลิงฟีนิกซ์ |
| new | — | **เอ็กซ์คาลิเบอร์** (sword in the stone; only someone worthy of a throne can draw it) |
| new | — | ธนูจันทร์เสี้ยว (bow) |
| new | — | ขวานผ่าภูผา (axe) |
| new | — | ค้อนหลอมดารา (war hammer) |
| new | — | มีดคู่เงาสนธยา (twin daggers) |
| new | — | โล่ปราการนิรันดร์ (shield) |
| new | — | สนับมือหัวใจมังกร (fists) |
| new | — | คทาห้วงกาล (staff) |

**Job titles and other titles:** all 28 career title ladders and NPC epithets get the same pass for fit and gender. The full list comes with Release 1 for approval.

## Release 1 built (2026-11-05)
- **Gender:** fitGender helper (engine/util.ts) on career titles, created people's jobs, destiny jobs and lover texts; new story characters
  called "หนุ่ม" are always male. Job titles needed no renames beyond gender (พ่อค้า/แม่ค้า, พ่อครัว/แม่ครัว, ราชาโจร/ราชินีโจร, มหาดเล็ก/นางกำนัล, สามเณร/สามเณรี).
- **No repeats:** main stories seen in past lives are skipped until fewer than 10 unseen remain; repeatable small events need 15 years between them.
  Result: a second life shared 86% of the first life's main stories before, 0% after. A second life now gets only ~9 main stories,
  because the pool is ~80 — Release 2's stories from parts fill this.
- **Legacy:** only memorable lives (fame 30+, 2+ deeds, or a legend) enter the chronicle and legends.
- **Popups:** risk lines removed; a failed choice shows one line of why.
- **Year summary:** top 3 changes (deaths, rank, money first), "ดูทั้งหมด" for the rest.
- **Phone:** close button 40px, chips 36px, a wider tap area on the odds "i", a smaller header image on short screens.
- **Names:** the body ranks above, the user's magic ranks (ผู้ตื่นรู้มานา, ผู้ฝึกหัดเวท, นักเวท, จอมเวท, มหาจอมเวท, มหาปราชญ์เวท, ผู้ครองดารา),
  guild tiers ทองแดง → เหล็ก → เงิน → ทอง → มิธริล, and the user's relic names (ดาบผ่ามิติรัตติกาล, ดาบสุริยัน, ทวนพิฆาตมังกร,
  มงกุฏราชันอัสนี, คทาวิญญาณเพลิงนิรันดร์, ดาบคำสาปแห่งความโศกา, แหวนวิญญาณฟีนิกซ์). Old worlds take the new relic names.

## Release 2 built (2026-11-05)
- **Stories from parts (storygen.ts):** 16 situations × 16 kinds of person × 6 twists, set in your own city. Each situation is its own event
  with 3 ways (force, wits, heart, luck, or pay a sure price). The soul remembers each combination it has seen. The same situation
  can't come back within 15 years in one life. Generated stories fill the main slot when no fresh written story fits, and take 25% of slots anyway
  (score 2.5, so job, court and war events still win when relevant). Injuries are scaled like written stories (×0.2).
- **Threads:** twists can open a storyline (they come back to help, come back for revenge, or know something about your parents), due in 2–8 years,
  at most 3 open. Shown as "เรื่องที่ยังไม่จบ" in the Log tab.
- **Year:** chapter titles name what happened ("อายุ 33 · หนี้ที่คู่ครองซ่อนไว้"); one world news line a year from the chronicle or the world's state.
- **Log tab:** the story is grouped into life-stage volumes (stretched for long-lived races), with turning points starred.
- **Redo:** once a year, redo one small moment for −3 happiness (only right after the year, in the same session).
- **Live quietly 5 or 10 years:** personality decides calm years; it stops for forced or important events, danger, family births or deaths,
  health under 40, or new debt, and the summary says why it stopped.
- Job, court and war events repeat every 5 years instead of 15.
- Result (10 souls × 3 lives): main stories per life 51 / 48 / 40, none shared with earlier lives (a second life got ~9 before), lifespans unchanged.

## Release 3 built (2026-11-05)
- **birth.ts.** Birth stays fully random; heirs (BirthOptions.heir) skip these extras, and tests can pass `plain`.
- **Birth omens (~23%):** war, comet, dragon flight, plague, eclipse, harvest. Each has a small effect and its own childhood event at 7–13.
- **Star hint** at birth, in the log and on the birth screen; the exact count still comes at the reading at 6.
- **Family types (~17%):**
  - foundling: a guardian raises you, your real parents can turn up (16–45)
  - raised by another race: small culture bonus, meeting your own people later
  - noble blood: known (rich, standing +10) or hidden (a herald comes 16–45: claim, keep secret, or sell it)
  - outcast family: poor, standing −8, a name to change or clear
- **Twins (3%)** with a "shared fate" scene and heavier grief. Older siblings take a role: protector, rival or heir, each with a scene.
- **Half-races (6%, and the children of mixed couples):** half the other race's stat changes, lifespan midway, race shown as "มนุษย์เลือดครึ่งเอลฟ์",
  with two events about belonging and being a bridge between peoples.
- **Rare races unlocked by deeds:**
  - dragon-born: ride or raise a dragon, or reach bond 60
  - demon-born: a pact, or surviving the hunt
  - unlocked races roll at 5 instead of 0.6 / 1.2 (soul.rareRaces)
- **Talents:** every fantasy talent already evolves, and a life already gets 2–3. The weak common ones are stronger now (stats +6 → +10 and similar).
- Balance (40 lives each): median death 81 plain vs 90 with extras (the lives take different random paths), gold at 50 772 vs 866.
