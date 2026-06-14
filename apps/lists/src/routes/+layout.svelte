<script lang="ts">
  import '../styles.css';

  import { setupAuth, setupConvex } from 'convex-svelte';
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';

  import { dev } from '$app/environment';
  import { base } from '$app/paths';
  import { type ClerkAuthState, loadClerkSession } from '$lib/auth';
  import ConvexAuthGate from '$lib/ConvexAuthGate.svelte';
  import { appNavItems, getAppHref } from '$lib/navigation';

  let { children }: { children: Snippet } = $props();
  let signInElement: HTMLDivElement;
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

  function resolveAppHref(item: (typeof appNavItems)[number]): string {
    return getAppHref(item, dev);
  }
</script>

<svelte:head>
  <title>Lists | Doma</title>
  <meta
    name="description"
    content="Reusable household checklists for todos, shopping, and other arbitrary lists."
  />
</svelte:head>

<div class="app-shell">
  <nav aria-label="App navigation" class="rail">
    <a class="home-mark" href={resolveAppHref(homeNavItem)} aria-label="Home">
      <span>D</span>
    </a>

    <div class="rail-links">
      {#each appNavItems.slice(1) as item (item.id)}
        <a
          class:active={item.id === activeAppId}
          href={resolveAppHref(item)}
          aria-label={item.label}
          aria-current={item.id === activeAppId ? 'page' : undefined}
        >
          {item.label.slice(0, 1)}
        </a>
      {/each}
    </div>
  </nav>

  <main class="content-frame">
    <div class="sign-in-host" bind:this={signInElement}></div>

    {#if authState.status === 'loading'}
      <section class="auth-panel" aria-live="polite">Loading Lists...</section>
    {:else if authState.status === 'error'}
      <section class="auth-panel" role="alert">{authState.message}</section>
    {:else if authState.status === 'ready' && !authState.session}
      <section class="auth-panel">
        <div class="sign-in-copy">Sign in to open Lists.</div>
      </section>
    {:else if shouldUseConvexAuth}
      <ConvexAuthGate>
        {@render children()}
      </ConvexAuthGate>
    {:else}
      {@render children()}
    {/if}
  </main>
</div>

<div class="mobile-nav" aria-label="App navigation">
  {#each appNavItems as item (item.id)}
    <a
      class:active={item.id === activeAppId}
      href={resolveAppHref(item)}
      aria-current={item.id === activeAppId ? 'page' : undefined}
    >
      {item.label}
    </a>
  {/each}
</div>

{#if base}
  <span class="base-path" aria-hidden="true">{base}</span>
{/if}
