<script setup lang="ts">
import { Archive } from '@lucide/vue';
import { computed, nextTick, onMounted, ref } from 'vue';

const props = defineProps<{
  item: { id: string; title: string };
  archive: () => Promise<unknown>;
  isPending: boolean;
}>();
const emit = defineEmits<{ cancel: []; archived: [] }>();
const submitting = ref(false);
const errorMessage = ref('');
const cancelButton = ref<globalThis.HTMLButtonElement | null>(null);
const dialog = ref<globalThis.HTMLElement | null>(null);
const effectivePending = computed(() => props.isPending || submitting.value);

onMounted(() => nextTick(() => cancelButton.value?.focus()));

async function confirmArchive() {
  if (effectivePending.value) return;
  submitting.value = true;
  errorMessage.value = '';
  try {
    await props.archive();
    emit('archived');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'The item could not be archived. Try again.';
  } finally {
    submitting.value = false;
  }
}

function handleKeydown(event: globalThis.KeyboardEvent) {
  if (event.key === 'Escape' && !effectivePending.value) emit('cancel');
  if (event.key !== 'Tab' || !dialog.value) return;

  const controls = Array.from(dialog.value.querySelectorAll<globalThis.HTMLButtonElement>('button')).filter(
    (control) => !control.disabled
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
  <div class="note-editor-backdrop" @click.self="!effectivePending && $emit('cancel')">
    <section
      ref="dialog"
      class="archive-confirmation"
      role="dialog"
      aria-modal="true"
      :aria-label="`Archive ${item.title}?`"
      @keydown="handleKeydown"
    >
      <div class="archive-confirmation-icon" aria-hidden="true"><Archive :size="22" /></div>
      <h2>Archive {{ item.title }}?</h2>
      <p>This item will be removed from the shared noticeboard for everyone. Its source record is kept.</p>
      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
      <div class="note-editor-actions">
        <button
          ref="cancelButton"
          type="button"
          class="secondary-button"
          :disabled="effectivePending"
          @click="$emit('cancel')"
        >
          Cancel
        </button>
        <button type="button" class="archive-button" :disabled="effectivePending" @click="confirmArchive">
          {{ effectivePending ? 'Archiving…' : 'Archive item' }}
        </button>
      </div>
    </section>
  </div>
</template>
