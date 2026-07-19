<script setup lang="ts">
import { useAuth } from '@clerk/vue';

import NotificationSettingsPanel from '@/features/notifications/NotificationSettingsPanel.vue';

const auth = useAuth();
const getToken = () => auth.getToken.value();
</script>

<template>
  <NotificationSettingsPanel :get-token="getToken" />
</template>
