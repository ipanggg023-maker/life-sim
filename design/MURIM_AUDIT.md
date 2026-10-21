# Murim Audit — Phase 0 (2026-10-21)

Baseline before the murim overhaul. Status: **Existing** (works, keep), **Partial** (works, needs rework per MURIM_PLAN),
**Missing**, **Broken**, **Verify**. Codebase: React 19 + TypeScript + Vite, state = one `Life` object (src/engine/types.ts:147)
saved to IndexedDB (src/save.ts) + optional Supabase cloud sync (src/cloud.ts). 50 vitest tests (src/engine/*.test.ts).

## Core loop
| System | Where | Status | Notes |
|---|---|---|---|
| Year tick | `ageUp` src/engine/game.ts:456, `yearHooks` :454 | Partial | One tap = +1 year, 0–N random events via `pickEvents` (src/engine/events.ts). No "main plan for the year", no result card, no skip/closed-door loop with early stop (§18.2). |
| Events | registry src/engine/events.ts, `GameEvent` with `when/weight/maxTimes/forced/scenes` | Existing | Good base for the new event schema. Has `notIn` world exclusion since Phase 0. Needs: cooldowns, callback/memory hooks, pros/cons per choice. |
| Choice odds | `check` / `odds` / `survival`, `choiceChance` game.ts:538, UI src/ui/EventModal.tsx | Partial | Exact % always shown; no "unknown → ต่ำ/กลาง/สูง" (§18.6); no pros/cons lines. |
| Activities | src/engine/activities.ts:22, shared `free_*` (src/content/shared/freedom.ts) | Partial | Menu exists; not split into training modes / side activities with time budget. |
| Random | seeded `rng` in Life (src/engine/rng.ts) | Existing | Deterministic per life — good for sims. |

## Character
| System | Where | Status | Notes |
|---|---|---|---|
| Base stats | `Stats` types.ts:29 (health, happiness, smarts, looks, luck) | Existing | Keep. |
| Murim power | `Power` types.ts:132 via hunter engine (`rank` 0–8, `level`, `exp`) src/content/hunter/power.ts | Partial | Game-like level/EXP. Needs internal-energy years, comprehension, realms with lifespan (§4). |
| Talents | src/content/talents.ts + talentsMore.ts | Partial | Reframe as innate traits; drop soul-lock. |
| Body / injuries | only `stats.health` + `hurt()` m17core.ts:429 | **Missing** | No body parts, no permanent injuries, no disabilities (§15). |
| Techniques | class skills (`skillsOf` power.ts:283, src/content/skills.ts) | Partial | Skills are class unlocks, not collectible manuals with mastery/compatibility (§8.1, §18.5). |
| Goals / fears | — | **Missing** | §18.1. |

## People
| System | Where | Status | Notes |
|---|---|---|---|
| Person | types.ts:44 (`bond` 0–100, `tags`) | Partial | Single affinity axis; needs multi-axis relations, memories, goals, autonomy (§18.3–18.4). |
| Family / marriage / kids | game.ts propose/tryForBaby/giveGift/confess/cutTies, src/content/shared/relations.ts | Partial | One spouse only; no household, no matchmaker, no filial piety/mourning. |
| Master / disciple / sworn | flags only (e.g. `beggarMaster`, chains MASTER src/content/shared/chains.ts) | **Missing** as relations | §5. |
| Rival / nemesis | src/content/shared/nemesis.ts | Existing | Regressor variant now disabled in murim. |
| Relation names | `relationLabel` src/engine/util.ts | Existing | Murim names since Phase 0 (ท่านพ่อ, ฮูหยิน, สหาย…). |

## World & factions
| System | Where | Status | Notes |
|---|---|---|---|
| Rankings & epithets | m17core.ts:49–154 (`initRanking`, `EPITHETS`, `takePlace`) | Existing | Reuse for Ten Greats / Young Dragons. |
| Alignment (ธรรมะ–มาร) | m17core.ts:220–241, events m17align.ts | Existing | Keep. |
| Favor / grudge ledger | m17core.ts:272–298, m17ledger.ts | Existing | Becomes part of NPC memory (§18.3). |
| Own sect | m17core.ts:327–367, m17sect.ts | Partial | Founding + changes; no budget/disciples/buildings (§8.4, §18.8). |
| Sects & factions as world actors | names in events only | **Missing** | No faction state, strength, relations over time. |
| Economy | `money` number, taels display (src/content/worlds.ts) | Partial | No prices/eras/sources-sinks; business system is generic (src/content/shared/business.ts). |
| Emperor / court / inner palace | — | **Missing** | §18.8 (court world exists but is a different setting). |
| Eras / crises | world facts (src/content/hunter/worldFacts.ts) `cataclysmAge` cult war | Partial | One fixed cataclysm; needs pressure-driven eras (§18.8). |
| Heavenly Demon / Demon Lord / Immortals | cult events (m17align), tribulation in murim events.ts | Partial | Flavor only. |
| Rumors / investigation | — | **Missing** | §18.8. |

## Generations
| System | Where | Status | Notes |
|---|---|---|---|
| Play as child | `heirsOf`/`buildHeir` src/engine/soul.ts:149–155 | Existing | Keep; extend inheritance rules (§18.9). |
| New person later | `nextEraOptions` soul.ts:230, `Legacy` types.ts:217, murim LEGACY events | Partial | Text reframed (no "past self"). Needs Chronicle tab + persistent world (§9). |
| Regression / cross-world / soul shop | soul.ts:76–131, DeathScreen | Disabled in murim | Phase 0: hidden for murim and for saves of locked worlds. |

## Presentation
| System | Status | Notes |
|---|---|---|
| "[ระบบ]" windows | Disabled in murim | `log()` maps system→good for realistic worlds; event modal drops blue window; 3 texts rewritten. |
| Reader comments / manhwa cover | Disabled in murim | `maybeComment` skips; death screen hides cover/comments. |
| World select | Changed | Only murim open (`OPEN_WORLDS` src/content/worlds.ts); others "🔒 เร็วๆ นี้". |

## Phase 0 changes (this commit)
- `OPEN_WORLDS`, `isRealistic` (src/content/worlds.ts).
- Event `notIn` + registration exclusion of system quest, past-life, sponsors, dual class in murim (src/engine/events.ts, src/content/shared/index.ts).
- Death screen: realistic ending (heir / next era / new life), no shop/regression/cross-world (src/ui/DeathScreen.tsx).
- Soul tab → "บันทึก" in murim without soul points/memories/shelf (src/ui/tabs/SoulTab.tsx, MainScreen, App).
- Murim relation names (src/engine/util.ts).

## Known risks for next phases
- Old murim saves: new systems will need a save-version check (§18.11 #7).
- Hunter engine is shared by all worlds — murim's new realm/technique system should live in its own module, not patch power.ts.
- Balance tests (src/engine/sim.test.ts, m17*.test) encode current murim numbers; they will be rewritten alongside the new systems.
