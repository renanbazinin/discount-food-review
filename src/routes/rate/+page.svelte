<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly, slide } from 'svelte/transition';
  import { loadCatalog, type LoadedCatalog } from '$lib/catalog/load';
  import { ratingsStore } from '$lib/stores/http-ratings-store';
  import { getOrderedAll } from '$lib/stars/queue';
  import type { Dish, MyRating } from '$lib/types';
  import StarSelector from '$lib/ui/StarSelector.svelte';
  import { dishEmoji, dishGradient } from '$lib/catalog/fallback';

  let catalog = $state<LoadedCatalog | null>(null);
  let mine = $state<MyRating[]>([]);
  let index = $state(0);
  let key = $state(0);
  let loading = $state(true);
  let error = $state<string | null>(null);

  const orderedDishes = $derived<Dish[]>(catalog ? getOrderedAll(catalog) : []);
  const current = $derived<Dish | null>(orderedDishes[index] ?? null);
  const myStars = $derived<number | null>(
    current ? mine.find((r) => r.dishId === current.id)?.stars ?? null : null
  );

  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerTracking = false;
  let dragging = $state(false);
  let dragX = $state(0);
  let snapping = $state(false);

  const SWIPE_THRESHOLD = 80;

  function onCardPointerDown(e: PointerEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('[role="radio"]') || target.closest('button')) return;
    pointerStartX = e.clientX;
    pointerStartY = e.clientY;
    pointerTracking = true;
    dragging = false;
    snapping = false;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  }

  function onCardPointerMove(e: PointerEvent) {
    if (!pointerTracking) return;
    const dx = e.clientX - pointerStartX;
    const dy = e.clientY - pointerStartY;
    if (!dragging) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        pointerTracking = false;
        return;
      }
      dragging = true;
    }
    // Full-circle cycling: both directions always allowed.
    dragX = dx;
  }

  function onCardPointerUp(e: PointerEvent) {
    if (!pointerTracking) return;
    pointerTracking = false;
    const wasDragging = dragging;
    dragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    if (wasDragging && dragX <= -SWIPE_THRESHOLD && current) {
      dragX = 0;
      prev();
    } else if (wasDragging && dragX >= SWIPE_THRESHOLD && current) {
      dragX = 0;
      next();
    } else {
      snapping = true;
      dragX = 0;
      setTimeout(() => {
        snapping = false;
      }, 180);
    }
  }

  function onCardPointerCancel() {
    pointerTracking = false;
    dragging = false;
    snapping = true;
    dragX = 0;
    setTimeout(() => {
      snapping = false;
    }, 180);
  }

  async function boot() {
    try {
      const [cat, myRatings] = await Promise.all([loadCatalog(), ratingsStore.getMyRatings()]);
      catalog = cat;
      mine = myRatings;
      // Start on the first unrated dish if there is one.
      const ordered = getOrderedAll(cat);
      const ratedIds = new Set(myRatings.map((r) => r.dishId));
      const firstUnrated = ordered.findIndex((d) => !ratedIds.has(d.id));
      index = firstUnrated >= 0 ? firstUnrated : 0;
    } catch (e) {
      error = e instanceof Error ? e.message : 'טעינה נכשלה';
    } finally {
      loading = false;
    }
  }

  function next() {
    if (orderedDishes.length === 0) return;
    index = (index + 1) % orderedDishes.length;
    key += 1;
  }

  function prev() {
    if (orderedDishes.length === 0) return;
    index = (index - 1 + orderedDishes.length) % orderedDishes.length;
    key += 1;
  }

  function rate(stars: number) {
    if (!current) return;
    error = null;
    const dishId = current.id;
    const prevEntry = mine.find((r) => r.dishId === dishId) ?? null;
    const entry: MyRating = { dishId, stars, timestamp: Date.now() };
    mine = prevEntry
      ? mine.map((r) => (r.dishId === dishId ? entry : r))
      : [...mine, entry];
    next();
    ratingsStore.rate(dishId, stars).catch((e) => {
      error = e instanceof Error ? e.message : 'שמירה נכשלה';
      mine = prevEntry
        ? mine.map((r) => (r.dishId === dishId ? prevEntry : r))
        : mine.filter((r) => r.dishId !== dishId);
    });
  }

  const progress = $derived.by(() => {
    const total = catalog?.allDishes().length ?? 0;
    return { rated: mine.length, total };
  });

  function handleKey(e: KeyboardEvent) {
    if (!current) return;
    if (e.key >= '1' && e.key <= '9') {
      rate(parseInt(e.key, 10));
    } else if (e.key === '0') {
      rate(10);
    } else if (e.key === ' ' || e.key === 'ArrowRight') {
      e.preventDefault();
      next();
    } else if (e.key === 'Backspace' || e.key === 'ArrowLeft') {
      e.preventDefault();
      prev();
    }
  }

  onMount(() => {
    boot();
    const fine = window.matchMedia('(pointer: fine)').matches;
    if (fine) window.addEventListener('keydown', handleKey);
    return () => {
      if (fine) window.removeEventListener('keydown', handleKey);
    };
  });
</script>

<svelte:head>
  <title>דירוג אוכל — דרג</title>
</svelte:head>

<main class="flex min-h-[calc(100dvh-120px)] flex-col px-4 pt-5">
  <header class="mb-4 flex items-center justify-center">
    <span class="font-mono text-xs text-white/50">{progress.rated} / {progress.total}</span>
  </header>

  {#if error}
    <div class="mb-4 rounded-2xl bg-rose-900/50 px-4 py-3 text-center text-sm text-rose-100" transition:slide>
      {error}
    </div>
  {/if}

  {#if loading || !catalog || !current}
    <div class="skeleton flex-1 rounded-3xl"></div>
  {:else}
    {#key key}
      <section class="flex flex-1 min-h-0 flex-col items-center justify-center gap-4" in:fade={{ duration: 220 }}>
        <div
          class="relative aspect-[4/5] max-h-[min(60vh,520px)] w-full select-none overflow-hidden rounded-3xl shadow-2xl shadow-black/40"
          style="transform: translate3d({dragX}px, 0, 0); transition: {snapping ? 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none'}; will-change: transform; touch-action: pan-y; -webkit-user-select: none; -webkit-user-drag: none;"
          in:fly={{ y: 20, duration: 260 }}
          onpointerdown={onCardPointerDown}
          onpointermove={onCardPointerMove}
          onpointerup={onCardPointerUp}
          onpointercancel={onCardPointerCancel}
          role="presentation"
        >
          {#if current.image}
            <img
              src={`/${current.image}`}
              alt=""
              draggable="false"
              class="pointer-events-none h-full w-full select-none object-cover"
            />
          {:else}
            {@const g = dishGradient(current)}
            <div
              class="flex h-full w-full flex-col items-center justify-center gap-4 p-8"
              style="background: linear-gradient(135deg, {g.from}, {g.to});"
            >
              <span class="text-7xl drop-shadow-lg" aria-hidden="true">{dishEmoji(current)}</span>
              <span class="text-center text-3xl font-extrabold leading-tight text-white drop-shadow-lg">
                {current.name}
              </span>
            </div>
          {/if}
          <div class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-4 pt-20">
            <div class="flex items-end justify-between gap-3">
              <div class="min-w-0 flex-1">
                <h2 class="truncate text-xl font-extrabold leading-tight text-white">{current.name}</h2>
                <p class="truncate text-sm text-white/70">{current.restaurantName}</p>
              </div>
              <div class="shrink-0 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white backdrop-blur-sm">
                ₪{current.price}
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <p class="text-center text-sm text-white/60">מה דעתך?</p>
          <StarSelector current={myStars} onSelect={rate} />
        </div>
      </section>
    {/key}

    <footer class="mt-4 flex flex-col items-center gap-2 text-sm">
      <div class="flex items-center justify-center gap-3">
        <button
          type="button"
          onclick={prev}
          class="min-h-[44px] rounded-full bg-white/5 px-5 py-2 font-semibold text-white/70 transition hover:bg-white/10"
        >
          חזור אחורה
        </button>
        <button
          type="button"
          onclick={next}
          class="min-h-[44px] rounded-full bg-white/10 px-5 py-2 font-semibold text-cream transition hover:bg-white/15"
        >
          אולי אחר כך
        </button>
      </div>
      <div class="flex w-full justify-between px-4 text-xs text-white/40">
        
        <span>→חזור</span>
        <span>דלג←</span>
      </div>
    </footer>
  {/if}
</main>
