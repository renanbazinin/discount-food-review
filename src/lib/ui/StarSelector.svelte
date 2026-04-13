<script lang="ts">
  interface Props {
    current?: number | null;
    onSelect: (stars: number) => void;
  }

  const { current = null, onSelect }: Props = $props();
  const stars = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
</script>

<div class="flex flex-wrap items-center justify-center gap-2" role="radiogroup" aria-label="דירוג">
  {#each stars as s (s)}
    <button
      type="button"
      role="radio"
      aria-checked={current === s}
      onclick={() => onSelect(s)}
      class={`h-11 w-11 shrink-0 rounded-full text-base font-bold ring-1 transition active:scale-95 ${
        current === s
          ? 'bg-accent text-ink ring-accent'
          : 'bg-white/10 text-cream ring-white/10 hover:bg-white/15'
      }`}
    >
      {s}
    </button>
  {/each}
</div>
