<script lang="ts">
  import '../app.css';
  import BottomTabBar from '$lib/ui/BottomTabBar.svelte';

  let { children } = $props();
</script>

<div class="mx-auto w-full max-w-[520px] pb-[calc(env(safe-area-inset-bottom)+88px)]">
  {@render children()}
</div>
<BottomTabBar />
