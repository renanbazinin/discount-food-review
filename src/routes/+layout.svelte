<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import BottomTabBar from '$lib/ui/BottomTabBar.svelte';

  let { children } = $props();

  const origin = $derived(page.url?.origin ?? '');
  const ogImage = $derived(`${origin}/og.png`);
  const canonical = $derived(`${origin}${page.url?.pathname ?? '/'}`);

  const title = 'דירוג אוכל — המנות הכי טובות';
  const description =
    'דרגו וגלו את המנות העיקריות הכי טובות. לוח מובילים חי מבוסס על הצבעות של כולם — ללא רישום, ללא פרסומות.';
  const ogDescription =
    'לוח מובילים חי של מנות עיקריות. דרגו 1–10, גלו מה כולם אוהבים, ומצאו מה להזמין היום.';
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="דירוג אוכל" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={ogDescription} />
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content={ogImage} />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="he_IL" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={ogDescription} />
  <meta name="twitter:image" content={ogImage} />
</svelte:head>

<div class="mx-auto w-full max-w-[520px] pb-[calc(env(safe-area-inset-bottom)+88px)]">
  {@render children()}
</div>
<BottomTabBar />
