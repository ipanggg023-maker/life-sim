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

## Release 4 built (2026-11-05)
- **races.ts: rites of passage** at each race's own age: orc 13 (first hunt), beastfolk 14 (moon run), halfling 15 (first feast as host),
  human 16 (oath at the temple), dwarf 30 (first forging), demon-born 33 (true name), dragon-born 40 (first flight), elf 50 (night under the old tree).
  Each has two attempts with real odds, plus "don't take part". Passing gives a lasting boon and a deed. Heirs older than the rite count as passed.
- **Youth years** for long-lived races: a log note at 18, and one youth scene per race before the rite.
- **Two race events across life for each race**, plus a race legend late in life (after passing the rite, stage age 55+, fame 40+ or 4+ deeds).
- **Prejudice 0–2** for orcs, beastfolk, dragon-born and demon-born, weaker where the race is common (12%+ of the kingdom). Fame 40+,
  standing 20+ and half blood each lower it. Effects: job odds −12% and living cost +8% per level, plus "door closed" and "guard" scenes
  where you can win people over (a person who remembers, and standing).
- Power tab: rite status and how this kingdom sees your race.
- Survey (12 lives per race): everyone finds work; orcs have less gold at 50 (864 vs human 1193); lifespans per race unchanged.

## Release 5 built (2026-11-05)
- **childhood.ts, early years:** six small moments at ages 1–5 (first word, storm night, one toy, a stranger at the fence, a fallen chick,
  sharing a sweet). Each choice plants a hidden seed that returns 15–40 years later, naming the moment. The seeds stay hidden in the
  fate ledger and the story until they return.
- **Five new schools** (places.ts SCHOOLS, 10 in all), each with its own secret line: scholars' academy, merchants' guild school, bards' college,
  thieves' den (with a heist test), temple novitiate (pick one of 5 gods; 20% of years bring that god's blessing).
  Schools teach a stat (`stat`) and open a career (`career`).
- **School life:** a friend accused, the teacher's favour, a leaked exam; expulsion when your class score is 12 or less after 2 years
  (expelled students get −30% odds for that school's career). **Offers at graduation:** class score 65+ starts the school's career at level 2,
  85+ at level 3.
- **No-school paths at 14:** apprentice smith (starts smith at level 2), street kids (can lead to a thieves' guild invite), hermit (a book of secrets),
  family farm (starts farmer at level 2), each with a follow-up story.
- **Mentor:** a teacher or craftsman takes you on, gives lessons, and later needs your help.
- **Lifelong rival:** a rival in your trade (compete, partner up, or smear them), a confession that can turn into love, a last letter in old age.
- **Teens:** a first crush (with a seed that returns), a night walking out, the cave behind the hill, and at 17 "who do you want to be".
- Survey (40 lives to 30): nearly everyone goes to school; ~3 childhood seeds return by 30; 1 death before 30.

## Release 6 built (2026-11-05)
- **people3.ts, romance stages:** a partner starts out "courting". After 2 dates (or bond 75), a popup asks "what are we?". Being together is required
  before a proposal (module marriageBlock). Dates are recorded by the date action. Each lover has a main want (from their values):
  matching values, time, their dream, or safety, each with its own scene. A neglected relationship (no date for 3 years) has a "quiet house" scene,
  and a partner can leave. Also family disapproval, and a political marriage for nobles, rulers and courtiers.
- **Person actions:** introduce two people (eases grudges, can make a couple), and write a letter (free, once a year). People actions (fp:) now cost
  1 of the year's time, like activities. Every action records when you last talked; every 5 years a note names close people you haven't talked to.
- **Friendship:** a loyalty test (lie for a friend vs. a 50-gold reward), sworn siblings at bond 85+. **Betrayal with signs:** a jealous friend starts
  "turning" and you see warning signs (ask, watch, ignore); if you watched, you catch them.
- **Grief:** a close death (bond 50+) brings a 3-year grief with a popup choosing how you grieve (drink, work, faith, revenge after a violent death),
  each with lasting effects; anniversaries every 10 years.
- **Party:** a party name, members' personal quests (help, or they leave), and members can die on a failed quest.
- **Household staff** (home tier 3+ or 300 gold): steward (−20% upkeep, catches theft), bodyguard (×0.85 death odds), servant (gossip), with yearly
  wages; unpaid staff quit, disloyal ones steal.
- **Famous people:** at fame 40+, notables of your kingdom invite you (befriend, spar, refuse), once every 8 years.
- **Go out and meet people** (activity): tavern, training ground, your trade, noble parties; single adults may meet someone.
- **People tab:** close circle on top, acquaintances folded; love stage, sworn siblings, and the partner's main want are shown.
- Fixed a trap: events that switch themselves off in `prepare` get dropped by the queue re-check, so they now switch off in their choices.
- Survey (30 lives): married 18/30 with stages vs 19 without, kids 1.4 per life either way, close circle ~14.

## Release 7 built (2026-11-05)
- family2.ts: grandchildren (new "grandchild" relation, heirs when their parent is gone), adoption (3-year gap), a newborn naming scene,
  fertility by life stage and race (elves can have children long after 44), a parenting style (fold chips; "absent" gives +1 yearly time),
  kids' own dreams, sibling rivalry, adult children joining the family trade, ageing choices, a home in old age, a last scene with a last wish
  that echoes in the heir, family reputation with a crest and motto across lives, family secrets, inheritance disputes, children reacting to divorce,
  stepfamily, outliving descendants. Four new callings in family.ts: elder, last great work, atonement, one last adventure.
- Survey (20 lives each): kids 1.6–1.9 and grandkids 2.3–2.9 per life for humans, elves and dwarves; lifespans unchanged.
- Checked on screen: family fold with parenting chips and grandchild, หลานสาว in People, adoption, home in old age, a new calling, the last scene. Fixed: the last scene could be dropped when health changed mid-year (now latched with ftLastDue, also fires from 75 with health 35 or less, or at 85).

## Release 8 built (2026-11-05)
- power2.ts: breakthrough trials (a master duel, a beast hunt, meditation, a reckless all-in that is the only one that can kill); the plain roll is 15% worse than the trials.
  Fifteen years of steady training lifts the cap one rank. Learn another style from a new master (the old one holds a grudge); invent your own technique at master rank.
  Corruption: forbidden breaks, the death school and dark deeds add to it; at 50 an inquisitor comes, at 80 you can lose control; penance at the temple lowers it.
  Potions: wound salve (auto at low health), strength draught (+8% on the next dangerous choice), revival (one death, not old age, once per life, alchemy rank 3 to brew). Carry limits 3/3/1; alchemy makes them cheaper.
  Craft ranks for smithing, alchemy, healing and lore (jobs teach them; healing 3 gives +1 health a year, lore helps smarts checks, smithing 3 can reforge).
  A weapon is named after 10 kills. Seclusion for 1, 3 or 5 years (lots of training, town activities closed, a 12% injury and 1.5% death chance a year, 5 years before going back).
  Bodies decline with age (elves and long-lived races less); opposite elements cost 5% on spells; a peak-power event at rank 5. A "path of power" fold in the Power tab.
- Engine: deathSaves hooks; a death during the year's hooks now ends the year cleanly.
- Survey (80 random bots): median death 59 (ceiling 60, unchanged). Seclusion had been giving bots safe years (median 70) until it got real dangers and a cooldown.
- Checked on screen: path-of-power fold, the breakthrough popup (plain 75%, trials 90–97%), a master-duel breakthrough, the potion shop with the alchemy discount and revival potion.
