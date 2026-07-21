<script setup lang="ts">
import { Archive, MoreHorizontal } from '@lucide/vue';
import { nextTick, ref } from 'vue';

defineProps<{ itemId: string; label: string }>();
const emit = defineEmits<{ archive: [] }>();
const open = ref(false);
const trigger = ref<globalThis.HTMLButtonElement | null>(null);
const archiveItem = ref<globalThis.HTMLButtonElement | null>(null);

async function toggleMenu() {
  open.value = !open.value;
  if (open.value) {
    await nextTick();
    archiveItem.value?.focus();
  }
}

async function closeAndFocus() {
  open.value = false;
  await nextTick();
  trigger.value?.focus();
}

function archive() {
  open.value = false;
  emit('archive');
}

function handleKeydown(event: globalThis.KeyboardEvent) {
  if (event.key === 'Escape') closeAndFocus();
}
</script>

<template>
  <div class="card-overflow" @keydown="handleKeydown">
    <button
      ref="trigger"
      type="button"
      class="card-overflow-trigger"
      :data-archive-id="itemId"
      :aria-label="`More actions for ${label}`"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="toggleMenu"
    >
      <MoreHorizontal :size="19" aria-hidden="true" />
    </button>
    <div v-if="open" class="card-overflow-menu" role="menu">
      <button ref="archiveItem" type="button" role="menuitem" @click="archive">
        <Archive :size="16" aria-hidden="true" /> Archive
      </button>
    </div>
  </div>
</template>
