<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import type { Dish, RatingAggregate } from '$lib/types';
  import { dishEmoji, dishGradient } from '$lib/catalog/fallback';

  interface Props {
    dish: Dish;
    agg: RatingAggregate | null;
    myStars: number | null;
    onReroll: () => void;
    onClose: () => void;
  }

  const { dish, agg, myStars, onReroll, onClose }: Props = $props();

  let rootEl = $state<HTMLDivElement | null>(null);
  let cardEl = $state<HTMLDivElement | null>(null);

  function onBackdropClick(e: MouseEvent) {
    if (e.target === rootEl) onClose();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !cardEl) return;
    const focusables = cardEl.querySelectorAll<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  onMount(() => {
    (async () => {
      await tick();
      const btn = cardEl?.querySelector<HTMLElement>('[data-autofocus]');
      btn?.focus();
    })();
  });
</script>

<svelte:window onkeydown={onKey} />

<div
  bind:this={rootEl}
  onclick={onBackdropClick}
  role="presentation"
  class="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4"
  transition:fade={{ duration: 160 }}
>
  <div
    bind:this={cardEl}
    role="dialog"
    aria-modal="true"
    aria-label="הפתעה — מנה מומלצת"
    class="relative w-full max-w-sm overflow-hidden rounded-3xl bg-ink shadow-2xl shadow-black/60 ring-1 ring-white/10"
    transition:scale={{ duration: 180, start: 0.94 }}
  >
    <button
      type="button"
      onclick={onClose}
      aria-label="סגור"
      class="absolute end-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-xl font-bold text-white/80 ring-1 ring-white/10 backdrop-blur-sm transition hover:bg-black/70"
    >
      ×
    </button>

    <div class="aspect-[4/3] w-full">
      {#if dish.image}
        <img src={`/${dish.image}`} alt="" class="h-full w-full object-cover" />
      {:else}
        {@const g = dishGradient(dish)}
        <div
          class="flex h-full w-full flex-col items-center justify-center gap-3 p-6"
          style="background: linear-gradient(135deg, {g.from}, {g.to});"
        >
          <span class="text-6xl drop-shadow-lg" aria-hidden="true">{dishEmoji(dish)}</span>
          <span class="text-center text-2xl font-extrabold leading-tight text-white drop-shadow-lg">
            {dish.name}
          </span>
        </div>
      {/if}
    </div>

    <div class="space-y-3 p-5">
      <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
        <span>✨</span>
        <span>הפתעה</span>
      </div>
      <div>
        <h2 class="text-xl font-extrabold leading-tight text-white">{dish.name}</h2>
        <p class="mt-1 text-sm text-white/70">
          {dish.restaurantName} · ₪{dish.price}
        </p>
      </div>

      <div class="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10">
        <div>
          {#if agg && agg.ratingCount > 0}
            <div class="font-mono text-lg font-extrabold text-white">
              {agg.averageStars.toFixed(1)}
              <span class="text-xs font-normal text-white/50">/ 10</span>
            </div>
            <div class="text-[11px] text-white/50">מתוך {agg.ratingCount} דירוגים</div>
          {:else}
            <div class="text-sm text-white/50">אין דירוגים עדיין</div>
          {/if}
        </div>
        {#if myStars != null}
          <div class="shrink-0 rounded-xl bg-accent px-3 py-1.5 text-lg font-extrabold text-ink">
            {myStars}
          </div>
        {/if}
      </div>

      <div class="flex justify-center pt-1">
        <button
          type="button"
          data-autofocus
          onclick={onReroll}
          class="min-h-[44px] rounded-full bg-accent px-6 py-2 text-sm font-bold text-ink shadow-lg shadow-accent/30 transition hover:brightness-110 active:scale-[0.98]"
        >
          הפתע שוב
        </button>
      </div>
    </div>
  </div>
</div>
