<script setup lang="ts">
import { ArrowLeft, Mail } from '@lucide/vue';
import type { api } from '@repo/convex';
import type { FunctionReturnType } from 'convex/server';
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import { useActiveBoard } from '@/composables/useActiveBoard';
import { HOME_RUNTIME } from '@/config/runtime';
import { PREVIEW_BOARD } from '@/data/previewBoard';

type ActiveBoardData = FunctionReturnType<typeof api.home.activeBoard.activeBoard>;
type ForwardedEmailNotice = Extract<
  ActiveBoardData['items'][number],
  { kind: 'sourceNotice'; sourceKind: 'forwardedEmail' }
>;

const route = useRoute();
const liveBoard = HOME_RUNTIME.mode === 'authenticated' ? useActiveBoard() : null;
const boardData = computed(() => liveBoard?.data.value ?? (HOME_RUNTIME.mode === 'demo' ? PREVIEW_BOARD : undefined));
const noticeId = computed(() => String(route.params.noticeId));
const notice = computed(() =>
  boardData.value?.items.find(
    (item): item is ForwardedEmailNotice =>
      item.kind === 'sourceNotice' &&
      item.sourceKind === 'forwardedEmail' &&
      item.id === `emailNotice:${noticeId.value}`
  )
);
</script>

<template>
  <main class="notice-detail-page">
    <RouterLink class="notice-detail-back" to="/">
      <ArrowLeft :size="17" aria-hidden="true" /> Back to noticeboard
    </RouterLink>

    <div v-if="liveBoard?.isPending.value" class="notice-detail-state" role="status">Loading notice…</div>
    <div v-else-if="liveBoard?.error.value" class="notice-detail-state" role="alert">
      Notice details are unavailable right now.
    </div>
    <article v-else-if="notice" class="notice-detail-card" :aria-labelledby="`${notice.id}-title`">
      <div class="source-icon" aria-hidden="true"><Mail :size="20" /></div>
      <p class="card-kicker">{{ notice.priority === 'high' ? 'High priority' : 'Forwarded email' }}</p>
      <h1 :id="`${notice.id}-title`">{{ notice.title }}</h1>
      <p class="notice-detail-body">{{ notice.detail }}</p>
      <p v-if="'dueDate' in notice" class="notice-detail-due">
        {{
          notice.dueState === 'overdue'
            ? 'Overdue'
            : notice.dueState === 'dueToday'
              ? 'Due today'
              : `Due ${notice.dueDate}`
        }}
      </p>
      <dl v-if="notice.facts.length > 0" class="source-facts">
        <div v-for="fact in notice.facts" :key="`${fact.label}:${fact.value}`">
          <dt>{{ fact.label }}</dt>
          <dd>{{ fact.value }}</dd>
        </div>
      </dl>
    </article>
    <div v-else class="notice-detail-state" role="status">This notice is no longer active.</div>
  </main>
</template>
