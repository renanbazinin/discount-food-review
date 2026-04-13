## 1. Simplify hero selection

- [x] 1.1 In `src/routes/+page.svelte`, replace the `heroRow` `$derived.by` block with a one-liner that returns `rows.rated[0] ?? null` (typed as `Row | null`)
- [x] 1.2 Delete the now-unused label strings ("המנה האהובה שלך", "מה שכולם אוהבים הכי הרבה") from the template
- [x] 1.3 Delete the `label` field from the hero text pill; replace the label row with a small `🥇` badge (keeping the existing accent color treatment)
- [x] 1.4 Confirm `heroRow` is `null` only when there are zero rated dishes; the `{:else if heroRow}` branch is unchanged structurally

## 2. Deduplicate the rated list

- [x] 2.1 In the `{#each rows.rated as row, i (row.dish.id)}` loop, skip the first entry when a hero is rendered — iterate `rows.rated.slice(1)` (or guard per-iteration) so the hero dish does not appear twice
- [x] 2.2 Offset the `rank` prop passed to `RatingRow` by `+1` so the first row in the list is still labeled `2` (since the hero is rank 1) — verify this matches with the medal logic (🥈 at rank 2, 🥉 at rank 3)
- [x] 2.3 Confirm no empty `<ol>` is rendered when only one dish is rated (hero only, list empty)

## 3. Verification

- [x] 3.1 Type check passes: `npm run check` with 0 errors and 0 warnings
- [x] 3.2 Production build passes: `npm run build` completes successfully
- [ ] 3.3 Manual: with zero rated dishes, the existing empty state renders (unchanged)
- [ ] 3.4 Manual: with one rated dish, hero shows it with a 🥇 badge and no list below
- [ ] 3.5 Manual: with three rated dishes, hero = #1, list = #2 (🥈) and #3 (🥉), no duplication
- [ ] 3.6 Manual: the user's personal top pick no longer appears as the hero unless it is also the global #1
- [ ] 3.7 Manual: rating or clearing a dish still re-sorts correctly and the hero tracks the new #1
