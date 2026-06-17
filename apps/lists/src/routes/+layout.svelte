<script lang="ts">
  import '../styles.css';

  import { setupAuth, setupConvex } from 'convex-svelte';
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';

  import { dev } from '$app/environment';
  import { base } from '$app/paths';
  import { type ClerkAuthState, loadClerkSession } from '$lib/auth';
  import ConvexAuthGate from '$lib/ConvexAuthGate.svelte';
  import NavIcon from '$lib/NavIcon.svelte';
  import { appNavItems, getAppHref } from '$lib/navigation';

  let { children }: { children: Snippet } = $props();
  let signInElement = $state<HTMLDivElement>();
  let authState = $state<ClerkAuthState>({ status: 'loading' });
  const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
  const shouldUseConvexAuth = Boolean(clerkPublishableKey);
  const isMissingConvexUrl = shouldUseConvexAuth && !convexUrl;

  if (convexUrl) {
    setupConvex(convexUrl);
    setupAuth(() => ({
      isLoading: authState.status === 'loading',
      isAuthenticated: authState.status === 'ready' && Boolean(authState.session),
      fetchAccessToken: async ({ forceRefreshToken }) => {
        if (authState.status !== 'ready' || !authState.session) return null;
        return authState.session.getToken({
          template: 'convex',
          skipCache: forceRefreshToken
        });
      }
    }));
  }

  onMount(async () => {
    if (isMissingConvexUrl) {
      authState = {
        status: 'error',
        message: 'Lists is missing its Convex URL.'
      };
      return;
    }

    try {
      if (!signInElement) throw new Error('Unable to load Lists sign-in.');
      authState = await loadClerkSession(clerkPublishableKey, signInElement);
    } catch (error) {
      authState = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unable to load Lists sign-in.'
      };
    }
  });

  const activeAppId = 'lists';
  const homeNavItem = appNavItems[0]!;
  const settingsPath = '/settings/notifications';

  function resolveAppHref(item: (typeof appNavItems)[number]): string {
    return getAppHref(item, dev);
  }

  function resolveSettingsHref(): string {
    return dev ? `http://localhost:${homeNavItem.devPort}${settingsPath}` : settingsPath;
  }
</script>

<svelte:head>
  <title>Lists | Doma</title>
  <meta
    name="description"
    content="Reusable household checklists for todos, shopping, and other arbitrary lists."
  />
</svelte:head>

{#if authState.status !== 'disabled' && (authState.status !== 'ready' || !authState.session)}
  <main class="auth-screen">
    <div class="sign-in-host" bind:this={signInElement}></div>

    {#if authState.status === 'loading'}
      <section class="sr-only" aria-live="polite">Loading Lists...</section>
    {:else if authState.status === 'error'}
      <section class="auth-panel" role="alert">{authState.message}</section>
    {/if}
  </main>
{:else}
  <div class="min-h-screen bg-warm-bg-dark font-warm-body text-warm-text-primary md:h-screen md:overflow-hidden">
    <div class="flex h-screen overflow-hidden bg-warm-bg-dark md:h-full">
    <nav
      aria-label="App navigation"
      class="hidden w-14 flex-col items-end py-6 text-warm-text-on-dark md:flex"
    >
      <a
        class="flex h-12 w-12 items-center justify-center rounded-xl text-warm-text-tertiary transition-colors hover:bg-warm-bg-dark-muted hover:text-warm-text-on-dark"
        href={resolveAppHref(homeNavItem)}
        aria-label="Home"
      >
        <NavIcon name="home" size={22} />
      </a>

      <div class="h-6" aria-hidden="true"></div>

      <ul class="flex w-full flex-1 flex-col items-end gap-[18px]">
        {#each appNavItems.slice(1) as item (item.id)}
          {@const isActive = item.id === activeAppId}
          <li>
            <a
              class={`flex h-12 w-12 items-center justify-center rounded-[14px] transition-colors ${
                isActive
                  ? 'bg-warm-accent text-warm-bg'
                  : 'text-warm-text-tertiary hover:bg-warm-bg-dark-muted hover:text-warm-text-on-dark'
              }`}
              href={resolveAppHref(item)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <NavIcon name={item.id} />
            </a>
          </li>
        {/each}
      </ul>

      <a
        class="flex h-12 w-12 items-center justify-center rounded-[14px] text-warm-text-tertiary transition-colors hover:bg-warm-bg-dark-muted hover:text-warm-text-on-dark"
        href={resolveSettingsHref()}
        aria-label="Notification settings"
      >
        <NavIcon name="settings" />
      </a>
    </nav>

    <div class="flex min-h-0 min-w-0 flex-1 flex-col">
      <header class="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pb-4 pt-2">
        <h1 class="font-warm-display text-[24px] leading-[1.1] text-warm-text-on-dark md:text-[32px]">
          Lists
        </h1>
      </header>

      <main class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 md:overflow-hidden">
        {#if shouldUseConvexAuth}
          <ConvexAuthGate>
            {@render children()}
          </ConvexAuthGate>
        {:else}
          {@render children()}
        {/if}
      </main>

      <nav
        aria-label="App navigation"
        class="flex items-stretch justify-around border-t border-warm-border bg-warm-bg-dark px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden"
      >
        {#each appNavItems as item (item.id)}
          {@const isActive = item.id === activeAppId}
          <a
            href={resolveAppHref(item)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            class={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] transition-colors ${
              isActive ? 'text-warm-accent' : 'text-warm-text-tertiary hover:text-warm-text-on-dark'
            }`}
          >
            <NavIcon name={item.id} />
            <span>{item.label}</span>
          </a>
        {/each}
      </nav>
    </div>
    </div>
  </div>
{/if}

{#if base}
  <span class="base-path" aria-hidden="true">{base}</span>
{/if}
