import { createRouter, createWebHistory } from 'vue-router';

import HomeView from './views/HomeView.vue';
import NoticeDetailView from './views/NoticeDetailView.vue';
import NotificationSettingsView from './views/NotificationSettingsView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/notices/:noticeId', component: NoticeDetailView },
    { path: '/settings/notifications', component: NotificationSettingsView },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ],
  scrollBehavior: () => ({ top: 0 })
});
