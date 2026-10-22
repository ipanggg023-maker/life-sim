# Murim rubric — status after groups 1–5 and follow-ups (2026-10-22)

Scored against `MURIM_EXPANSION.md` §19. Evidence comes from automated simulation (`src/engine/murim12–19.test.ts`,
`balance.test.ts`, `murim4.test.ts`) and browser checks. **No outside playtest has been done yet** — §19 requires one
before release, so these scores are an honest self-assessment, not a final grade.

| Category | Weight | Score (was) | Evidence | What would raise it |
|---|---|---|---|---|
| Core loop | 15% | **8** (7) | Yearly plan + time budget (adult 5 units, long trips 2); events come from real conditions; ~60 distinct events per random life, no single event above ~12% of a life's events; 15 calm slice-of-life moments for 40+ (≈3.7 per life that reaches 50) | Playtest pacing in the 25–45 band |
| NPC / relationships | 15% | **8** (7) | 8 relationship axes, memories, values/fear/limit/secret; loyal NPCs never betray; news spreads by region; NPCs live their own lives (in 120 lives: 22 weddings between acquaintances, 60 feuds, 75 moved away, 1,153 jobs, 103 scenes that pull you in); palace cast with goals, fears, ambitions and separate trust/debt/grudge | NPCs with their own martial progression and rivalries with each other |
| Choices / consequences | 15% | **8** (7) | Mixed-effect trade-offs; heat → interrogation → trial; rumours that can be traps, with useful actions even when false; consequences that ripen 5–25 years later (measured average 23 years) — spared foes, avengers, poison masters, grateful officials; tortured confessions that come back; vows broken by real actions | More consequence sources (seeds currently come from duels, crimes, jail, rumours, charity) |
| Generations / chronicle | 15% | **8** (7) | Lineage up to 8 ancestors on the family tree; legends across eras; founded sects become factions; unripe grudges and debts pass to the heir; court honour or stain follows the family; six succession outcomes recorded in reigns | Court dynasties founded by the player carrying into later eras |
| Balance | 10% | 8 (8) | Shown % = used % (exact); win rate within 3 points of shown across 3,710 rolls (9.1→7.8, 30.7→32.9, 50.9→52.2, 68.9→67.5, 91.7→90.8); careful bot median age 81, random bot 51; peak realm about 10% of cultivators (with talents; bone-root talents guarantee cultivation) | Careful-bot top death cause is chronic poison — worth a look |
| Content | 10% | **8** (7) | 22 causes of death in 80 random lives; 14 ribbon kinds appear naturally (of 23); court, faith, torture, rites, rumours and investigations add whole new paths | More events for the newer careers (woodcutter, waiter) |
| UI / UX | 8% | 7 (7) | Mobile layout, log filters, tap-a-name, family/lineage tree, onboarding, ribbon at death, court card that shows only what you could know, foldable life record, single yearly-plan control | Real phone playtest; accessibility pass |
| Stability | 7% | 8 (8) | `validateLife` after every simulated year across all new systems; save/load mid-event; repair on load; save version + legacy mode; old talents converted to murim talents on load | Migration tests for future schema bumps |
| Performance | 5% | 9 (9) | Worst save ~49 KB after a full life; ~0.8 ms per simulated year | — |

Release bar from §19 (every category ≥ 7, core four ≥ 8, real playtests): **the core four now reach 8 and every
category is ≥ 7 on automated evidence — the remaining gap is the playtest with different player types.**

## Watch list (found while measuring)

- Careful players most often die of chronic poison (45 of 400 careful lives) — check whether poison injuries are too
  sticky or too common in later life.
- Random players solve only about 1 in 3 investigations correctly (10 right, 23 wrong) — intended for random play,
  but worth confirming that careful reading of clues feels fair.
- Delayed consequences fire about 6 times per 120 random lives, because random play rarely kills or spares in duels;
  deliberate play sees far more.

## Measured numbers (reproduce with `npx vitest run src/engine/murim15.test.ts src/engine/murim19.test.ts src/engine/balance.test.ts --silent=false`)

- Successions in 120 self-running worlds: smooth 64, side branch 4, civil war 3, plus era breaks into the Three Kingdoms;
  regency, compromise and coup are covered by targeted tests.
- Palace events per insider life: 5.1.
- Rumour truth by source: drunk constable 0.80, storyteller 0.23, market rival 0.27.
