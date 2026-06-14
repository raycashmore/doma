import { type AppDescriptor, APPS } from '@repo/app-registry';

export type AppNavItem = AppDescriptor;

export const appNavItems: AppNavItem[] = APPS.filter((app) => app.enabled);

export { getAppHref } from '@repo/app-registry';
