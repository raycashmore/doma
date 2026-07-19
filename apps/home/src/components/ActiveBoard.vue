<script setup lang="ts">
import { Mail, StickyNote, Sun, TrendingUp, TriangleAlert, Utensils } from '@lucide/vue';
import { APPS, getAppHref } from '@repo/app-registry';
import type { api } from '@repo/convex';
import type { FunctionReturnType } from 'convex/server';
import { computed, inject } from 'vue';

import { homeUrlBuilderKey } from '../config/navigation';
import { HOME_IS_DEV } from '../config/runtime';
import CardOverflowMenu from './CardOverflowMenu.vue';

type ActiveBoardData = FunctionReturnType<typeof api.home.activeBoard.activeBoard>;
type TodayItem = Extract<ActiveBoardData['items'][number], { kind: 'today' }>;
type SourceNotice = Extract<ActiveBoardData['items'][number], { kind: 'sourceNotice' }>;
type ManualNote = Extract<ActiveBoardData['items'][number], { kind: 'manualNote' }>;
type BoardItem = ActiveBoardData['items'][number];

const props = defineProps<{
  data: ActiveBoardData | undefined;
  isPending: boolean;
  error: unknown;
}>();

defineEmits<{ retry: []; editNote: [note: ManualNote]; archive: [item: BoardItem] }>();

const today = computed(() => props.data?.items.find((item) => item.kind === 'today'));
const meals = computed(() => props.data?.items.find((item) => item.kind === 'meals'));
const sourceNotices = computed(
  () => props.data?.items.filter((item): item is SourceNotice => item.kind === 'sourceNotice') ?? []
);
const manualNotes = computed(
  () => props.data?.items.filter((item): item is ManualNote => item.kind === 'manualNote') ?? []
);
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

function sourceLabel(item: SourceNotice) {
  if (item.sourceKind === 'monthlySpendingInsight') return `Monthly spending insight · ${item.period}`;
  return item.priority === 'high' ? 'High priority' : item.priority === 'low' ? 'Quiet notice' : 'Forwarded email';
}

function sourceLinkLabel(item: SourceNotice) {
  return item.sourceApp === 'budget' ? 'Open Budget' : 'Open notice details';
}

function dueLabel(note: ManualNote) {
  if (note.dueState === 'overdue') return `Overdue · ${note.dueDate}`;
  if (note.dueState === 'dueToday') return 'Due today';
  if (note.dueState === 'upcoming') return `Due ${note.dueDate}`;
  return 'Shared note';
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

  <div v-else-if="data" class="active-board">
    <article v-if="today" class="board-card today-card" :aria-labelledby="`${today.id}-title`">
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

      <CardOverflowMenu :item-id="today.id" :label="today.headline" @archive="$emit('archive', today)" />
      <a class="card-link" :href="cardDestination(today.destination)" aria-label="Open Schedule" />
    </article>

    <article v-if="meals" class="board-card meals-card" :aria-labelledby="`${meals.id}-title`">
      <Utensils :size="22" aria-hidden="true" />
      <p class="card-kicker">TODAY'S MEALS</p>
      <h3 :id="`${meals.id}-title`" class="sr-only">Today’s Meals</h3>
      <div class="meal-summary">
        <p>School lunch · {{ meals.schoolLunch }}</p>
        <p>Dinner · {{ meals.dinner }}</p>
      </div>
      <p class="card-detail">From this week’s meal plan</p>
      <CardOverflowMenu :item-id="meals.id" label="Today’s Meals" @archive="$emit('archive', meals)" />
      <a class="card-link" :href="cardDestination(meals.destination)" aria-label="Open Meals" />
    </article>

    <article
      v-for="note in manualNotes"
      :key="note.id"
      class="board-card source-card manual-note-card"
      :class="[`source-card-${note.display}`, `source-card-${note.priority}`]"
      :aria-labelledby="`${note.id}-title`"
    >
      <div class="source-icon" aria-hidden="true"><StickyNote :size="20" /></div>
      <p class="card-kicker">{{ dueLabel(note) }}</p>
      <h3 :id="`${note.id}-title`">{{ note.title }}</h3>
      <p v-if="note.detail" class="source-detail">{{ note.detail }}</p>
      <CardOverflowMenu :item-id="note.id" :label="note.title" @archive="$emit('archive', note)" />
      <button
        class="card-link"
        type="button"
        :aria-label="`Edit note: ${note.title}`"
        @click="$emit('editNote', note)"
      />
    </article>

    <article
      v-for="item in sourceNotices"
      :key="item.id"
      class="board-card source-card"
      :class="[`source-card-${item.display}`, `source-card-${item.priority}`, `source-card-${item.sourceKind}`]"
      :aria-labelledby="`${item.id}-title`"
    >
      <div class="source-icon" aria-hidden="true">
        <TrendingUp v-if="item.sourceKind === 'monthlySpendingInsight'" :size="20" />
        <Mail v-else :size="20" />
      </div>
      <p class="card-kicker">{{ sourceLabel(item) }}</p>
      <h3 :id="`${item.id}-title`">{{ item.title }}</h3>
      <p class="source-detail">{{ item.detail }}</p>
      <dl v-if="item.sourceKind === 'forwardedEmail' && item.facts.length > 0" class="source-facts">
        <div v-for="fact in item.facts" :key="`${fact.label}:${fact.value}`">
          <dt>{{ fact.label }}</dt>
          <dd>{{ fact.value }}</dd>
        </div>
      </dl>
      <CardOverflowMenu :item-id="item.id" :label="item.title" @archive="$emit('archive', item)" />
      <a class="card-link" :href="cardDestination(item.destination)" :aria-label="sourceLinkLabel(item)" />
    </article>

    <p v-if="sourceNotices.length === 0 && manualNotes.length === 0" class="board-empty">
      Nothing else needs attention right now.
    </p>
  </div>
</template>
