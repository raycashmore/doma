<script setup lang="ts">
import { SignIn, useAuth, useClerk } from '@clerk/vue';
import { RouterLink, RouterView } from 'vue-router';

import { HOME_IS_DEV } from '@/config/runtime';
import { useConvexAuthBridge } from '@/integrations/convex/useConvexAuthBridge';

import AppShell from './AppShell.vue';

const auth = useAuth();
const clerk = useClerk();
useConvexAuthBridge(auth);

async function signOut() {
  await clerk.value?.signOut({ redirectUrl: '/' });
}

function buildUrlWithAuth(url: string) {
  return clerk.value?.buildUrlWithAuth(url) ?? url;
}
</script>

<template>
  <div v-if="!auth.isLoaded.value" class="auth-state" role="status">Loading your household…</div>

  <AppShell
    v-else-if="auth.isSignedIn.value"
    :is-dev="HOME_IS_DEV"
    :can-sign-out="true"
    :build-url-with-auth="buildUrlWithAuth"
    @sign-out="signOut"
  >
    <RouterView />
  </AppShell>

  <main v-else class="sign-in-layout">
    <div class="sign-in-copy">
      <RouterLink class="brand-mark" to="/" aria-label="Doma Home">D</RouterLink>
      <p class="eyebrow">Private household space</p>
      <h1>Sign in to Doma</h1>
      <p>Your household information stays behind your existing Doma account.</p>
    </div>
    <SignIn routing="hash" fallback-redirect-url="/" :with-sign-up="false" />
  </main>
</template>
