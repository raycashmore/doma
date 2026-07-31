<script setup lang="ts">
import { Calendar, ChefHat, Home, Landmark, ListChecks, LogOut, PiggyBank, Settings } from '@lucide/vue';
import { type AppId, APPS, getActiveAppId, getAppHref } from '@repo/app-registry';
import { type Component, computed, provide } from 'vue';
import { RouterLink } from 'vue-router';

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
    href: app.id === 'home' ? app.href : buildAppHref(app),
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
      <RouterLink
        v-if="homeApp"
        :to="homeApp.href"
        class="sidebar-home-link"
        :class="{ active: activeAppId === homeApp.id }"
        aria-label="Home"
        :aria-current="activeAppId === homeApp.id ? 'page' : undefined"
      >
        <component :is="homeApp.icon" :size="22" aria-hidden="true" />
      </RouterLink>

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

      <RouterLink class="nav-link" to="/settings/notifications" aria-label="Notification settings">
        <Settings :size="20" aria-hidden="true" />
      </RouterLink>

      <button v-if="canSignOut" class="nav-button" type="button" aria-label="Log out" @click="$emit('signOut')">
        <span class="logout-icon"><LogOut :size="18" aria-hidden="true" /></span>
        <span>Log Out</span>
      </button>
    </nav>

    <div class="shell-main">
      <header class="mobile-header">
        <RouterLink class="mobile-brand" to="/" aria-label="Noticeboard Home"><span>N</span> Noticeboard</RouterLink>
        <div class="mobile-actions">
          <RouterLink class="icon-action" to="/settings/notifications" aria-label="Notification settings">
            <Settings :size="19" aria-hidden="true" />
          </RouterLink>
          <button v-if="canSignOut" class="icon-action" type="button" aria-label="Sign out" @click="$emit('signOut')">
            <LogOut :size="19" aria-hidden="true" />
          </button>
        </div>
      </header>
      <slot />
    </div>

    <nav class="mobile-nav" aria-label="Doma applications">
      <template v-for="app in enabledApps" :key="app.id">
        <RouterLink
          v-if="app.id === 'home'"
          :to="app.href"
          class="mobile-nav-link"
          :class="{ active: activeAppId === app.id }"
          :aria-label="app.label"
          :aria-current="activeAppId === app.id ? 'page' : undefined"
        >
          <component :is="app.icon" :size="20" aria-hidden="true" />
          <span>{{ app.label }}</span>
        </RouterLink>
        <a
          v-else
          :href="app.href"
          class="mobile-nav-link"
          :class="{ active: activeAppId === app.id }"
          :aria-label="app.label"
          :aria-current="activeAppId === app.id ? 'page' : undefined"
        >
          <component :is="app.icon" :size="20" aria-hidden="true" />
          <span>{{ app.label }}</span>
        </a>
      </template>
    </nav>
  </div>
</template>
