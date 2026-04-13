<script lang="ts">
  import { page } from '$app/state';

  type Tab = 'home' | 'rate';

  const tabs: { id: Tab; href: string; label: string }[] = [
    { id: 'home', href: '/', label: 'דירוג' },
    { id: 'rate', href: '/rate', label: 'דרג' }
  ];

  function resolveActive(pathname: string): Tab | null {
    if (pathname === '/') return 'home';
    if (pathname === '/rate') return 'rate';
    return null;
  }

  const active = $derived(resolveActive(page.url.pathname));

  function onTap(e: MouseEvent, tab: Tab) {
    if (tab === active) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
</script>

<nav
  data-testid="bottom-tab-bar"
  class="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]"
  aria-label="ניווט ראשי"
>
  <div class="mx-auto max-w-[520px] border-t border-white/10 bg-[#0c1524]/95 backdrop-blur-md">
    <ul class="flex">
      {#each tabs as tab (tab.id)}
        <li class="flex-1">
          <a
            href={tab.href}
            onclick={(e) => onTap(e, tab.id)}
            class={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition ${
              active === tab.id ? 'text-accent' : 'text-white/55 hover:text-white/80'
            }`}
            aria-current={active === tab.id ? 'page' : undefined}
            aria-label={tab.label}
          >
            {#if tab.id === 'home'}
              <!-- trophy -->
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
              </svg>
            {:else}
              <!-- star -->
              <svg width="26" height="26" viewBox="0 0 24 24" fill={active === tab.id ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            {/if}
            <span>{tab.label}</span>
          </a>
        </li>
      {/each}
    </ul>
  </div>
</nav>
