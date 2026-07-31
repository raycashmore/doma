<script setup lang="ts">
import { useAuth, useClerk } from '@clerk/vue';
import { LogOut } from '@lucide/vue';

import NotificationSettingsPanel from '@/features/notifications/NotificationSettingsPanel.vue';

const auth = useAuth();
const clerk = useClerk();
const getToken = () => auth.getToken.value();

async function signOut() {
  await clerk.value?.signOut({ redirectUrl: '/' });
}
</script>

<template>
  <NotificationSettingsPanel :get-token="getToken" />
  <section class="settings-panel account-settings-panel" aria-labelledby="account-settings-heading">
    <div class="settings-card account-settings-card">
      <div class="settings-copy">
        <h2 id="account-settings-heading">Account</h2>
        <p>Sign out of Doma on this device.</p>
      </div>
      <button class="secondary-button" type="button" @click="signOut">
        <LogOut :size="16" aria-hidden="true" />
        Sign out
      </button>
    </div>
  </section>
</template>
