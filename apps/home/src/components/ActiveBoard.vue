<script setup lang="ts">
import { Sun, TriangleAlert, Utensils } from '@lucide/vue';
import { APPS, getAppHref } from '@repo/app-registry';
import type { api } from '@repo/convex';
import type { FunctionReturnType } from 'convex/server';
import { computed, inject } from 'vue';

import { homeUrlBuilderKey } from '../config/navigation';
import { HOME_IS_DEV } from '../config/runtime';

type ActiveBoardData = FunctionReturnType<typeof api.home.activeBoard.activeBoard>;
type TodayItem = Extract<ActiveBoardData['items'][number], { kind: 'today' }>;

const props = defineProps<{
  data: ActiveBoardData | undefined;
  isPending: boolean;
  error: unknown;
}>();

defineEmits<{ retry: [] }>();

const today = computed(() => props.data?.items.find((item) => item.kind === 'today'));
const meals = computed(() => props.data?.items.find((item) => item.kind === 'meals'));
const buildUrlWithAuth = inject(homeUrlBuilderKey, (url) => url);

function briefingLine(line: TodayItem['morning'][number]) {
  return line.who.length > 0 ? `${line.who.join(', ')} — ${line.text}` : line.text;
}

function eventLine(event: TodayItem['laterToday'][number]) {
  const owner = event.who.length > 0 ? `${event.who.join(', ')} — ` : '';
  return `${owner}${event.title}`;
}

function eventTime(event: TodayItem['laterToday'][number]) {
  if (event.allDay || !props.data) return 'All day';
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: props.data.timeZone,
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(event.start));
}

function briefingTime(generatedAt: number | null) {
  if (!generatedAt || !props.data) return 'TODAY';
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: props.data.timeZone,
    hour: 'numeric',
    minute: '2-digit'
  })
    .format(new Date(generatedAt))
    .toUpperCase();
}

function cardDestination(destination: string) {
  const app = APPS.find((candidate) => candidate.href === destination);
  if (!app) return destination;

  const href = getAppHref(app, HOME_IS_DEV);
  return href.startsWith('http') ? buildUrlWithAuth(href) : href;
}
</script>

<template>
  <div v-if="isPending" class="active-board board-loading" role="status" aria-label="Loading noticeboard">
    <span class="sr-only">Loading noticeboard…</span>
    <article class="board-card today-card board-skeleton" aria-label="Loading Today card" />
    <article class="board-card meals-card board-skeleton" aria-label="Loading Today’s Meals card" />
  </div>

  <div v-else-if="error" class="board-error" role="alert">
    <TriangleAlert :size="22" aria-hidden="true" />
    <div>
      <h3>Household noticeboard is unavailable</h3>
      <p>The live household data could not be loaded. Try reconnecting.</p>
    </div>
    <button type="button" class="secondary-button" aria-label="Retry loading noticeboard" @click="$emit('retry')">
      Retry
    </button>
  </div>

  <div v-else-if="data && today && meals" class="active-board">
    <article class="board-card today-card" :aria-labelledby="`${today.id}-title`">
      <div class="card-kicker">
        <Sun :size="16" aria-hidden="true" />
        <span>MORNING BRIEFING · {{ briefingTime(today.generatedAt) }}</span>
      </div>
      <h3 :id="`${today.id}-title`">{{ today.headline }}</h3>
      <p v-if="today.briefingStatus === 'missing'" class="briefing-empty">No morning briefing is available yet.</p>
      <p v-else-if="today.briefingStatus === 'empty'" class="briefing-empty">
        Nothing needs attention in the morning briefing.
      </p>

      <div class="today-lines">
        <p v-for="line in today.morning" :key="line.sourceIds.join(':')" class="today-line morning-line">
          <span aria-hidden="true" />Morning · {{ briefingLine(line) }}
        </p>
        <p v-for="event in today.laterToday" :key="event.id" class="today-line afternoon-line">
          <span aria-hidden="true" />Afternoon · {{ eventLine(event) }} · {{ eventTime(event) }}
        </p>
      </div>

      <p v-for="line in today.watchouts" :key="line.sourceIds.join(':')" class="watchout-line">
        <TriangleAlert :size="17" aria-hidden="true" />Watchout · {{ line.text }}
      </p>

      <a class="card-link" :href="cardDestination(today.destination)" aria-label="Open Schedule" />
    </article>

    <article class="board-card meals-card" :aria-labelledby="`${meals.id}-title`">
      <Utensils :size="22" aria-hidden="true" />
      <p class="card-kicker">TODAY'S MEALS</p>
      <h3 :id="`${meals.id}-title`" class="sr-only">Today’s Meals</h3>
      <div class="meal-summary">
        <p>School lunch · {{ meals.schoolLunch }}</p>
        <p>Dinner · {{ meals.dinner }}</p>
      </div>
      <p class="card-detail">From this week’s meal plan</p>
      <a class="card-link" :href="cardDestination(meals.destination)" aria-label="Open Meals" />
    </article>
  </div>
</template>
