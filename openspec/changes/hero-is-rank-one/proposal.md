## Why

The current home-screen hero has two modes:

1. If the user has any ratings → show *their* top-rated dish labeled "המנה האהובה שלך".
2. Otherwise → show the global #1 labeled "מה שכולם אוהבים הכי הרבה".

The problem: the user's personal top is almost always also a high-ranked row in the leaderboard immediately below the hero, so after a handful of ratings the same dish appears **twice** on the same screen — once as a hero and once as row 🥇 (or close to it). The "favorite meal" framing also conflicts with the app's core value prop, which is *the shared ranking*, not a personal trophy.

Simplifying: the hero is always the global rank-1 dish, and that dish is **removed** from the list below so there is exactly one representation of every ranked dish. The hero *is* rank 1.

## What Changes

- **Hero selection**: always the first entry in the computed `rows.rated` array (the global leaderboard sorted by `averageStars` desc). No personal-favorite branch.
- **Hero label**: removed entirely. No "המנה האהובה שלך", no "מה שכולם אוהבים". The gold medal `🥇` replaces the label in the top-left of the text pill to convey "this is rank 1" without needing prose.
- **Deduplication**: the rated list below the hero skips the dish being shown as the hero (start rendering from index 1). The ranking numbers for the remaining rows still start at `2`, `3`, `4`, …  so the list reads as a natural continuation of the hero.
- **Empty states**:
  - No rated dishes yet → keep the existing "עדיין אין דירוגים" empty block (unchanged).
  - Exactly one rated dish → that dish is the hero, the rated list below is empty (no header row needed since the divider already exists only when the unrated list is non-empty).
- **The `heroRow` derived value is simplified** to a one-liner: `rows.rated[0] ?? null`. The `mine.size > 0` branch is deleted.
- **No changes** to `/rate`, the API, the surprise-me flow, the rating sheet, or the shimmer.

## Capabilities

### Modified Capabilities

- `star-rating`: home screen hero now always represents the global #1 rated dish and is deduplicated from the rated list below. Personal-favorite branch is removed.

## Impact

- **Affected files**: `src/routes/+page.svelte` only — simplify `heroRow` derivation, drop the label element, slice the rated list from index 1 when the hero exists, adjust the rank badge numbering offset.
- **No new files, no new dependencies, no API changes, no type changes.**
- **Net code delta is negative** (remove the `mine`-based branch and the label prop).
- **Minimalism check**: strictly removes a decision branch and a duplicated dish. Fits the "every pixel earns its place" framing.
