# Fantasy systems update (2026-11-04)

The user asked for a rework of most game systems, with balance and QoL. This is not a UI change: keep the current astral look.
Decided: rework all four weak systems, one release each, pushing after each one. Difficulty stays about where it is
(careful players live to ~86, random ones to ~50); only death spikes get fixed.

## Bot survey before the update (50 lives per bot)
| bot | median age | gold at 30 | gold at 50 | married | kids |
|---|---|---|---|---|---|
| idle (popups only, no job) | 72 | −203 | −585 | 16/50 | 0 |
| active (job, every activity) | 86 | 569 | 2,928 | 44/50 | 1.9 |
| random | 50 | 336 | 2,735 | 30/50 | 0.9 |

- Trade (ft_trade) is worth ~2× any other activity. Its capital grows +15 gold per trade with no ceiling, so it snowballs.
- Debt has almost no bite: negative gold only costs −6 happiness a year.
- By 50 an active player can afford every big purchase in the game (order 300, kingdom 500, best home).
- Most jobs end at level 1–3. Bodies and magic climb steadily. p75 lifespan is 110, so old age is long and empty.
- Random players' top killer is dragons (14/50).

## Release 1 — Money: earn less, buy big
1. **Income tuning**
   - Trade: capital cap 120 + 8 per trade, never above 400. Each trade in a row shrinks the margin by 3 points (min 10%), and a year off resets it.
   - Other big earners (contracts, beasts) are checked against the same target.
2. **Debt that matters**
   - Negative gold turns into debt at 10% a year.
   - Creditors come: pay, sell an asset or home tier, work it off, or flee the city.
   - Very large debt risks debtors' prison.
   - A debt-free year is a relief moment.
3. **Big things worth saving for**, each with a price, yearly upkeep, a yearly perk, and decay if the upkeep goes unpaid:
   - manor (คฤหาสน์)
   - castle (ปราสาท)
   - private airship (เรือเหาะ)
   - dragon stable (คอกมังกร)
   - bought noble title (บรรดาศักดิ์)
   - commissioned legendary gear (อาวุธสั่งตี)
   - a library or tower for mages
4. **Heirlooms:** estates and titles pass to the next life in the same world as a legacy (wired fully in the Family release).
5. **QoL**
   - A yearly ledger in the Career tab: salary, assets, living cost, upkeep, interest, net.
   - Upkeep and "can you afford it" shown before buying.
   - A warning chip when next year will go negative.
6. **Balance targets**
   - Active player at 50: about 900–1,800 gold after buying, with 1–2 big things owned. A castle is rare.
   - Idle player: debt hurts but is recoverable.
   - Careful and random lifespans stay as they are.

## Release 2 — Careers and work (built)
Measured first: when a player keeps one job, 93% reached level 5 in ~13 years, so the problem was a flat automatic climb, not a slow one.
Built: skill gates for levels 3 and 4 (body rank for fighting jobs, magic rank for magic jobs, the key stat for the rest), a master exam for level 5,
a once-per-life legacy choice (apprentice, own hall, write the manual), retirement age by race with a work-five-more-years option,
pensions of 10/25/40/50% by level, and returning to an old job starts one level below your best.
Result (bots who work hard): 57% reach level 5 and 68% level 4 or higher.

### Original outline
- Clear ladders: real promotion goals per level instead of just performance ≥ 80.
- Career milestones and signature events at levels 3 and 5.
- Retirement and pensions for fantasy jobs.
- Switching jobs keeps some experience.
- Target: an active player regularly reaches level 4–5 in one career.

## Release 3 — Power and fights (built)
Measured first: a reckless power seeker died at a median age of 34 (26/60 burned by dragons); a careful one lived to 76 with 5/60 fight deaths.
Built:
- a training focus (steady / hard +40% with injury risk / with a teacher +25% and easier breakthroughs)
- a non-lethal arena ladder against the kingdom's ten best living fighters, with a champion title and challengers
- a warning step before any dragon fight or egg theft with survival under 70%
- the odds breakdown now shows each source of fighting power (skill, gear, style, spells, injuries)

Result: reckless fight deaths 40 → 22 of 60 (dragons 26 → 12); careful median lifespan 76 → 79.

### Original outline
- Training with diminishing returns per year and a choice of focus.
- Rival and duel ladders.
- Fight outcomes that use gear, styles and spells visibly.
- Fix the dragon death spike for reckless players: a warning beat before lethal dragon fights.
- Rank spread checked by bots.

## Release 4 — Family and old age (outline)
- Children grow with your choices: teach, apprentice, inherit.
- Heirs carry estates, titles and gear into the next life.
- Old-age content: mentor, write memoirs, last journeys, passing the sword.
- Lifespan for long-lived races feels purposeful rather than empty.
