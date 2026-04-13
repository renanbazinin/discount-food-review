<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly, slide } from 'svelte/transition';
  import { loadCatalog, type LoadedCatalog } from '$lib/catalog/load';
  import { ratingsStore } from '$lib/stores/http-ratings-store';
  import { getNext } from '$lib/stars/queue';
  import type { Dish, MyRating } from '$lib/types';
  import StarSelector from '$lib/ui/StarSelector.svelte';

  let catalog = $state<LoadedCatalog | null>(null);
  let mine = $state<MyRating[]>([]);
  let current = $state<Dish | null>(null);
  let key = $state(0);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let busy = $state(false);

  const skipped = new Set<string>();
  const undoStack: string[] = [];

  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerStartTime = 0;
  let pointerTracking = false;
  let hintSwipeUndo = $state(false);

  function onCardPointerDown(e: PointerEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('[role="radio"]') || target.closest('button')) return;
    pointerStartX = e.clientX;
    pointerStartY = e.clientY;
    pointerStartTime = performance.now();
    pointerTracking = true;
  }

  function onCardPointerUp(e: PointerEvent) {
    if (!pointerTracking) return;
    pointerTracking = false;
    const dx = e.clientX - pointerStartX;
    const dy = e.clientY - pointerStartY;
    const dt = performance.now() - pointerStartTime;
    if (Math.abs(dx) >= 60 && dx > 0 && Math.abs(dy) < 30 && dt < 600) {
      if (undoStack.length > 0) {
        hintSwipeUndo = true;
        undo();
      }
    }
  }

  function onCardPointerCancel() {
    pointerTracking = false;
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

  async function rate(stars: number) {
    if (!current || busy) return;
    busy = true;
    error = null;
    const dishId = current.id;
    try {
      await ratingsStore.rate(dishId, stars);
      mine = [...mine, { dishId, stars, timestamp: Date.now() }];
      undoStack.push(dishId);
      skipped.delete(dishId);
      advance();
    } catch (e) {
      error = e instanceof Error ? e.message : 'שמירה נכשלה';
    } finally {
      busy = false;
    }
  }

  function skip() {
    if (!current) return;
    skipped.add(current.id);
    advance();
  }

  async function undo() {
    const dishId = undoStack.pop();
    if (!dishId || busy) return;
    busy = true;
    error = null;
    try {
      await ratingsStore.clear(dishId);
      mine = mine.filter((r) => r.dishId !== dishId);
      const dish = catalog?.getById(dishId) ?? null;
      advance(dish);
    } catch (e) {
      error = e instanceof Error ? e.message : 'ביטול נכשל';
      undoStack.push(dishId);
    } finally {
      busy = false;
    }
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
          in:fly={{ y: 20, duration: 260 }}
          onpointerdown={onCardPointerDown}
          onpointerup={onCardPointerUp}
          onpointercancel={onCardPointerCancel}
          role="presentation"
        >
          {#if current.image}
            <img src={`/${current.image}`} alt="" class="h-full w-full object-cover" />
          {:else}
            <div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-900 to-indigo-600 p-8">
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
        <span class="text-xs text-white/40">או החלק ←</span>
      {/if}
    </footer>
  {/if}
</main>
