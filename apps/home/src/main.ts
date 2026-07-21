import './styles.css';

import { clerkPlugin } from '@clerk/vue';
import { registerServiceWorker } from '@repo/pwa';
import { convexVue } from 'convex-vue';
import { createApp } from 'vue';

import App from './App.vue';
import { HOME_RUNTIME } from './config/runtime';
import { router } from './router';

const app = createApp(App);

if (HOME_RUNTIME.mode === 'authenticated') {
  app.use(clerkPlugin, {
    publishableKey: HOME_RUNTIME.clerkPublishableKey,
    signInFallbackRedirectUrl: '/'
  });
  app.use(convexVue, { url: HOME_RUNTIME.convexUrl, server: false });
}

app.use(router);
app.mount('#app');

// Turbo cannot statically recognize Vite's built-in environment fields.
// eslint-disable-next-line turbo/no-undeclared-env-vars
if (import.meta.env.PROD) {
  const serviceWorker = registerServiceWorker({
    swUrl: '/sw.js',
    scope: '/',
    onNeedRefresh: () => serviceWorker.reload()
  });
  globalThis.window.addEventListener('pagehide', () => serviceWorker.dispose(), { once: true });
}
