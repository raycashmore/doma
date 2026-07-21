<script setup lang="ts">
import { Calendar, ChefHat, Home, Landmark, ListChecks, LogOut, PiggyBank, Settings } from '@lucide/vue';
import { type AppId, APPS, getActiveAppId, getAppHref } from '@repo/app-registry';
import { type Component, computed, provide } from 'vue';

import { homeUrlBuilderKey } from '../config/navigation';

const props = defineProps<{
  isDev: boolean;
  canSignOut: boolean;
  buildUrlWithAuth: (url: string) => string;
}>();

defineEmits<{ signOut: [] }>();

provide(homeUrlBuilderKey, props.buildUrlWithAuth);

const iconByApp = {
  home: Home,
  budget: PiggyBank,
  mortgage: Landmark,
  schedule: Calendar,
  lists: ListChecks,
  meals: ChefHat
} satisfies Record<AppId, Component>;

const enabledApps = computed(() =>
  APPS.filter((app) => app.enabled).map((app) => ({
    ...app,
    href: buildAppHref(app),
    icon: iconByApp[app.id]
  }))
);
const homeApp = computed(() => enabledApps.value.find((app) => app.id === 'home'));
const desktopApps = computed(() => enabledApps.value.filter((app) => app.id !== 'home'));

const currentPath = typeof globalThis.window === 'undefined' ? '/' : globalThis.window.location.pathname;
const activeAppId = getActiveAppId(currentPath);

function buildAppHref(app: (typeof APPS)[number]) {
  const href = getAppHref(app, props.isDev);
  return href.startsWith('http') ? props.buildUrlWithAuth(href) : href;
}
</script>

<template>
  <div class="home-shell">
    <nav class="desktop-sidebar" aria-label="App navigation">
      <a
        v-if="homeApp"
        :href="homeApp.href"
        class="sidebar-home-link"
        :class="{ active: activeAppId === homeApp.id }"
        aria-label="Home"
        :aria-current="activeAppId === homeApp.id ? 'page' : undefined"
      >
        <component :is="homeApp.icon" :size="22" aria-hidden="true" />
      </a>

      <ul class="desktop-nav">
        <li v-for="app in desktopApps" :key="app.id">
          <a
            :href="app.href"
            class="nav-link"
            :class="{ active: activeAppId === app.id }"
            :aria-label="app.label"
            :aria-current="activeAppId === app.id ? 'page' : undefined"
          >
            <component :is="app.icon" :size="20" aria-hidden="true" />
          </a>
        </li>
      </ul>

      <a class="nav-link" href="/settings/notifications" aria-label="Notification settings">
        <Settings :size="20" aria-hidden="true" />
      </a>

      <button v-if="canSignOut" class="nav-button" type="button" aria-label="Log out" @click="$emit('signOut')">
        <span class="logout-icon"><LogOut :size="18" aria-hidden="true" /></span>
        <span>Log Out</span>
      </button>
    </nav>

    <div class="shell-main">
      <header class="mobile-header">
        <a class="mobile-brand" href="/" aria-label="Doma Home"><span>D</span> Home</a>
        <div class="mobile-actions">
          <a class="icon-action" href="/settings/notifications" aria-label="Notification settings">
            <Settings :size="19" aria-hidden="true" />
          </a>
          <button v-if="canSignOut" class="icon-action" type="button" aria-label="Sign out" @click="$emit('signOut')">
            <LogOut :size="19" aria-hidden="true" />
          </button>
        </div>
      </header>
      <slot />
    </div>

    <nav class="mobile-nav" aria-label="Doma applications">
      <a
        v-for="app in enabledApps"
        :key="app.id"
        :href="app.href"
        class="mobile-nav-link"
        :class="{ active: activeAppId === app.id }"
        :aria-label="app.label"
        :aria-current="activeAppId === app.id ? 'page' : undefined"
      >
        <component :is="app.icon" :size="20" aria-hidden="true" />
        <span>{{ app.label }}</span>
      </a>
    </nav>
  </div>
</template>
