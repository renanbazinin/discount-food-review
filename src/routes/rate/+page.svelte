<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly, slide } from 'svelte/transition';
  import { loadCatalog, type LoadedCatalog } from '$lib/catalog/load';
  import { ratingsStore } from '$lib/stores/http-ratings-store';
  import { getNext } from '$lib/stars/queue';
  import type { Dish, MyRating } from '$lib/types';
  import StarSelector from '$lib/ui/StarSelector.svelte';
  import { dishEmoji, dishGradient } from '$lib/catalog/fallback';

  let catalog = $state<LoadedCatalog | null>(null);
  let mine = $state<MyRating[]>([]);
  let current = $state<Dish | null>(null);
  let key = $state(0);
  let loading = $state(true);
  let error = $state<string | null>(null);

  const skipped = new Set<string>();
  const undoStack: string[] = [];

  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerTracking = false;
  let dragging = $state(false);
  let dragX = $state(0);
  let snapping = $state(false);
  let hintSwipeUndo = $state(false);

  const SWIPE_THRESHOLD = 80;

  function onCardPointerDown(e: PointerEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('[role="radio"]') || target.closest('button')) return;
    if (undoStack.length === 0) return;
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
    // RTL back-gesture: only allow rightward drag
    dragX = Math.max(0, dx);
  }

  function onCardPointerUp(e: PointerEvent) {
    if (!pointerTracking) return;
    pointerTracking = false;
    const wasDragging = dragging;
    dragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    if (wasDragging && dragX >= SWIPE_THRESHOLD && undoStack.length > 0) {
      hintSwipeUndo = true;
      dragX = 0;
      undo();
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
      advance();
    } catch (e) {
      error = e instanceof Error ? e.message : 'טעינה נכשלה';
    } finally {
      loading = false;
    }
  }

  function advance(to?: Dish | null) {
    if (!catalog) return;
    current = to ?? getNext(catalog, mine, skipped);
    key += 1;
  }

  function rate(stars: number) {
    if (!current) return;
    error = null;
    const dishId = current.id;
    const entry: MyRating = { dishId, stars, timestamp: Date.now() };
    mine = [...mine, entry];
    undoStack.push(dishId);
    skipped.delete(dishId);
    advance();
    ratingsStore.rate(dishId, stars).catch((e) => {
      error = e instanceof Error ? e.message : 'שמירה נכשלה';
      mine = mine.filter((r) => r.dishId !== dishId);
      const idx = undoStack.lastIndexOf(dishId);
      if (idx >= 0) undoStack.splice(idx, 1);
    });
  }

  function skip() {
    if (!current) return;
    skipped.add(current.id);
    advance();
  }

  function undo() {
    const dishId = undoStack.pop();
    if (!dishId) return;
    error = null;
    const prev = mine.find((r) => r.dishId === dishId);
    mine = mine.filter((r) => r.dishId !== dishId);
    const dish = catalog?.getById(dishId) ?? null;
    advance(dish);
    ratingsStore.clear(dishId).catch((e) => {
      error = e instanceof Error ? e.message : 'ביטול נכשל';
      if (prev) mine = [...mine, prev];
      undoStack.push(dishId);
    });
  }

  const progress = $derived.by(() => {
    const total = catalog?.allDishes().length ?? 0;
    return { rated: mine.length, total };
  });

  function handleKey(e: KeyboardEvent) {
    if (!current && e.key !== 'Backspace') return;
    if (e.key >= '1' && e.key <= '9') {
      rate(parseInt(e.key, 10));
    } else if (e.key === '0') {
      rate(10);
    } else if (e.key === ' ') {
      e.preventDefault();
      skip();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      undo();
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

  {#if loading || !catalog}
    <div class="skeleton flex-1 rounded-3xl"></div>
  {:else if !current}
    <section class="flex flex-1 flex-col items-center justify-center gap-4 text-center" in:fade>
      <div class="text-6xl">🎉</div>
      <p class="text-2xl font-extrabold text-cream">הכל דורג! יפה מאוד.</p>
      <p class="text-sm text-white/60">כל {progress.total} המנות קיבלו דירוג.</p>
      <a
        href="/"
        class="mt-4 rounded-full bg-accent px-6 py-3 text-sm font-bold text-ink shadow-lg shadow-accent/30 transition hover:brightness-110"
      >
        ראה את הדירוג ←
      </a>
    </section>
  {:else}
    {#key key}
      <section class="flex flex-1 min-h-0 flex-col gap-4" in:fade={{ duration: 220 }}>
        <div
          class="relative flex-1 min-h-0 overflow-hidden rounded-3xl shadow-2xl shadow-black/40 touch-pan-y"
          style="transform: translate3d({dragX}px, 0, 0); transition: {snapping ? 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none'}; will-change: transform;"
          in:fly={{ y: 20, duration: 260 }}
          onpointerdown={onCardPointerDown}
          onpointermove={onCardPointerMove}
          onpointerup={onCardPointerUp}
          onpointercancel={onCardPointerCancel}
          role="presentation"
        >
          {#if current.image}
            <img src={`/${current.image}`} alt="" class="h-full w-full object-cover" />
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
          <StarSelector onSelect={rate} />
        </div>
      </section>
    {/key}

    <footer class="mt-4 flex items-center justify-center gap-3 text-sm">
      <button
        type="button"
        onclick={skip}
        class="min-h-[44px] rounded-full bg-white/10 px-5 py-2 font-semibold text-cream transition hover:bg-white/15"
      >
        אולי אחר כך
      </button>
      <button
        type="button"
        onclick={undo}
        disabled={undoStack.length === 0}
        class="min-h-[44px] rounded-full bg-white/5 px-5 py-2 font-semibold text-white/70 transition hover:bg-white/10 disabled:opacity-30"
      >
        חזור אחורה
      </button>
      {#if hintSwipeUndo}
        <span class="text-xs text-white/40">או החלק ימינה →</span>
      {/if}
    </footer>
  {/if}
</main>
