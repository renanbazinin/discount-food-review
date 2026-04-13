<script lang="ts">
  import { onMount } from 'svelte';
  import type { Dish } from '$lib/types';

  interface Props {
    rank: number | null;
    dish: Dish;
    averageStars: number;
    ratingCount: number;
    myStars: number | null;
    muted?: boolean;
    onTap: () => void;
  }

  const { rank, dish, averageStars, ratingCount, myStars, muted = false, onTap }: Props = $props();

  const medal = $derived(rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null);
  const avgFormatted = $derived(ratingCount > 0 ? averageStars.toFixed(1) : '—');

  let mounted = $state(false);
  onMount(() => {
    mounted = true;
  });
</script>

<button
  type="button"
  class={`flex w-full items-center gap-3.5 rounded-2xl p-3.5 text-start ring-1 transition hover:bg-white/[0.06] active:scale-[0.995] ${
    myStars != null ? 'bg-accent/10 ring-accent/40' : muted ? 'bg-white/[0.03] ring-white/10 opacity-75' : 'bg-white/[0.04] ring-white/10'
  }`}
  onclick={onTap}
  aria-label={`דרג את ${dish.name}`}
>
  <span class="w-8 shrink-0 text-center text-base font-bold text-white/50">
    {#if medal}
      <span class="text-xl">{medal}</span>
    {:else if rank != null}
      {rank}
    {:else}
      ?
    {/if}
  </span>
  {#if dish.image}
    <img src={`/${dish.image}`} alt="" class="h-14 w-14 shrink-0 rounded-xl object-cover" />
  {:else}
    <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[10px] font-bold text-white/60">
      {dish.name.slice(0, 6)}
    </div>
  {/if}
  <div class="min-w-0 flex-1">
    <div class="truncate text-sm font-semibold text-white">{dish.name}</div>
    <div class="truncate text-xs text-white/55">{dish.restaurantName} · ₪{dish.price}</div>
    {#if ratingCount > 0}
      <div class="mt-0.5 truncate text-[11px] text-white/50">
        {#key averageStars}
          <span class={mounted ? 'shimmer-on-change inline-block' : 'inline-block'}>{avgFormatted}</span>
        {/key}
        <span class="opacity-60">(מתוך {ratingCount})</span>
      </div>
    {/if}
  </div>
  <div class="shrink-0 text-end">
    {#if myStars != null}
      <div class="font-mono text-xl font-extrabold text-accent">{myStars}</div>
      <div class="text-[10px] text-white/40">שלך</div>
    {:else}
      <div class="font-mono text-xs text-white/30">לא דירגת</div>
    {/if}
  </div>
</button>
