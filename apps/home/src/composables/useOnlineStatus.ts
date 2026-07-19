import { onBeforeUnmount, onMounted, ref } from 'vue';

export function useOnlineStatus() {
  const isOnline = ref(globalThis.navigator.onLine);

  function syncOnlineStatus() {
    isOnline.value = globalThis.navigator.onLine;
  }

  onMounted(() => {
    globalThis.window.addEventListener('online', syncOnlineStatus);
    globalThis.window.addEventListener('offline', syncOnlineStatus);
  });

  onBeforeUnmount(() => {
    globalThis.window.removeEventListener('online', syncOnlineStatus);
    globalThis.window.removeEventListener('offline', syncOnlineStatus);
  });

  return isOnline;
}
