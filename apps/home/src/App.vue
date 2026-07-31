<script setup lang="ts">
import { RouterView } from 'vue-router';

import AppShell from './components/AppShell.vue';
import AuthenticatedGate from './components/AuthenticatedGate.vue';
import { HOME_IS_DEV, HOME_RUNTIME } from './config/runtime';
</script>

<template>
  <main v-if="HOME_RUNTIME.mode === 'misconfigured'" class="configuration-error">
    <p class="eyebrow">Configuration required</p>
    <h1>Home cannot connect securely</h1>
    <p>{{ HOME_RUNTIME.message }}</p>
  </main>

  <AuthenticatedGate v-else-if="HOME_RUNTIME.mode === 'authenticated'" />

  <AppShell v-else :is-dev="HOME_IS_DEV" :build-url-with-auth="(url) => url">
    <RouterView />
  </AppShell>
</template>
