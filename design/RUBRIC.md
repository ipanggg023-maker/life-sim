# Murim rubric — status after groups 1–4 (2026-10-22)

Scored against `MURIM_EXPANSION.md` §19. Evidence comes from automated simulation (`src/engine/murim15.test.ts`,
`balance.test.ts`, `murim12–14.test.ts`) and short browser checks. **No outside playtest has been done yet**, so
none of these scores is final; §19 itself says 10/10 can't be promised and requires playtests before release.

| Category | Weight | Score | Evidence | What would raise it |
|---|---|---|---|---|
| Core loop | 15% | 7 | Yearly plan + time budget (adult 5 units, long trips 2) + events from real conditions; 62 distinct events per random life, no single event above ~9% of a life's events | Playtest for pacing in the 30–60 age band; "repeat last year" fast path |
| NPC / relationships | 15% | 7 | 8 relationship axes, memories, values/fear/limit/secret, loyal NPCs never betray, news reaches NPCs by region and they react by their values | Off-screen NPC lives (marriages, deaths, rivalries among NPCs) |
| Choices / consequences | 15% | 7 | Trade-offs with mixed effects, heat → wanted → trial, rumours that can be traps, wrong accusations cost alignment | Longer delayed consequences (10+ years) |
| Generations / chronicle | 15% | 7 | Lineage (up to 8 ancestors) on the family tree, legends carried across eras, founded sects become factions, feuds and debts inherited | Court/dynasty succession across generations |
| Balance | 10% | 8 | Shown % = used % (exact, tested); win rate within 5 points of shown across 3,600+ rolls; careful bot median age ~80, random ~53; peak realm ~4% | Per-career income table review |
| Content | 10% | 7 | 19 causes of death in 80 random lives; 23 ribbons, 6+ appear naturally | More calm/slice-of-life years for 40+ |
| UI / UX | 8% | 7 | Mobile layout, log filters, tap-a-name, family/lineage tree, onboarding, ribbon at death | Real phone playtest; accessibility pass |
| Stability | 7% | 8 | `validateLife` after every simulated year in 11 edge setups (disabled child, rich, poor with debt, early murder, lifelong merchant/healer, many kids, no heir, destroyed sect, plague); save/load mid-event; repair on load; save version + legacy mode | Migration tests for future schema bumps |
| Performance | 5% | 9 | Worst save ~42 KB after a full life; ~0.8 ms per simulated year | — |

Release bar from §19 (every category ≥ 7, core four ≥ 8, real playtests): **not met yet** — the core four sit at 7
and there has been no playtest with different player types.

## Measured numbers (reproduce with `npx vitest run src/engine/murim15.test.ts --silent=false`)

- Odds calibration by bucket (shown → won): 0–20% 9.5 → 7.0 · 20–40% 30.8 → 35.4 · 40–60% 51.2 → 48.6 ·
  60–80% 69.2 → 69.0 · 80–100% 92.4 → 91.7.
- Ribbons over 150 random lives: fighter 65, young 28, loner 16, rich 13, common 12, outlaw 6, quiet 6, and a few others.
- Save size worst case ~42 KB; age-up ~0.76 ms per year.
