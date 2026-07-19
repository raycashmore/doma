<script setup lang="ts">
import { CalendarDays, Plus } from '@lucide/vue';
import { computed } from 'vue';

import ActiveBoard from '@/components/ActiveBoard.vue';
import { useActiveBoard } from '@/composables/useActiveBoard';
import { HOME_RUNTIME } from '@/config/runtime';
import { PREVIEW_BOARD } from '@/data/previewBoard';

const liveBoard = HOME_RUNTIME.mode === 'authenticated' ? useActiveBoard() : null;
const boardData = computed(() => liveBoard?.data.value ?? (HOME_RUNTIME.mode === 'demo' ? PREVIEW_BOARD : undefined));
const boardPending = computed(() => liveBoard?.isPending.value ?? false);
const boardError = computed(() => liveBoard?.error.value ?? null);

const today = computed(() => {
  if (!boardData.value) return 'Today';

  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  })
    .formatToParts(new Date(`${boardData.value.localDate}T00:00:00.000Z`))
    .reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});

  return `${parts.weekday}, ${parts.day} ${parts.month}`;
});

function retryBoard() {
  globalThis.window.location.reload();
}
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

      <p v-if="HOME_RUNTIME.mode === 'demo'" class="connection-status">
        Local preview · authentication and live data are disabled
      </p>
      <ActiveBoard :data="boardData" :is-pending="boardPending" :error="boardError" @retry="retryBoard" />
    </section>
  </main>
</template>
