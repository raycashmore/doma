<script lang="ts">
  import '../styles.css';

  import { onMount } from 'svelte';

  import { dev } from '$app/environment';
  import { base } from '$app/paths';
  import { type ClerkAuthState,loadClerkSession } from '$lib/auth';
  import { appNavItems, getAppHref } from '$lib/navigation';

  let signInElement: HTMLDivElement;
  let authState: ClerkAuthState = { status: 'loading' };

  onMount(async () => {
    try {
      authState = await loadClerkSession(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY, signInElement);
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
    {:else}
      <slot />
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
