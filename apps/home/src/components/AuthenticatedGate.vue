<script setup lang="ts">
import { SignIn, useAuth, useClerk } from '@clerk/vue';
import { RouterView } from 'vue-router';

import { HOME_IS_DEV } from '@/config/runtime';
import { useConvexAuthBridge } from '@/integrations/convex/useConvexAuthBridge';

import AppShell from './AppShell.vue';

const auth = useAuth();
const clerk = useClerk();
useConvexAuthBridge(auth);

function buildUrlWithAuth(url: string) {
  return clerk.value?.buildUrlWithAuth(url) ?? url;
}
</script>

<template>
  <div v-if="!auth.isLoaded.value" class="auth-state" role="status">Loading your household…</div>

  <AppShell v-else-if="auth.isSignedIn.value" :is-dev="HOME_IS_DEV" :build-url-with-auth="buildUrlWithAuth">
    <RouterView />
  </AppShell>

  <main v-else class="sign-in-layout">
    <div class="sign-in-panel">
      <h1 class="sr-only">Sign in to Noticeboard</h1>
      <!-- eslint-disable-next-line vue/html-self-closing -->
      <img class="sign-in-logo" src="/icons/icon.svg" alt="Noticeboard" />
      <SignIn
        routing="hash"
        fallback-redirect-url="/"
        :with-sign-up="false"
        :appearance="{
          elements: {
            card: 'auth-card-with-logo',
            headerSubtitle: 'auth-header-hidden',
            headerTitle: 'auth-header-hidden'
          }
        }"
      />
    </div>
  </main>
</template>
