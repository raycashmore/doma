<script setup lang="ts">
import { HOME_RUNTIME } from '@/config/runtime';

import AuthenticatedNotificationSettings from './AuthenticatedNotificationSettings.vue';
</script>

<template>
  <main class="settings-page">
    <AuthenticatedNotificationSettings v-if="HOME_RUNTIME.mode === 'authenticated'" />
    <section v-else class="settings-panel">
      <header class="settings-heading">
        <p class="eyebrow">Auth unavailable</p>
        <h2>Notification settings</h2>
        <p>Start Noticeboard with a Clerk publishable key to connect or manage Telegram.</p>
      </header>
      <div class="settings-card muted">Telegram pairing is disabled in this local preview.</div>
    </section>
  </main>
</template>
