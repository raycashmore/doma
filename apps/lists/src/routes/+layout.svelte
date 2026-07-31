<script lang="ts">
  import '../styles.css';

  import { registerServiceWorker, type ServiceWorkerController } from '@repo/pwa';
  import { setupAuth, setupConvex } from 'convex-svelte';
  import type { Snippet } from 'svelte';
  import { onDestroy, onMount } from 'svelte';

  import { dev } from '$app/environment';
  import { base } from '$app/paths';
  import { type ClerkAuthState, loadClerkSession } from '$lib/shell/auth';
  import ConvexAuthGate from '$lib/shell/ConvexAuthGate.svelte';
  import NavIcon from '$lib/shell/NavIcon.svelte';
  import { appNavItems, getAppHref } from '$lib/shell/navigation';
  import StartupPlaceholder from '$lib/shell/StartupPlaceholder.svelte';

  let { children }: { children: Snippet } = $props();
  let signInElement = $state<HTMLDivElement>();
  let authState = $state<ClerkAuthState>({ status: 'loading' });
  let updateReady = $state(false);
  let swController: ServiceWorkerController | undefined;
  const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
  const shouldUseConvexAuth = Boolean(clerkPublishableKey);
  const isMissingConvexUrl = !convexUrl;

  if (convexUrl) {
    setupConvex(convexUrl);
    if (shouldUseConvexAuth) {
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
  }

  onMount(async () => {
    if (!dev) {
      swController = registerServiceWorker({
        swUrl: `${base}/sw.js`,
        scope: `${base}/`,
        onNeedRefresh: () => {
          updateReady = true;
          swController?.reload();
        }
      });
    }

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
  const showAuthOverlay = $derived(
    authState.status === 'error' || (authState.status === 'ready' && !authState.session)
  );

  function resolveAppHref(item: (typeof appNavItems)[number]): string {
    return getAppHref(item, dev);
  }

  function resolveSettingsHref(): string {
    return dev ? `http://localhost:${homeNavItem.devPort}${settingsPath}` : settingsPath;
  }

  function reloadToUpdate(): void {
    swController?.reload();
  }

  onDestroy(() => {
    swController?.dispose();
  });
</script>

<svelte:head>
  <title>Lists | Doma</title>
  <meta name="description" content="Reusable household checklists for todos, shopping, and other arbitrary lists." />
</svelte:head>

<main class="auth-screen" class:auth-screen--hidden={!showAuthOverlay} aria-hidden={!showAuthOverlay}>
  <div class="sign-in-host" bind:this={signInElement}></div>

  {#if authState.status === 'error'}
    <section class="auth-panel" role="alert">{authState.message}</section>
  {/if}
</main>

<div class="min-h-screen bg-warm-bg-dark font-warm-body text-warm-text-primary md:h-screen md:overflow-hidden">
  <div class="flex h-screen overflow-hidden bg-warm-bg-dark md:h-full">
    <nav aria-label="App navigation" class="hidden w-14 flex-col items-end py-6 text-warm-text-on-dark md:flex">
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
        <h1 class="font-warm-display text-[24px] leading-[1.1] text-warm-text-on-dark md:text-[32px]">Lists</h1>
      </header>

      <main class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-0 pb-4 md:overflow-hidden md:px-4">
        {#if authState.status === 'loading'}
          <StartupPlaceholder message="Opening Lists..." detail="Checking your session and preparing your lists." />
        {:else if authState.status === 'disabled'}
          {@render children()}
        {:else if authState.status === 'ready' && authState.session && shouldUseConvexAuth}
          <ConvexAuthGate>
            {@render children()}
          </ConvexAuthGate>
        {:else if authState.status === 'ready' && authState.session}
          {@render children()}
        {:else}
          <StartupPlaceholder message="Opening Lists..." detail="Waiting for sign-in before loading your lists." />
        {/if}
      </main>

      <nav
        aria-label="App navigation"
        class="mobile-app-nav flex items-stretch justify-around border-t border-warm-border bg-warm-bg-dark px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden"
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

{#if updateReady}
  <div
    role="status"
    aria-live="polite"
    class="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex w-[calc(100%-2rem)] max-w-sm items-center gap-3 rounded-2xl border border-warm-border bg-warm-bg-dark-muted px-4 py-3 text-warm-text-on-dark shadow-lg md:bottom-[max(1rem,env(safe-area-inset-bottom))]"
  >
    <span class="flex-1 text-sm">A new version is available.</span>
    <button
      type="button"
      onclick={reloadToUpdate}
      class="rounded-lg bg-warm-accent px-3 py-1 text-sm font-medium text-warm-bg transition-opacity hover:opacity-90"
    >
      Reload
    </button>
  </div>
{/if}

{#if base}
  <span class="base-path" aria-hidden="true">{base}</span>
{/if}
