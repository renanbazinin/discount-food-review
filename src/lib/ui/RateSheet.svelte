<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { tick } from 'svelte';
  import type { Dish, RatingAggregate } from '$lib/types';
  import StarSelector from './StarSelector.svelte';

  interface Props {
    dish: Dish | null;
    agg: RatingAggregate | null;
    myStars: number | null;
    busy: boolean;
    onRate: (stars: number) => void;
    onClear: () => void;
    onClose: () => void;
  }

  const { dish, agg, myStars, busy, onRate, onClear, onClose }: Props = $props();

  let rootEl = $state<HTMLDivElement | null>(null);
  let sheetEl = $state<HTMLDivElement | null>(null);
  let dragStartY = 0;
  let dragY = $state(0);
  let dragging = $state(false);

  function onBackdropClick(e: MouseEvent) {
    if (e.target === rootEl) onClose();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !sheetEl) return;
    const focusables = sheetEl.querySelectorAll<HTMLElement>(
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

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType !== 'touch') return;
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    dragStartY = e.clientY;
    dragY = 0;
    dragging = true;
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const dy = e.clientY - dragStartY;
    dragY = Math.max(0, dy);
  }

  function onPointerUp() {
    if (!dragging) return;
    const shouldClose = dragY > 80;
    dragging = false;
    dragY = 0;
    if (shouldClose) onClose();
  }

  $effect(() => {
    if (dish) {
      (async () => {
        await tick();
        const first = sheetEl?.querySelector<HTMLButtonElement>('[role="radio"]');
        first?.focus();
      })();
    }
  });
</script>

<svelte:window onkeydown={onKey} />

{#if dish}
  <div
    bind:this={rootEl}
    role="presentation"
    onclick={onBackdropClick}
    class="fixed inset-0 z-40 bg-black/60"
    transition:fade={{ duration: 160 }}
  ></div>
  <div
    bind:this={sheetEl}
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="rate-sheet-title"
    class="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[520px] rounded-t-3xl bg-ink pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl shadow-black/60 ring-1 ring-white/10"
    style="transform: translateY({dragY}px); transition: {dragging ? 'none' : 'transform 180ms ease-out'};"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    transition:fly={{ y: 400, duration: 220 }}
  >
    <div class="flex justify-center pt-2.5">
      <div class="h-1.5 w-10 rounded-full bg-white/20"></div>
    </div>
    <div class="px-5 pb-4 pt-3">
      <div class="mb-4 flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <h3 id="rate-sheet-title" class="truncate text-base font-extrabold text-white">{dish.name}</h3>
          <p class="truncate text-xs text-white/60">
            {dish.restaurantName} · ₪{dish.price}
            {#if agg && agg.ratingCount > 0}
              · {agg.averageStars.toFixed(1)} ({agg.ratingCount})
            {/if}
          </p>
        </div>
        <button
          type="button"
          onclick={onClose}
          aria-label="סגור"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-white/70 ring-1 ring-white/10 transition hover:bg-white/15"
        >
          ×
        </button>
      </div>
      <StarSelector current={myStars} onSelect={(s) => !busy && onRate(s)} />
      {#if myStars != null}
        <div class="mt-4 flex justify-center">
          <button
            type="button"
            onclick={onClear}
            disabled={busy}
            class="min-h-[44px] rounded-full bg-rose-900/50 px-4 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-900/70 disabled:opacity-50"
          >
            נקה דירוג
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
