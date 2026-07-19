<script setup lang="ts">
import { useHomeConnection } from '@/composables/useHomeConnection';

const connection = useHomeConnection();
</script>

<template>
  <p v-if="connection.isPending.value" class="connection-status" role="status">Connecting to household data…</p>
  <p v-else-if="connection.error.value" class="connection-status error-text" role="alert">
    Household data is unavailable. Refresh to reconnect.
  </p>
  <p v-else class="connection-status connected">Live household data connected</p>
</template>
