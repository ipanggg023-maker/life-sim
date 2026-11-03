# Fantasy huge update: every choice matters

These decisions come from a design interview with the user on 2026-11-04. The work goes one tab at a time. Each tab is its own release: build it, then a balance and QoL pass, then an on-screen check, then ask before pushing.

Order:
1. Shared engine and People
2. Do
3. Career
4. World
5. Power
6. Log

## Shared consequence engine (all four kinds)

### Echoes years later
Choices plant **seeds** that come back 2–20 years later. Examples:
- A beggar you fed returns as an advisor.
- A thief you spared robs your child.

Scope:
- Tag about 150 of the most dramatic existing choices with seeds.
- Write about 150 echo events that pay them off.
- The rest of the game stays as it is.

### Personality from choices
Four axes:
- Mercy ↔ Ruthless
- Honest ↔ Cunning
- Brave ↔ Careful
- Devout ↔ Free

What the axes do:
- **Exclusive choices:** strong traits unlock some options and lock others.
- **Odds:** traits shift success chances where they fit.
- **NPC reactions:** people respond to who you are.
- **Endings:** your epithet, chronicle line and death-screen verdict follow who you became.

How the axes move:
- They drift with every choice.
- They harden with age.
- Rare redemption or fall moments let you swing hard either way.

### People remember
- Fantasy NPCs reuse the murim memory system in engine/npc.ts.
- Feelings: love, trust, respect, fear, debt, grudge, jealousy, loyalty.
- Each NPC keeps their top 10 memories of you.

### World remembers
- A rumor starts in your city.
- Within a year or two it spreads to the kingdom.
- Big rumors reach neighboring kingdoms.
- Rumors fade over about ten years unless you keep feeding them.
- Each city and kingdom shows what it says about you.

### Visibility
- Choices that will matter later show a small "this will be remembered" mark.
- A Fate ledger in the log tab lists the seeds you planted.
- When an echo returns, the log names the old choice.

### Weight
- Big but recoverable: one choice can cost a friend, a job or a fortune, or win a kingdom.
- Only a chain of bad choices, or a clearly deadly gamble, ends a life.

## People tab (first release)
- **Feelings and memories:** open a person to see their strongest two or three feelings as words and their top memories of you. No raw numbers.
- **NPCs live their own lives:** they marry, change jobs, move, fall ill and chase goals. They come to you for help or with news, shaped by how they feel about you.
- **Family drama:**
  - inheritance fights
  - aging parents who need care
  - children's rebellions and life choices
  - sibling rivalry
  - in-laws
  - family secrets
- **Enemies act:** people with deep grudges scheme against you: rumors, sabotage at work, stealing a lover, hired thugs, and at the extreme an assassin.
- **Friends repay:** friends with deep debts come to your rescue.
- **Deeper interactions:** confide, ask a favor, lend or borrow gold, apologize, confront, train together, give gifts by taste, adventure together. Each one writes a memory.
- **Grudges pass to kin:** their children or allies may inherit a grudge against you, and your heir inherits yours. Blood feuds can span generations in the same world.
