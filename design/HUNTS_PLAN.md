# Random years, three choices, weapon hunts, ancient dragons (R18–R21)

Grilled 2026-11-06. Each release is tested, given a balance pass, checked on screen, and pushed only after the user's OK.

## Release 18: random years (plus small changes)
- Remove the "wrong click, undo the year" link everywhere.
- "Live quietly 5 / 10 years" only for long-lived races (elf, dwarf, dragon, demon).
- Show the current year beside the coins.
- Main stories: no age always shows the same story. Wide age ranges; pick from everything that fits, weighted, not just the top score.
- Forced events kept only where truly needed: birth, the star reading at 6, the school letter, race rites, breakthroughs, debt collectors, jail, death. Everything else becomes a random chance (school contests, path choices at 14 and 17, the calling at 60, and similar).
- Measure: in 30 test lives, no story appears at the same age in 40% or more of lives, except the kept locks.

## Release 19: at least three choices everywhere
- Every scene gets at least three choices. At the start, 925 of 1,315 scenes had two or fewer.
- Each new choice is hand-written for its story, with its own result. Built file by file.
- A test fails if any fantasy scene has fewer than three written choices.

## Release 20: legendary weapon hunts
- All 16 existing relics get a hunt.
- The world starts in year 1000. Each relic gets 3–6 past holders between years 1 and 999 (name, year, fate). The hunt's clues come from them: a grave, a diary, a descendant, a ruin.
- Start from the legends board in the World tab, from age 16. Choose any relic you don't hold. One hunt at a time; giving up closes that relic for this life.
- 4–5 chapters, one every 1–3 years, each a popup with at least three choices. Failing can wound or delay; the final trial can kill. Rival hunters chase the same weapon.
- If someone already holds it, the last chapter is facing them: duel, steal, trade, earn it as a gift, or wait for them to die. A stolen relic is hunted back.
- Names (past holders, places) go to the user as a draft list for approval before building.

## Release 21: ancient dragons
- Five ancient dragons older than history (alive before year 1): four elemental and one older than all. Each sleeps in a hidden place with its own story, linked to two or three of the weapons (weapons made to kill them, past holders who died fighting them).
- Find, wake, fight, bargain with, or learn from them.
- The world keeps the result across lives: slain ones leave a grave or lair, befriended ones remember your family name, and woken ones left raging burn towns or start a world crisis.
- Names go to the user as a draft list for approval before building.

## Release 18 built (2026-11-06)
- Undo removed. The 5- and 10-year skip shows only for elves, dwarves, dragons and demons. The current year shows beside the coins (for example "ปี 1010").
- One-time events now start at a random age within their window for each life (up to five years after the window opens). Main stories start up to ten years in, and are picked at random, weighted by how tied they are to your life, instead of always the best match.
- Forced events loosened to a yearly chance: the two path choices (14–16 and 17–19, still certain by the end of the window), school contests (35% a year), the family crest, the old-age home, a signature technique, a named weapon, the world noticing your power, the first beastfolk hunt and demon horns. The calling at 60 now comes in a random later year. Kept as locks: the star reading, the school letter, race rites, breakthroughs, graduation, debt collectors, jail, omens, plague, tax, last wishes, death.
- Measured in 30 lives: before, 18 stories hit the same age in 40% or more of lives (the wolf in the snow at 6 in 19 of 30). After, only the kept locks remain.
- Balance: share of bots dying before 60 is unchanged (66% before, 67% after).

## Release 19 built (2026-11-06)
- Every fantasy scene now has at least three choices. All 925 thin scenes got hand-written extra choices: 1,315 scenes in total, and none has fewer than three.
- The new choices live in third1.ts to third9.ts, keyed by event and scene, and are attached when the world loads (third.ts). There are three kinds:
  - A new outcome with its own text and effects.
  - A stat check with success and failure outcomes.
  - A variant of an existing choice, which runs the original choice in full (its odds, story flags and next scene) and then adds its own twist. Variants are used wherever a choice sets state the story needs: path choices, rites, multi-scene main stories, the masterpiece jobs and the "not ready" branches.
- Scenes with one choice (results, rewards) got two variants.
- A test fails if any fantasy scene has fewer than three written choices (fantasy_release19.test.ts).
- Balance: random bots now often take the middle-road option, so the share dying before 60 fell from 67% to 57%. That is back in the range of Releases 15–16 (54–57%), and the balance guardrail (at least 45%) still passes.
- Checked on screen: school letter, wolf in the snow, star-stone and festival popups each show three choices, and a new third choice in the wolf story carries on into its next scene.
