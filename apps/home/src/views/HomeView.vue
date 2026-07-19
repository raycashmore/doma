<script setup lang="ts">
import { CalendarDays, Plus } from '@lucide/vue';
import { computed, nextTick, ref } from 'vue';

import ActiveBoard from '@/components/ActiveBoard.vue';
import ManualNoteEditor from '@/components/ManualNoteEditor.vue';
import { useActiveBoard } from '@/composables/useActiveBoard';
import { type ManualNoteInput, type ManualNoteItem, useManualNotes } from '@/composables/useManualNotes';
import { HOME_RUNTIME } from '@/config/runtime';
import { PREVIEW_BOARD } from '@/data/previewBoard';

const liveBoard = HOME_RUNTIME.mode === 'authenticated' ? useActiveBoard() : null;
const liveNotes = HOME_RUNTIME.mode === 'authenticated' ? useManualNotes() : null;
const boardData = computed(() => liveBoard?.data.value ?? (HOME_RUNTIME.mode === 'demo' ? PREVIEW_BOARD : undefined));
const boardPending = computed(() => liveBoard?.isPending.value ?? false);
const boardError = computed(() => liveBoard?.error.value ?? null);
const addNoteButton = ref<globalThis.HTMLButtonElement | null>(null);
const noteEditorOpen = ref(false);
const selectedNote = ref<ManualNoteItem | null>(null);
const editorTrigger = ref<globalThis.HTMLElement | null>(null);
const noteSavePending = computed(() => liveNotes?.isPending() ?? false);

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

function openNoteEditor(note: ManualNoteItem | null = null) {
  editorTrigger.value =
    globalThis.document.activeElement instanceof globalThis.HTMLElement
      ? globalThis.document.activeElement
      : addNoteButton.value;
  selectedNote.value = note;
  noteEditorOpen.value = true;
}

async function closeNoteEditor() {
  noteEditorOpen.value = false;
  selectedNote.value = null;
  await nextTick();
  editorTrigger.value?.focus();
  editorTrigger.value = null;
}

async function saveNote(input: ManualNoteInput) {
  if (!liveNotes) throw new Error('Shared notes are unavailable');
  return liveNotes.save(selectedNote.value, input);
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
        <button
          ref="addNoteButton"
          class="add-note-preview"
          type="button"
          :disabled="!liveNotes"
          @click="openNoteEditor()"
        >
          <Plus :size="17" aria-hidden="true" /> Add note
        </button>
      </div>

      <p v-if="HOME_RUNTIME.mode === 'demo'" class="connection-status">
        Local preview · authentication and live data are disabled
      </p>
      <ActiveBoard
        :data="boardData"
        :is-pending="boardPending"
        :error="boardError"
        @retry="retryBoard"
        @edit-note="openNoteEditor"
      />
    </section>

    <ManualNoteEditor
      v-if="noteEditorOpen && liveNotes"
      :note="selectedNote"
      :save="saveNote"
      :is-pending="noteSavePending"
      @close="closeNoteEditor"
      @saved="closeNoteEditor"
    />
  </main>
</template>
