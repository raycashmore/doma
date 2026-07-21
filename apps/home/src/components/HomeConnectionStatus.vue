<script setup lang="ts">
import { useConvexConnectionStatus } from '@/composables/useConvexConnectionStatus';
import { useOnlineStatus } from '@/composables/useOnlineStatus';

defineProps<{
  isPending: boolean;
  hasError: boolean;
}>();

const isOnline = useOnlineStatus();
const connectionStatus = useConvexConnectionStatus();
</script>

<template>
  <p v-if="!isOnline" class="connection-status error-text" role="status">
    Offline · reconnect to refresh household data
  </p>
  <p v-else-if="isPending || connectionStatus === 'connecting'" class="connection-status" role="status">
    Connecting to household data…
  </p>
  <p v-else-if="connectionStatus === 'reconnecting'" class="connection-status error-text" role="status">
    Reconnecting to household data…
  </p>
  <p v-else-if="!hasError" class="connection-status connected" role="status">Live household data connected</p>
</template>
