import {
  type AppDescriptor as BaseAppDescriptor,
  type AppId,
  APPS as BASE_APPS,
  getActiveAppId,
  getAppHref
} from '@repo/app-registry';
import { Calendar, ChefHat, Home, Landmark, ListChecks, type LucideIcon, PiggyBank } from 'lucide-react';

export type { AppId };

export type AppDescriptor = BaseAppDescriptor & {
  icon: LucideIcon;
};

const iconsByAppId: Record<AppId, LucideIcon> = {
  home: Home,
  budget: PiggyBank,
  mortgage: Landmark,
  schedule: Calendar,
  lists: ListChecks,
  meals: ChefHat
};

export const APPS: AppDescriptor[] = BASE_APPS.map((app) => ({
  ...app,
  icon: iconsByAppId[app.id]
}));

export { getActiveAppId, getAppHref };
