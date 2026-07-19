<script setup lang="ts">
import { CalendarDays, Plus } from '@lucide/vue';

import HomeConnectionStatus from '@/components/HomeConnectionStatus.vue';
import { HOME_RUNTIME } from '@/config/runtime';

const today = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short'
}).format(new Date());
</script>

<template>
  <main class="home-page">
    <header class="page-header">
      <h1>Home</h1>
      <span class="date-chip"><CalendarDays :size="16" aria-hidden="true" /> {{ today }}</span>
    </header>

    <section class="noticeboard-shell" aria-labelledby="noticeboard-title">
      <div class="noticeboard-intro">
        <div>
          <p class="eyebrow">Household</p>
          <h2 id="noticeboard-title">Noticeboard</h2>
        </div>
        <button class="add-note-preview" type="button" disabled title="Manual notes arrive in RAY-85">
          <Plus :size="17" aria-hidden="true" /> Add note
        </button>
      </div>

      <HomeConnectionStatus v-if="HOME_RUNTIME.mode === 'authenticated'" />
      <p v-else class="connection-status">Local preview · authentication and live data are disabled</p>

      <div class="coming-soon-card">
        <p class="eyebrow">The board is ready</p>
        <h3>Today’s household view comes next</h3>
        <p>The Vue shell, secure live-data seam, navigation, and notification settings are in place.</p>
      </div>
    </section>
  </main>
</template>
