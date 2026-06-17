<script lang="ts">
  import { api } from '@repo/convex';
  import { useAuth, useQuery } from 'convex-svelte';
  import type { Snippet } from 'svelte';

  const convexAuth = useAuth();
  const authStatus = useQuery(api.lists.auth.status, () => (convexAuth.isAuthenticated ? {} : 'skip'));
  let { children }: { children: Snippet } = $props();
</script>

{#if convexAuth.isLoading}
  <section aria-live="polite" class="sr-only">Checking Lists access...</section>
{:else if !convexAuth.isAuthenticated}
  <section aria-live="polite" class="sr-only">Authenticating Lists access...</section>
{:else if authStatus.isLoading}
  <section aria-live="polite" class="sr-only">Opening Lists...</section>
{:else if authStatus.error}
  <section class="auth-panel" role="alert">Unable to load Lists data.</section>
{:else if authStatus.data}
  {@render children()}
{/if}
