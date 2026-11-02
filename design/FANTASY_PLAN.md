# Fantasy World Plan

Status: proposal for approval. Nothing here is built. Source: the user's brief of 2026-11-02.

Goal: a fantasy life simulator where every new character lives a different life, in one world that keeps existing around them. Grand, fun and colorful: dragons, legendary weapons, schools of sword and magic, adventurer guilds, and an ordinary life if the player wants one.

It keeps murim's format (yearly turns, scenes with choices and success %, activity budget, tabs) and none of murim's content. Setting has no Thai folklore. Player-facing game text stays in Thai, as it is today.

## Decisions made in this plan

### World scope: one big world, with other realms as deep layers (A first, B later)

Build one large world: **Aetheria** (working name), with continents, kingdoms, races, schools and dungeons. The Demon Realm, Dragon Realm and Divine Plane exist as rare late-game places reached through gates, not as equal starting worlds.

Why: separate worlds multiply content and split the simulation. A single world makes legends, wars and NPCs connect. The data model gets a `realm` field from day one, so option B can grow later without a rewrite.

### Death: two ways to continue

At death the player chooses:

1. **Continue the family:** play an heir, who inherits property, debts, feuds and unfinished goals.
2. **New stranger:** a fully random, unrelated character born decades later (about 20 to 60 years) in the same world. The old character survives only as what the world remembers: stories, statues, a kingdom they founded, an order still running, a legend that grows or gets distorted.

No heir: option 2 is always available. Resurrection and lichdom are rare in-world paths with real costs, not a menu option.

### Rewind: one simple rule with two levels

Everyone can rewind a little. A rare few can do it for real.

- **Fate's Mercy (everyone):** if you die before age 30, you may rewind once per life to your last Turning Point. This covers the "I just started and died" case.
- **Turning Points:** automatic saves at ages 6, 12, 16, 20, 30, 45, 60 and at major moments such as joining a school.
- **The Fate Thread (rare):** a birth talent, or an artifact found in play, that allows extra rewinds at any age. Each use needs a charge.
- **The price:** every rewind leaves one permanent **Scar of Fate**, a small visible flaw or an NPC who senses something is wrong. Rewinds keep your memory as journal notes, not your stats.

The player sees one button and one number. The world rewinds with you, so nothing has to reconcile two timelines. The engine already has yearly snapshots and regression, so this is mostly reuse.

### Adventurer guild

Added as a main route, available from youth to old age: ranks from Iron to Mythril, a contract board, parties of named NPCs, and dungeons. It is the bright, colorful everyday heart of the world, and the easiest way into adventure for someone with no school or noble birth.

## The core idea: three layers

```
PLAYER LIFE    one character, played in full detail, yearly
     |  reads and changes
WORLD          persists across all characters, ticks every year
     |  remembers
LEGACY         legends, soul progress, house history
```

Every system plugs into those layers. Emergent stories come from their interaction, not from scripted quests: a kingdom falls in the World layer, your family loses its land in the Life layer, and your heir inherits the grudge through the Legacy layer.

## Major systems

| System | What it does | Connects to |
|---|---|---|
| Birth | Rolls race, family, kingdom, class, talents, magic potential, blessings and curses. Fully random, or customize some fields | Everything |
| Five power tracks | Body, Magic, Technique, Knowledge and Standing, each with ranks. Not one level. Wealth, gear and reputation count too | Combat, jobs, schools |
| Realms | Named ranks with chosen breakthroughs. Each unlocks new verbs and status, not just bigger numbers | Tracks, events |
| Magic | Potential (0 to 5) is innate. Five ways to cast: Wand, Chant, Circle, Innate, Runes. Anyone can use a wand; potential sets how far it goes | Combat, schools |
| Wands | Items with material, affinity, quality, history. Bought, inherited, crafted, found or won | Items, legends |
| Combat | Reuses the duel engine, plus a style built from weapon, school and spells. Enemies have weaknesses, so no single best spell | Tracks, creatures |
| Schools | Data-driven institutions: specialty, exam, politics, rivals, secrets. Failing leaves other routes | NPCs, kingdoms |
| Careers and guilds | Adventurer, merchant, smith, farmer, scholar, noble, ruler and more. Several per life | Economy, reputation |
| Legendary artifacts | Each is a world entity with a holder, location, clues, conditions and consequences. NPCs hunt them too | World, investigation |
| Dragons and creatures | Named beings with lineage, territory, temperament. Hunt, flee, bargain, ride, raise, learn | World, magic |
| Kingdoms and factions | Rulers, wars, alliances, succession, economy, disasters | Everything |
| Relationships | Reuses murim's multi-axis feelings and memories rather than one meter | NPCs, family |
| Reputation and law | Fame and infamy per region, with laws that react | Choice, NPCs |
| Chronicle and legends | Records real deeds, then retells them, sometimes exaggerated | Legacy, new lives |
| Mysteries | Fixed secrets with clue chains that span lives | Journal, exploration |

## Architecture

Reused almost as is: event and scene engine, activities and time budget, year hooks, choice odds, save system, snapshots, tab UI, bot testing, fuzz testing.

Three changes are needed:

1. **Extract a world-neutral core.** The engine imports murim directly in about 8 places, and 38 places check for murim. Replace those with a small `WorldModule` interface that each world registers. This protects murim and every future world.
2. **Split the save.** The world lives inside each character's save today, so it dies with them. Fantasy needs a separate `WorldState` save that outlives characters.
3. **Tiered NPCs.** The world cannot simulate everyone in detail:

| Tier | Who | Detail | Count |
|---|---|---|---|
| 1 | Family, friends, rivals | Full person | up to ~40 |
| 2 | Notables: rulers, masters, heroes, dragons | Compact record, yearly tick | ~300 |
| 3 | Populations | Numbers only | per region |

A Tier 2 person becomes Tier 1 when you meet them. That gives the feel of a full world at low cost.

```
src/content/fantasy/
  world/      kingdoms, factions, realms, world tick, new-life fast-forward
  people/     races, birth, notable NPCs, relationships
  power/      tracks, realms, magic, wands, combat styles
  places/     schools, guilds, dungeons
  legends/    artifacts, dragons, creatures, chronicle, mysteries
  life/       careers, activities, life stages
  story/      event packs (data)
```

## Biggest technical risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Scope | The brief is years of work if built at once | Fixed milestones, data-driven content, the smallest version first |
| Emergence may be dull | A running simulation doesn't guarantee good stories | Measure it, and let the sim create hooks that hand-written scenes use |
| Save size and speed | A persistent world grows forever on phones | Tiers, compressing old history, budgets below |
| Rewind with a shared world | Must restore world and life together | Keep few, whole snapshots; rewind only inside the current life |
| Random events feel the same | Long play repeats text | Event text bound to real people, cooldowns, usage logs |
| Rare races explode content | A playable dragon is a different game | Delay them, and design each as its own expansion |
| Power balance | Godlike ceiling vs real challenge | Bots per route, threats that scale, chosen breakthroughs |
| Murim regression | Extracting the core could break it | Murim's 253 tests guard every step |

## How to test the world behaves

- **World-only runs:** simulate 500 years with no player. Kingdoms must rise and fall, rulers change, artifacts change hands, and dragons and notables live and die. Nothing freezes, and no faction wins forever.
- **Determinism:** the same seed gives the same world, so bugs can be reproduced.
- **Legacy check:** a new character must meet traces of the old one: their story, their order, their descendants.
- **Rewind check:** after a rewind the world matches its snapshot exactly, and the Scar appears.
- **Route reach:** bots reach every route, and no route dominates at ages 30, 50 and 70.
- **Variety:** across 1,000 lives, measure how differently they end, and flag events that are overused or never seen.
- **Budgets:** a year runs in under 20 ms, the save stays under 2 MB, and a stress test runs every build.
- **Human playtest:** bots can't judge fun. Each milestone ends with you playing it on a phone.

## Smallest compelling version (Milestone 1)

Proves one thing: a character's life changes the world, and the next character feels it.

- One continent, 3 kingdoms, 3 races (human, elf, dwarf)
- Random birth and a basic customize option
- Body and Magic tracks, 5 realms each
- Wand and Chant magic; sword path with no magic needed
- 3 schools: magic, swordsmanship, and one mixed
- Adventurer guild with ranks, contracts and a party
- 8 careers, relationships, marriage and family
- 1 named dragon and 3 legendary weapons living in the world
- Kingdom tick: war, succession, one disaster type
- Heir or new stranger, with legends carried over
- Fate's Mercy rewind
- Around 150 events to start

## Roadmap

| # | Milestone | Result |
|---|---|---|
| 0 | Core extraction and split saves | Murim still passes; fantasy starts empty |
| 1 | Smallest version | Full life plus legacy loop on a phone |
| 2 | Schools and magic depth | Circles, runes, Innate, tournaments, rival students |
| 3 | Living world | Notable NPCs, factions, economy, law |
| 4 | Legends and dragons | More artifacts, dragon society, riding and eggs |
| 5 | Mysteries and more races | Beastfolk, orcs, clue chains, lost civilizations |
| 6 | Rulers and empires | Founding kingdoms and orders, large wars |
| 7 | Other realms and rare races | Demon and dragon realms, playable dragons and demons, godhood |

Every milestone gets a balance and quality-of-life pass, and ends with something playable.
