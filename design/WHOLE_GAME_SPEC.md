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

## Release 9 built (2026-11-05)
- danger.ts: big fights in three beats (opening: charge, guard or use the ground; turn: technique, spell, strength draught, an ally such as a wolf, party member, crew or dragon, or look for a weakness; ending: the deciding roll, with a priced flight where fleeing is allowed).
  Fresh wounds from any danger hit of 6+ health: rest (60%), a healer, healing rank 2 or a wound salve closes them (+4 health back); left alone, 25% a year turn into lasting injuries (lost eye, bad leg, burned hand, damaged lung), each with its own cost, cured at the temple for 80 gold or by healing rank 5.
  Poison, curses and plague worsen over three stages unless cured (healer, temple or penance), and can fade on their own.
  A guild board of three named jobs a year (pay by danger; regular clients pay more and offer a three-step chain of bigger jobs; some person-finding jobs hide a truth you decide on).
  Bounties with innocent targets, bribes, the gang behind them and friends who come for revenge later. A named nemesis beast born from a failed hunt returns every 6 years, stronger each time, until one of you falls.
  War roles on the draft (officer, field healer, spy, supplier, deserter) that move kingdom power; a siege of your city (walls, militia, evacuate, bribe, flee) that can damage your home and estates.
  Danger that comes to you: road bandits, monster raids, assassins once famous, storms and avalanches in port and mountain cities. Pirates at sea and mounted fights as three-beat scenes.
  Loot (a weapon, a map, monster parts, a sealed letter story). Weapons break only in a lost big fight, then get reforged stronger or are lost. Fear after a bad defeat (-6%) until you win again; bold lives fight better but die more, careful ones survive better.
  A vow to never take up arms: danger comes half as often, peaceful ways get +10%, and fighting breaks it. Every danger that comes to you has a way through without fighting (tested).
  bestiary.ts: monsters you've met show their weakness and home; meeting one gives +4%, three times +8%. A "wounds and danger" section and a bestiary in the Power tab.
- Dungeons now continue floor by floor in one trip (rest once, retreat any time, up to four floors), danger rising with depth and death odds higher after a warning at floor 3.
- Fixes found on the way: R8's training years only counted during seclusion (year hooks read last year's actions now); a revival potion mid-fight no longer skips the rest of the fight; activity ids ft_vow and ft_board were already taken (now ft_peacevow and ft_guildboard, with a test that ids stay unique).
- Survey (200 random bots): median death 50 (R8: 56); the extra deaths are bots pushing deeper into dungeons. Quiet lives unchanged (human median 62, elves far ahead).
- Checked on screen: the danger section and bestiary, a nemesis fight through all three beats with loot, the guild board with danger-based pay, a job twist.

## Release 10 built (2026-11-05)
- underworld.ts: a thieves' guild with five ranks (apprentice to Shadow King), joined by proving yourself or a referral; yearly guild work (pickpocketing, smuggling, protection money, toppling a rival boss, paying the guild to buy off guards).
  Heists in four beats (target by rank, plan, crew, the job), with loot from 80 to 500 gold; a failed heist goes straight to court. Heat rises with every job, cools each year, and at 60 the guards raid your home (fight, bribe, flee abroad, surrender).
  Court: hire a lawyer, call a close friend as witness, argue self-defence (only when it applies), confess for a lighter sentence, bribe the judge. Fines only end small cases; defending yourself gets harder with how serious the case is; four or more past crimes or harsh-court laws add a year.
  Prison is its own stretch of life: only prison activities show (work, train, learn from a prisoner, make an ally, plan an escape over three years, bribe a guard for a year off, appeal once per case), and only prison stories happen (the yard, a cellmate, a letter from outside, a guard's offer to inform, prison fever, a riot, visiting day). Release day lets you start honest, return to the guild, or go home. An escape makes you a fugitive.
  Killing outside war shifts your character, can bring guards and a trial, and years later the victim's family comes for you (fight, pay blood money, tell the truth).
  A "wounds, danger and law" section in the Power tab shows prison time, guild rank, merit, heat, record and kills.
- Fixes found on the way: a 1-year sentence used to pass without a single year in prison (sentences now count full years everywhere); the shared modern-world release message no longer shows in fantasy; the year headline skipped the prison filter; the murim world hides any activity group named "ในคุก", so fantasy uses "ชีวิตในคุก"; a rare orc arena event was raised to the same weight as other race events.
- Survey (200 random bots): median death 47 (R9: 50, within noise); quiet lives median 59.
- Checked on screen: guild jobs and a full heist, a raid, the court with all options, prison activities and escape planning, prison-only years, a prison story, release day, the Power tab lines.

## Release 11 built (2026-11-05)
- careers2.ts: eight new careers (court clerk to judge, tax officer, inquisitor, temple healer, painter, playwright, jester, caravan guide), each with two job actions, a masterpiece, and city bonuses. Careers sort into ten families.
  A hiring trial that fits the family (forge a piece, spar the trainer, judge an old case, perform on an empty stage...); a contact in the trade and a matching school help.
  Each family has a signature scene on reaching level 2 and a crisis at level 3, once per job, shown as their own popups.
  Your own business (smithy, apothecary, tavern, trading house) grows in five steps from a small shop to a trading family, with staff at step 2, bad years that can shrink it, rival shops (fight on quality, buy them out, or spread rumours), and selling up.
  A yearly side gig (busking, tutoring, short guard jobs, smuggling that adds heat). A guild for crafts, trade, arts and travel with ranks, yearly dues (two missed years means expulsion), a rule test, better hiring odds, and one rescue if you're fired.
  Named works (swords, songs, maps, verdicts...) that spread, help your work and become legends. Apprentices from level 3 who can surpass you or turn rival. A turning point between 35 and 50 (stay, change course with skills carrying over to level 2, or take a year off).
  Asking for a raise once a year (up to three, +8% each). Patrons (noble, mage or hero) who pay a little each year, drag you into feuds, and can fall from power. A boss caught embezzling (expose and take the post, blackmail, or burn the ledger).
  Leaving leaves a mark: fired means harder hiring in that family for 10 years; quitting well after 3+ years gives a reference.
  A "work life" section in the Career tab.
- Engine: startJob, hireTrialHooks, jobEndHooks (fired or quit) and salaryHooks.
- Balance: side income at first added about 10 years to random bots (money spent on healers); gig pay was halved and shop and patron income cut until the 200-bot median was back at 51 (R10: 47). The reckless-bot test now uses 120 lives, because deaths split into two groups and the 80-life median jumped six years on one life.
- Checked on screen: new careers in the job list, a jester's hiring trial, opening a tavern and the work-life section, the Do tab work group, a career crisis popup.

## Release 12 built (2026-11-05)
- money2.ts: investing in a voyage, an expedition, a mine or a friend's shop (20 or 60 gold, results in 2–4 years: profit, money back, or lost, sometimes with a story; a failed friend's shop hurts the friendship).
  Lending at 25% over three years: borrowers repay, beg for time (give time, forgive, or seize goods and make an enemy), or flee.
  Land with tenants: farms, villages (need two farms) and mines pay rent by the tenants' mood; squeezing pays 50% more but mood falls every year; tenant crises; a revolt below 15 mood; a lordship deed with a village, three farms and happy tenants.
  Property tax by kingdom (3–7%, +4% in war) every three years once you hold 80+ gold: pay, hide assets (hard), bribe, or move to a cheaper kingdom.
  A gambling habit from dice games (five plays makes a habit): a nightly urge that costs money and family bonds; resisting or a priest's help clears it.
  Poverty paths for the broke and jobless: begging, odd jobs, a stranger's kindness, crime's pull, and a way up through an apprenticeship.
  Theft for the rich (200+ gold) without a vault, guard or steward; a vault costs 40 gold. Charity: a temple, an orphanage or a bridge (deeds and standing), and an orphan who comes back to nurse you.
  A yearly lifestyle: frugal (living ×0.7, less happiness), comfortable, or lavish (×1.6, more happiness and standing, flatterers).
  Booms and busts per kingdom (plentiful harvest, gold rush, embargo, slump) for 2–4 years, changing prices, living costs, wages, rents and trade odds.
  A successful caravan can carry on to up to three more cities, each leg riskier and more profitable.
  A "money" section in the Career tab and a "money" group in the Do tab.
- Balance: the 200-bot median death is 50 (R11: 51). The reckless-bot test now checks that at least 45% of those lives end before 60, because the median jumps between the two age groups.
- Checked on screen: the money activities, buying a farm, the Career tab money section, a tax assessment.

## Release 13 built (2026-11-05)
- society2.ts: each kingdom has a culture (honour, trade, faith or magic) and a main god: Aldria faith and Solia, Varn honour and Garroth, Thalos trade and Myra; kingdoms founded later get one from their name. Careers that fit the culture are easier to get (+8%) and pay 10% more.
  Five classes (peasant to noble) climbed through wealth, a business, land, court rank, fame, a noble marriage or the throne; nobles sneer at new money once.
  Five reputations (honour, cruelty, wealth, skill, faith) worked out from what you have done; each career family cares about one when hiring.
  A court path (courtier, adviser, lord, confidant of the throne) through service, intrigue, gifts and noble marriage, with favour that fades if you stay away; a palace plot (expose, join, or stay out); at the top the council may name you heir.
  Rulers face one issue every year (famine, rebels, taxes, an heir, troops at the border), each moving stability, power and prosperity.
  Devotion to one god: a small yearly blessing, a duty every four years (tithe or pilgrimage; skipping it loses the blessing for three years). In faith kingdoms inquisitors hunt worshippers of other gods and the demon-born; holy wars call you to fight.
  A secret society (the Shadow Circle): an invitation, missions, an inner circle and a plot for the throne (help, betray, or walk away). Rebels in unstable kingdoms: missions, then a night of uprising you can lead to the throne.
  Moving kingdoms is a journey: choose a destination by culture, tax, god and your standing there, then travel by road, by sea from a port, or with a guarded caravan, and arrive to a summary of the new land.
  A "society, class and faith" section in the World tab.
- Balance: free yearly blessings first added about 5 years to random bots; devotion now gives its own small boons at 30% a year. 200-bot median 54 (R12: 50), 56% die before 60.
- Checked on screen: the World tab section, the journey from Varn to Thalos with a road robbery, the court.

## Release 14 built (2026-11-06)
- creatures.ts: your dragon grows through four stages (hatchling, young, adult, great dragon) with a personality (proud, gentle, greedy, curious) and a wish every five years (grant it for bond, refuse and it sulks). Children who grow up with it can become its friends; when you die it stays with an heir who was its friend, otherwise it flies off, and in a later life it comes back to your family as a friend or for revenge.
  A friendly ancient dragon can offer your kingdom a protection pact. Every slain dragon is gone for good; from three dead dragons the world's magic thins and spellcasters fight worse, and pacts end when their dragon dies. Dragon-born lives are called to the clan moot every eight years (go, pay tribute, or refuse and gain a dragon enemy).
  Mounts by region (war horse anywhere, giant wolf in forests, griffon in the mountains and sea serpent in ports for tamers) that add to your fighting power, join the middle beat of big fights (and can be hurt or killed when the fight is lost), carry over to an heir, grow wild and run off if neglected, and breed a named bloodline that becomes famous by the third generation. Flying mounts and dragons add a fast flight option to journeys that can draw attention.
  A beast market (mounts, selling monster parts from your bestiary) and a black-market dragon egg that may bring its mother after you. Beast tamers from level 2 can seek a basilisk (guards and fights), a unicorn (cures poison, curses and plague) or a phoenix (health every year).
  Forest spirits, a riddling fey whose gift comes back to collect years later, a house spirit, a ghost waiting a hundred years, a lich in an old tower, a sphinx in the mountains, and an owl that becomes a familiar.
  Each city kind has its own creatures; hunting a region raises its hunting pressure, and at 10 rewards drop and monsters stop raiding until it recovers.
  A "creatures and the uncanny" section in the World tab.
- danger.ts gained hooks so creatures can join the middle beat of fights and pay the price when it is lost.
- Balance: 200-bot median 48, 58% die before 60 (R13: 54 and 56%).
- Checked on screen: the animal market by region, buying a war horse, the World tab section.

## Release 15 built (2026-11-06)
- legends2.ts: eight new legendary weapons with draft names awaiting approval: เอ็กซ์คาลิเบอร์ (in a stone in Aldria's old temple yard; only someone worthy of a throne can draw it: a ruler, a high courtier, known noble blood, or standing 40+), ธนูจันทร์เสี้ยว, ขวานผ่าภูผา, ค้อนหลอมดารา, มีดคู่เงาสนธยา, โล่ปราการนิรันดร์, สนับมือหัวใจมังกร, คทาห้วงกาล. Old saves get them on their next year.
  Every relic is usable: once a year it appears as its own choice in any fight scene, with better odds and some with a price (Grief drains happiness, the ember staff burns, the time staff costs a year of life).
  Each of the 16 relics has its own event (a sealed door, a sword that refuses to be drawn, a dragon that smells the spear, a deadlocked council, a ring that can wake the dead once, a false king, a falling star to forge...).
  Relics have a will: Excalibur leaves the dishonest and returns to its stone, the Sun Sword leaves the cruel, the Eternal Bulwark leaves cowards; history of holders is shown.
  Forge your own relic at smithing rank 5 for 200 gold and a great sacrifice (ten years of life, all happiness, or all fame); it enters the world with your family name.
  Four hidden wonders (a lost city, a sunken temple, a sky island, the first tree), one claimant per world, each with its own requirement, found only after a lead (a treasure map from loot, the sphinx, or two pieces of world lore).
  A prophecy that may point to you or a rival (chase it, defy it, or fake it). World crises that span lives (demon invasion, dying sun, a dying god): lives push them back step by step, or after 120 years the world loses. Six truths of the world uncovered in old libraries and kept by the world across lives. One great prayer per life, answered with a price. Ghosts of past legends asking for unfinished business.
  A "legends of the world" section in the World tab.
- Balance: 200-bot median 51, 57% die before 60; wonders reached in about 1 in 5 random lives.
- Checked on screen: a relic choice in a guild fight and its result, the World tab section with the relic's past holders.

## Release 16 built (2026-11-06)
- souls2.ts (stories never cross lives; the soul carries only small traces, and the world keeps graves and legends):
  Soul ranks by lives lived (new, old from 3, ancient from 8, eternal from 20) with small birth perks, shown by a village elder at 12.
  Faint traces: a craft the last life mastered comes back as a head start at 12; being born in the same kingdom makes places feel familiar (+3 standing at 10).
  An afterlife judgement from kindness, honesty, faith, killings and corruption: a light soul gets luck and a guide who comes to teach the child; a shadow soul starts with nightmares; birth itself stays random.
  Unlocks earned by deeds (a throne, a dragon, master smithing, deep lore) that tilt later births a little (noble blood, a dragon omen, a craft head start).
  After death you choose to be reborn soon (5–20 years later) or far (50–200 years later); when soon, someone you loved may still be alive and feel something familiar (hint, tell the truth, or stay silent).
  Last words on every death, shaped by your character and the person closest to you. With strong faith in your god you may be pulled back from death once (rare), at the cost of five years and lasting nightmares.
  Every finished life leaves a grave in the world that later lives can visit for a small blessing. Death-school mages and the deeply corrupted may rise as a lich or ghost that a later life can free or talk to. World "firsts" (first master smith, first dragon rider, first orc king, first archmage) are recorded.
  The death screen shows a life-story card (chapters with their turning points, the people who mattered, the soul's judgement, rank and unlocks), and two rebirth buttons replace the single "new character" button.
- Fixed: epitaphs no longer put "ผู้" before titles such as เจ้าถิ่น.
- Balance: the faith rescue was making random bots live about 5 years longer; it now needs faith 60 and a 30% roll. 200-bot median 55, 54% die before 60.
- Checked on screen: the death screen story card, the epitaph fix, a "soon" rebirth landing 6 years later, and the new life starting.

## Release 17 built (2026-11-06)
- ease.ts (ease of use; no new story content, so balance is unchanged apart from a little fame for finished goals):
  An alert strip above the year button shows the two most urgent things (a wound, an illness, debt, a nemesis, a family member far away, a whelp or steed to look after, a breakthrough or promotion that is ready, an egg about to hatch). Click one to open its tab.
  The Do tab opens with "worth doing this year" cards (at most three, picked from your situation and goals) and a "life goals" fold: choose up to three of eight goals (throne, master, rich, warrior, family, relic, legend, dragon) with progress bars. Finishing one records a deed and a log entry.
  Each Do-tab group shows a one-line hint until you press "got it". Locked buttons now say why (join the guild first, need more money, and so on), and the early-return-from-seclusion button only shows while secluded.
  Undo: after a single-year age-up, a "wrong click, undo the year" link brings back the year before (until you make a choice).
  Settings and export (in the record tab): text speed (normal, fast, instant), hints on or off, large text, export this life's story as a .txt file, and the last three finished lives kept as backups you can download. The death screen also has an export button.
- Fixed: on phones the "instant text" button covered long popup titles; it now sits on the age row.
- Checked on screen: alerts, suggestions, goals, undo (age 26 back to 25), the settings fold, large text, and the phone layout of the popup.
