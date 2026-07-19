<script setup lang="ts">
import { X } from '@lucide/vue';
import { computed, nextTick, onMounted, ref } from 'vue';

type NoteDraft = {
  noteId?: string;
  title: string;
  detail?: string;
  dueDate?: string;
};

const props = defineProps<{
  note: NoteDraft | null;
  save: (input: { title: string; detail?: string; dueDate?: string }) => Promise<unknown>;
  isPending: boolean;
}>();
const emit = defineEmits<{ close: []; saved: [] }>();

const title = ref(props.note?.title ?? '');
const detail = ref(props.note?.detail ?? '');
const dueDate = ref(props.note?.dueDate ?? '');
const errorMessage = ref('');
const submitting = ref(false);
const titleInput = ref<globalThis.HTMLInputElement | null>(null);
const dialog = ref<globalThis.HTMLElement | null>(null);
const effectivePending = computed(() => props.isPending || submitting.value);

onMounted(() => nextTick(() => titleInput.value?.focus()));

async function submit() {
  if (effectivePending.value) return;
  submitting.value = true;
  errorMessage.value = '';
  try {
    await props.save({
      title: title.value,
      ...(detail.value ? { detail: detail.value } : {}),
      ...(dueDate.value ? { dueDate: dueDate.value } : {})
    });
    emit('saved');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'The note could not be saved. Try again.';
    await nextTick();
    if (errorMessage.value.toLowerCase().includes('title')) titleInput.value?.focus();
  } finally {
    submitting.value = false;
  }
}

function handleKeydown(event: globalThis.KeyboardEvent) {
  if (event.key === 'Escape' && !effectivePending.value) emit('close');
  if (event.key !== 'Tab' || !dialog.value) return;

  const controls = Array.from(dialog.value.querySelectorAll<globalThis.HTMLElement>('button, input, textarea')).filter(
    (control) => !control.hasAttribute('disabled')
  );
  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey && globalThis.document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && globalThis.document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
</script>

<template>
  <div class="note-editor-backdrop" @click.self="!effectivePending && $emit('close')">
    <section
      ref="dialog"
      class="note-editor"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="note ? 'edit-note-title' : 'add-note-title'"
      @keydown="handleKeydown"
    >
      <header class="note-editor-header">
        <div>
          <p class="eyebrow">Shared household note</p>
          <h2 :id="note ? 'edit-note-title' : 'add-note-title'">{{ note ? 'Edit note' : 'Add note' }}</h2>
        </div>
        <button
          type="button"
          class="icon-button"
          aria-label="Close note editor"
          :disabled="effectivePending"
          @click="$emit('close')"
        >
          <X :size="20" aria-hidden="true" />
        </button>
      </header>

      <form aria-label="Note details" class="note-editor-form" @submit.prevent="submit">
        <label>
          <span>Title</span>
          <!-- eslint-disable-next-line vue/html-self-closing -->
          <input ref="titleInput" v-model="title" maxlength="80" :disabled="effectivePending" />
        </label>
        <label>
          <span>Details (optional)</span>
          <textarea v-model="detail" name="detail" maxlength="1000" rows="4" :disabled="effectivePending" />
        </label>
        <label>
          <span>Due date (optional)</span>
          <!-- eslint-disable-next-line vue/html-self-closing -->
          <input v-model="dueDate" name="dueDate" type="date" :disabled="effectivePending" />
        </label>

        <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>

        <div class="note-editor-actions">
          <button type="button" class="secondary-button" :disabled="effectivePending" @click="$emit('close')">
            Cancel
          </button>
          <button type="submit" class="primary-button" :disabled="effectivePending">
            {{ effectivePending ? 'Saving…' : note ? 'Save changes' : 'Add note' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
