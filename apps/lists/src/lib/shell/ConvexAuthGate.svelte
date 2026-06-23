<script lang="ts">
  import { api } from '@repo/convex';
  import { useAuth, useQuery } from 'convex-svelte';
  import type { Snippet } from 'svelte';

  import StartupPlaceholder from '$lib/shell/StartupPlaceholder.svelte';

  const convexAuth = useAuth();
  const authStatus = useQuery(api.lists.auth.status, () => (convexAuth.isAuthenticated ? {} : 'skip'));
  let { children }: { children: Snippet } = $props();
</script>

{#if convexAuth.isLoading}
  <StartupPlaceholder
    message="Checking Lists access..."
    detail="Confirming your data session before opening your lists."
  />
{:else if !convexAuth.isAuthenticated}
  <section class="auth-panel" role="alert">Unable to authenticate with Lists data.</section>
{:else if authStatus.isLoading}
  <StartupPlaceholder
    message="Opening Lists..."
    detail="Connecting to your lists and preparing the workspace."
  />
{:else if authStatus.error}
  <section class="auth-panel" role="alert">Unable to load Lists data.</section>
{:else if authStatus.data}
  {@render children()}
{/if}
