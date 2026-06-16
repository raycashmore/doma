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

  function resolveAppHref(item: (typeof appNavItems)[number]): string {
    return getAppHref(item, dev);
  }

  function getNavLabel(label: string) {
    return label.slice(0, 1).toUpperCase();
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
      <section class="auth-panel" aria-live="polite">Loading Lists...</section>
    {:else if authState.status === 'error'}
      <section class="auth-panel" role="alert">{authState.message}</section>
    {/if}
  </main>
{:else}
  <div class="min-h-screen bg-warm-bg-dark text-warm-text-primary lg:grid lg:grid-cols-[96px_minmax(0,1fr)]">
    <nav
      aria-label="App navigation"
      class="hidden min-h-screen flex-col items-center gap-8 border-r border-white/8 bg-warm-bg-dark px-4 py-6 text-warm-text-on-dark lg:flex"
    >
      <a
        class="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-warm-accent font-warm-display text-xl text-warm-bg transition-colors hover:bg-warm-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-accent focus-visible:ring-offset-2 focus-visible:ring-offset-warm-bg-dark"
        href={resolveAppHref(homeNavItem)}
        aria-label="Home"
      >
        <span aria-hidden="true">D</span>
      </a>

      <div class="flex flex-col gap-4">
        {#each appNavItems.slice(1) as item (item.id)}
          {@const isActive = item.id === activeAppId}
          <a
            class={`flex h-14 w-14 items-center justify-center rounded-[1.25rem] border text-sm font-semibold tracking-[0.18em] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-accent focus-visible:ring-offset-2 focus-visible:ring-offset-warm-bg-dark ${
              isActive
                ? 'border-white/10 bg-white/10 text-warm-text-on-dark'
                : 'border-transparent text-warm-text-tertiary hover:border-white/8 hover:bg-white/[0.06] hover:text-warm-text-on-dark'
            }`}
            href={resolveAppHref(item)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <span aria-hidden="true">{getNavLabel(item.label)}</span>
          </a>
        {/each}
      </div>
    </nav>

    <main class="min-w-0 px-0 py-0 lg:px-7 lg:pt-7 lg:pr-7 lg:pb-7 lg:pl-2">
      <div class="min-h-screen lg:min-h-[calc(100vh-56px)]">
        {#if shouldUseConvexAuth}
          <ConvexAuthGate>
            {@render children()}
          </ConvexAuthGate>
        {:else}
          {@render children()}
        {/if}
      </div>
    </main>
  </div>
{/if}

{#if base}
  <span class="base-path" aria-hidden="true">{base}</span>
{/if}
