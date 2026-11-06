# Different choices, wands, less repetition, easy tabs (R22–R25)

Grilled 2026-11-06. Each release is tested, given a balance pass, checked on screen, and pushed only after the user's OK.

## Release 22: three different approaches
- About 340 of the third choices added in R19 are "variants": they run an existing choice and add a small twist, so they feel the same. Rewrite them into real paths with their own outcomes.
- Rule for every scene: the three choices are three different kinds of approach, for example bold or risky, careful or clever, and kind or giving something up. Each has its own result.
- Where a scene's choice sets state the story needs (path picks, rites, multi-scene main stories, "not ready" branches, holder showdowns), the new choice still sets that state, but through its own route and outcome rather than by copying the original.
- Test: no third choice is a plain copy, and every scene still has 3+ choices.

## Release 23: wands that choose you
- About 24 wands from wood × core pairs (about 8 woods and 3–4 cores). Each pair has its own name and a perk: an element it suits, a spell type it boosts, and a temperament (loyal, wild and so on), plus quality tiers. Names go to the user as a draft list first.
- The first time you get a wand (your first wand shop visit, or at school), it is an event: wands react to you, the wrong ones misfire, and one chooses you. It reads your magic stars, the element your magic leans to, and your personality.
- Later you can seek a better wand, and that wand also has to accept you.

## Release 24: variety
- Locks kept at a set age (user's pick): the star reading at 6, the school letter at 11, the race coming-of-age rite, and the path choices at 14 and 17. Everything else spreads across a broad life stage.
- Main stories: a new batch of hand-written main stories, plus more stories assembled from parts. A soul sees an old main story again only after it has seen most of the pool.
- System popups (tax, debt collectors, omens, plague, signature technique and similar): routine cases resolve quietly as a line in the year log. A popup appears only the first time, or when the choice really matters (you can't pay, someone threatens you).
- Story chains (school rival, guild, court, crises): the next part comes after a random gap, may not come at all, and can go a different way depending on your choices and life (moved city, changed job, made peace).
- Small moments: a bigger pool, never repeated within one life, weighted by your situation (job, city, race, family).

## Release 25: easy tabs (mockup first)
- Pain points (all chosen): too many buttons, too much text, unclear what's useful, too much scrolling.
- Tabs: Do, People, Power and World, Record (Soul) and Career.
- Mockup ideas to include: a short 3–5 line summary on top with details in closed folds; the 3 most useful actions first, with what they give, and the rest behind a "more" fold; short labels with small icons and the effect as a tag (for example +money, risky).
- Keep the ornate astral look. Show a clickable mockup for approval before building.

## Release 22 built (2026-11-06)
- All 482 variant third choices (runs of an existing choice plus a twist) are gone, and the variant type was removed so they can't come back.
  - 284 in multi-choice scenes were rewritten as their own approach: a different stat check from the original, a label of its own, and their own success and failure text and effects. Behind the scenes the original choice still runs silently, so story state and the next scene still work, but only the new text is shown.
  - The 32 masterpiece "not ready" branches became "ask someone who succeeded for advice first" (smarts), and the 8 race-legend honours became "give the honour to the people who helped you" (looks).
  - 198 in one-choice reward scenes became distinct actions with only their own text (no odds).
- A new choice that runs a paid original shows the same gold cost on its label.
- Tests: no scene repeats a choice label (conditionally shown choices aside); a new choice still graduates you, still moves a main story to its next scene, and has its own failure text.
- Balance: the share dying before 60 is 63% and 61% on the two baseline seed sets (was 58% and 60%), because the third choice now carries real risk instead of being a safe copy.
- Checked on screen: first word, baby bird, shared snack and wolf-cub popups show three distinct approaches, the new ones with their own odds and outcomes.
