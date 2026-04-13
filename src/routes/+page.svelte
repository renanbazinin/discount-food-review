<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { loadCatalog, type LoadedCatalog } from '$lib/catalog/load';
  import { ratingsStore } from '$lib/stores/http-ratings-store';
  import type { Dish, MyRating, RatingAggregate } from '$lib/types';
  import StarSelector from '$lib/ui/StarSelector.svelte';
  import RatingRow from '$lib/ui/RatingRow.svelte';

  let catalog = $state<LoadedCatalog | null>(null);
  let aggregates = $state<Map<string, RatingAggregate>>(new Map());
  let mine = $state<Map<string, MyRating>>(new Map());
  let loading = $state(true);
  let error = $state<string | null>(null);
  let openId = $state<string | null>(null);
  let busy = $state(false);

  async function boot() {
    try {
      const [cat, leaderboard, myRatings] = await Promise.all([
        loadCatalog(),
        ratingsStore.getLeaderboard(),
        ratingsStore.getMyRatings()
      ]);
      catalog = cat;
      const aggMap = new Map<string, RatingAggregate>();
      for (const r of leaderboard) aggMap.set(r.dishId, r);
      aggregates = aggMap;
      const mineMap = new Map<string, MyRating>();
      for (const r of myRatings) mineMap.set(r.dishId, r);
      mine = mineMap;
    } catch (e) {
      error = e instanceof Error ? e.message : 'טעינה נכשלה';
    } finally {
      loading = false;
    }
  }

  interface Row {
    dish: Dish;
    agg: RatingAggregate | null;
    myStars: number | null;
  }

  const rows = $derived.by<{ rated: Row[]; unrated: Row[] }>(() => {
    if (!catalog) return { rated: [], unrated: [] };
    const all: Row[] = catalog.allDishes().map((dish) => {
      const agg = aggregates.get(dish.id) ?? null;
      const myStars = mine.get(dish.id)?.stars ?? null;
      return { dish, agg, myStars };
    });
    const rated = all
      .filter((r): r is Row & { agg: RatingAggregate } => r.agg !== null && r.agg.ratingCount > 0)
      .sort((a, b) => {
        if (a.agg.averageStars !== b.agg.averageStars) return b.agg.averageStars - a.agg.averageStars;
        if (a.agg.ratingCount !== b.agg.ratingCount) return b.agg.ratingCount - a.agg.ratingCount;
        return (b.dish.popularity ?? 0) - (a.dish.popularity ?? 0);
      });
    const unrated = all
      .filter((r) => r.agg === null || r.agg.ratingCount === 0)
      .sort((a, b) => (b.dish.popularity ?? 0) - (a.dish.popularity ?? 0));
    return { rated, unrated };
  });

  const heroRow = $derived.by<{ row: Row; label: string } | null>(() => {
    // User has rated something → show their top pick
    if (mine.size > 0 && catalog) {
      const myList = Array.from(mine.values()).sort((a, b) => {
        if (a.stars !== b.stars) return b.stars - a.stars;
        return b.timestamp - a.timestamp;
      });
      const top = myList[0];
      const dish = catalog.getById(top.dishId);
      if (dish) {
        return {
          row: {
            dish,
            agg: aggregates.get(dish.id) ?? null,
            myStars: top.stars
          },
          label: 'המנה האהובה שלך'
        };
      }
    }
    // No user ratings but global leader exists → show it
    if (rows.rated.length > 0) {
      return { row: rows.rated[0], label: 'מה שכולם אוהבים הכי הרבה' };
    }
    return null;
  });

  function toggle(dishId: string) {
    openId = openId === dishId ? null : dishId;
  }

  async function onRate(dishId: string, stars: number) {
    if (busy) return;
    busy = true;
    error = null;

    const prevAgg = new Map(aggregates);
    const prevMine = new Map(mine);

    // Optimistic recomputation
    const nextAgg = new Map(aggregates);
    const existingAgg = nextAgg.get(dishId);
    const priorMyStars = mine.get(dishId)?.stars ?? null;

    if (existingAgg && priorMyStars != null) {
      // Change rating: count unchanged, recompute avg
      const newAvg =
        (existingAgg.averageStars * existingAgg.ratingCount - priorMyStars + stars) /
        existingAgg.ratingCount;
      nextAgg.set(dishId, { ...existingAgg, averageStars: newAvg });
    } else if (existingAgg) {
      // New rating on a dish others have rated
      const newCount = existingAgg.ratingCount + 1;
      const newAvg = (existingAgg.averageStars * existingAgg.ratingCount + stars) / newCount;
      nextAgg.set(dishId, { ...existingAgg, averageStars: newAvg, ratingCount: newCount });
    } else {
      // First-ever rating on this dish
      nextAgg.set(dishId, { dishId, averageStars: stars, ratingCount: 1 });
    }
    aggregates = nextAgg;

    const nextMine = new Map(mine);
    nextMine.set(dishId, { dishId, stars, timestamp: Date.now() });
    mine = nextMine;

    openId = null;

    try {
      const result = await ratingsStore.rate(dishId, stars);
      // Reconcile with server timestamp
      const reconciled = new Map(mine);
      reconciled.set(dishId, result);
      mine = reconciled;
      // Background refresh to pick up anyone else's concurrent writes
      ratingsStore.getLeaderboard().then((leaderboard) => {
        const aggMap = new Map<string, RatingAggregate>();
        for (const r of leaderboard) aggMap.set(r.dishId, r);
        aggregates = aggMap;
      }).catch(() => {});
    } catch (e) {
      aggregates = prevAgg;
      mine = prevMine;
      error = e instanceof Error ? e.message : 'הצבעה נכשלה';
    } finally {
      busy = false;
    }
  }

  async function onClear(dishId: string) {
    if (busy) return;
    busy = true;
    error = null;

    const prevAgg = new Map(aggregates);
    const prevMine = new Map(mine);

    const nextAgg = new Map(aggregates);
    const existingAgg = nextAgg.get(dishId);
    const priorMyStars = mine.get(dishId)?.stars ?? null;

    if (existingAgg && priorMyStars != null) {
      if (existingAgg.ratingCount === 1) {
        nextAgg.delete(dishId);
      } else {
        const newCount = existingAgg.ratingCount - 1;
        const newAvg =
          (existingAgg.averageStars * existingAgg.ratingCount - priorMyStars) / newCount;
        nextAgg.set(dishId, { ...existingAgg, averageStars: newAvg, ratingCount: newCount });
      }
    }
    aggregates = nextAgg;

    const nextMine = new Map(mine);
    nextMine.delete(dishId);
    mine = nextMine;

    openId = null;

    try {
      await ratingsStore.clear(dishId);
    } catch (e) {
      aggregates = prevAgg;
      mine = prevMine;
      error = e instanceof Error ? e.message : 'ניקוי נכשל';
    } finally {
      busy = false;
    }
  }

  onMount(boot);
</script>

<svelte:head>
  <title>דירוג אוכל</title>
</svelte:head>

<main class="px-4 pt-5">
  <header class="mb-5 flex items-center justify-between">
    <h1 class="text-xl font-extrabold tracking-tight text-white">הדירוג של כולם</h1>
    {#if mine.size > 0 && catalog}
      <span class="font-mono text-xs text-white/50">{mine.size} / {catalog.allDishes().length}</span>
    {/if}
  </header>

  {#if error}
    <div class="mb-4 rounded-2xl bg-rose-900/50 px-4 py-3 text-center text-sm text-rose-100" transition:slide>
      {error}
    </div>
  {/if}

  {#if loading}
    <div class="space-y-3">
      <div class="skeleton aspect-[4/3] w-full rounded-3xl"></div>
      {#each [1, 2, 3, 4, 5] as i (i)}
        <div class="skeleton h-[84px] w-full rounded-2xl"></div>
      {/each}
    </div>
  {:else if !catalog}
    <p class="rounded-2xl bg-rose-900/50 p-4 text-center text-sm text-rose-100">
      טעינה נכשלה. רענן את הדף.
    </p>
  {:else if heroRow}
    <!-- hero -->
    <div class="mb-5" in:fade>
      <button
        type="button"
        onclick={() => toggle(heroRow.row.dish.id)}
        class="group relative block w-full overflow-hidden rounded-3xl bg-white/[0.04] text-start shadow-2xl shadow-black/40 ring-2 ring-accent/40 transition active:scale-[0.99]"
      >
        <div class="aspect-[4/3] w-full">
          {#if heroRow.row.dish.image}
            <img src={`/${heroRow.row.dish.image}`} alt="" class="h-full w-full object-cover" />
          {:else}
            <div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent/80 to-rose-900 p-8">
              <span class="text-center text-4xl font-extrabold leading-tight text-white drop-shadow-lg">
                {heroRow.row.dish.name}
              </span>
            </div>
          {/if}
        </div>
        <div class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-5 pt-24">
          <div class="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
            <span>★</span>
            <span>{heroRow.label}</span>
          </div>
          <div class="flex items-end justify-between gap-3">
            <div class="min-w-0 flex-1">
              <h2 class="truncate text-2xl font-extrabold leading-tight text-white">{heroRow.row.dish.name}</h2>
              <p class="truncate text-sm text-white/75">
                {heroRow.row.dish.restaurantName} · ₪{heroRow.row.dish.price}
                {#if heroRow.row.agg && heroRow.row.agg.ratingCount > 0}
                  · {heroRow.row.agg.averageStars.toFixed(1)} ({heroRow.row.agg.ratingCount})
                {/if}
              </p>
            </div>
            {#if heroRow.row.myStars != null}
              <div class="shrink-0 rounded-2xl bg-accent px-4 py-2 text-xl font-extrabold text-ink">
                {heroRow.row.myStars}
              </div>
            {/if}
          </div>
        </div>
      </button>
      {#if openId === heroRow.row.dish.id}
        <div class="mt-3 space-y-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10" transition:slide={{ duration: 180 }}>
          <StarSelector current={heroRow.row.myStars} onSelect={(s) => onRate(heroRow.row.dish.id, s)} />
          {#if heroRow.row.myStars != null}
            <div class="flex justify-center">
              <button
                type="button"
                onclick={() => onClear(heroRow.row.dish.id)}
                class="min-h-[44px] rounded-full bg-rose-900/50 px-4 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-900/70"
              >
                נקה דירוג
              </button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <!-- nothing rated anywhere -->
    <section class="mb-6 flex flex-col items-center gap-3 rounded-3xl bg-white/[0.03] py-10 text-center ring-1 ring-white/10" in:fade>
      <svg width="80" height="80" viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="bowl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#ff5a3c" />
            <stop offset="1" stop-color="#b93a22" />
          </linearGradient>
        </defs>
        <path d="M22 62 Q60 46 98 62 L90 92 Q60 102 30 92 Z" fill="url(#bowl)" opacity="0.85" />
        <path d="M48 34 Q52 44 46 54" stroke="#f7f3ec" stroke-width="3" stroke-linecap="round" opacity="0.7" fill="none" />
        <path d="M60 28 Q64 40 58 52" stroke="#f7f3ec" stroke-width="3" stroke-linecap="round" opacity="0.7" fill="none" />
        <path d="M72 34 Q76 44 70 54" stroke="#f7f3ec" stroke-width="3" stroke-linecap="round" opacity="0.7" fill="none" />
      </svg>
      <div>
        <p class="text-xl font-extrabold text-cream">עדיין אין דירוגים</p>
        <p class="mt-1 text-sm text-white/60">היכנס לטאב "דרג" והתחל לדרג מנות.</p>
      </div>
    </section>
  {/if}

  {#if !loading && catalog}
    <!-- rated leaderboard -->
    {#if rows.rated.length > 0}
      <ol class="space-y-2.5">
        {#each rows.rated as row, i (row.dish.id)}
          <li>
            <RatingRow
              rank={i + 1}
              dish={row.dish}
              averageStars={row.agg?.averageStars ?? 0}
              ratingCount={row.agg?.ratingCount ?? 0}
              myStars={row.myStars}
              onTap={() => toggle(row.dish.id)}
            />
            {#if openId === row.dish.id}
              <div class="mt-2 space-y-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10" transition:slide={{ duration: 180 }}>
                <StarSelector current={row.myStars} onSelect={(s) => onRate(row.dish.id, s)} />
                {#if row.myStars != null}
                  <div class="flex justify-center">
                    <button
                      type="button"
                      onclick={() => onClear(row.dish.id)}
                      class="min-h-[44px] rounded-full bg-rose-900/50 px-4 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-900/70"
                    >
                      נקה דירוג
                    </button>
                  </div>
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      </ol>
    {/if}

    {#if rows.unrated.length > 0}
      <div class="my-7 flex items-center gap-3 text-xs text-white/40">
        <div class="h-px flex-1 bg-white/10"></div>
        <span>מנות שעדיין לא דורגו · {rows.unrated.length}</span>
        <div class="h-px flex-1 bg-white/10"></div>
      </div>
      <ol class="space-y-2.5">
        {#each rows.unrated as row (row.dish.id)}
          <li>
            <RatingRow
              rank={null}
              dish={row.dish}
              averageStars={0}
              ratingCount={0}
              myStars={row.myStars}
              muted
              onTap={() => toggle(row.dish.id)}
            />
            {#if openId === row.dish.id}
              <div class="mt-2 space-y-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10" transition:slide={{ duration: 180 }}>
                <StarSelector current={row.myStars} onSelect={(s) => onRate(row.dish.id, s)} />
                {#if row.myStars != null}
                  <div class="flex justify-center">
                    <button
                      type="button"
                      onclick={() => onClear(row.dish.id)}
                      class="min-h-[44px] rounded-full bg-rose-900/50 px-4 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-900/70"
                    >
                      נקה דירוג
                    </button>
                  </div>
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      </ol>
    {/if}
  {/if}
</main>
