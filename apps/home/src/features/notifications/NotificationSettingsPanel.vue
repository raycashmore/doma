<script setup lang="ts">
import { ExternalLink, RefreshCw, Unplug } from '@lucide/vue';
import QrcodeVue from 'qrcode.vue';
import { computed, onMounted, ref } from 'vue';

import { createNotificationClient, type LinkStatus, type PairingLink } from './notificationClient';

const props = defineProps<{
  getToken: () => Promise<string | null>;
}>();

type PendingAction = 'create' | 'status' | 'unlink' | null;

const client = createNotificationClient({ getToken: props.getToken });
const pendingAction = ref<PendingAction>(null);
const linkStatus = ref<LinkStatus | null>(null);
const pairingLink = ref<PairingLink | null>(null);
const error = ref<string | null>(null);

const isLinked = computed(() => linkStatus.value?.linked === true);
const pairingUnavailable = computed(() => linkStatus.value?.pairingEnabled === false);
const statusLabel = computed(() => {
  if (pendingAction.value === 'status') return 'Loading settings';
  if (pairingUnavailable.value) return 'Unavailable outside production';
  if (isLinked.value) return 'Connected';
  if (pairingLink.value) return 'Ready to pair';
  if (error.value) return 'Pairing unavailable';
  return 'Not connected';
});
const expiresAtLabel = computed(() =>
  pairingLink.value
    ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
        new Date(pairingLink.value.expiresAt)
      )
    : null
);

async function refreshLinkStatus() {
  pendingAction.value = 'status';
  error.value = null;
  try {
    linkStatus.value = await client.fetchLinkStatus();
    if (linkStatus.value.linked || !linkStatus.value.pairingEnabled) pairingLink.value = null;
  } catch (caught) {
    linkStatus.value = null;
    pairingLink.value = null;
    error.value = caught instanceof Error ? caught.message : 'Could not load notification settings.';
  } finally {
    pendingAction.value = null;
  }
}

async function requestPairingLink() {
  pendingAction.value = 'create';
  error.value = null;
  try {
    pairingLink.value = await client.createPairingLink();
    linkStatus.value = { linked: false, pairingEnabled: true };
  } catch (caught) {
    pairingLink.value = null;
    error.value = caught instanceof Error ? caught.message : 'Could not create a Telegram pairing link.';
  } finally {
    pendingAction.value = null;
  }
}

async function unlinkTelegram() {
  pendingAction.value = 'unlink';
  error.value = null;
  try {
    await client.unlinkTelegram();
    pairingLink.value = null;
    linkStatus.value = { linked: false, pairingEnabled: true };
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Could not disconnect Telegram.';
  } finally {
    pendingAction.value = null;
  }
}

onMounted(refreshLinkStatus);
</script>

<template>
  <section class="settings-panel" :aria-busy="pendingAction !== null">
    <header class="settings-heading">
      <p class="eyebrow">{{ statusLabel }}</p>
      <h2>Notification settings</h2>
      <p>Connect Telegram to receive household notifications selected by Doma’s delivery policies.</p>
    </header>

    <div v-if="pendingAction === 'status' && !linkStatus" class="settings-card muted">Loading Telegram settings…</div>

    <div v-else-if="pairingUnavailable" class="settings-card muted">
      Telegram pairing and unlinking are disabled outside the production Doma app.
    </div>

    <div v-else-if="isLinked" class="settings-card settings-row">
      <div class="settings-icon"><Unplug :size="28" aria-hidden="true" /></div>
      <div class="settings-copy">
        <h3>Telegram connected</h3>
        <p>Notifications will be delivered to the linked private Telegram chat.</p>
        <p v-if="linkStatus?.displayLabel" class="muted">Linked account: @{{ linkStatus.displayLabel }}</p>
        <p v-if="error" role="alert" class="error-text">{{ error }}</p>
        <div class="button-row">
          <button class="secondary-button" type="button" :disabled="pendingAction !== null" @click="refreshLinkStatus">
            <RefreshCw :size="16" aria-hidden="true" /> Refresh status
          </button>
          <button class="primary-button" type="button" :disabled="pendingAction !== null" @click="unlinkTelegram">
            <Unplug :size="16" aria-hidden="true" />
            {{ pendingAction === 'unlink' ? 'Disconnecting' : 'Disconnect Telegram' }}
          </button>
        </div>
      </div>
    </div>

    <div v-else class="settings-card settings-row">
      <div class="qr-frame">
        <QrcodeVue v-if="pairingLink" :value="pairingLink.deepLink" :size="176" level="M" render-as="svg" />
        <span v-else>No pairing code yet</span>
      </div>
      <div class="settings-copy">
        <h3>Telegram</h3>
        <p>Scan the code with your phone, or open Telegram on this device. Pairing links expire shortly.</p>
        <p v-if="expiresAtLabel" class="muted">Expires around {{ expiresAtLabel }}.</p>
        <p v-if="error" role="alert" class="error-text">{{ error }}</p>
        <div class="button-row">
          <button class="primary-button" type="button" :disabled="pendingAction !== null" @click="requestPairingLink">
            <RefreshCw :size="16" aria-hidden="true" />
            {{ pendingAction === 'create' ? 'Creating' : pairingLink ? 'Refresh code' : 'Create code' }}
          </button>
          <button class="secondary-button" type="button" :disabled="pendingAction !== null" @click="refreshLinkStatus">
            Refresh status
          </button>
          <a v-if="pairingLink" class="secondary-button" :href="pairingLink.deepLink" target="_blank" rel="noreferrer">
            <ExternalLink :size="16" aria-hidden="true" /> Open Telegram
          </a>
        </div>
      </div>
    </div>
  </section>
</template>
