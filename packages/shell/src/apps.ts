import {
  Home,
  PiggyBank,
  Landmark,
  Calendar,
  ListChecks,
  ShoppingBasket,
  ChefHat,
  type LucideIcon
} from 'lucide-react';

export type AppId =
  | 'home'
  | 'budget'
  | 'mortgage'
  | 'schedule'
  | 'todo'
  | 'shopping'
  | 'recipes';

export interface AppDescriptor {
  id: AppId;
  label: string;
  href: string;
  icon: LucideIcon;
  enabled: boolean;
}

export const APPS: AppDescriptor[] = [
  { id: 'home', label: 'Home', href: '/', icon: Home, enabled: true },
  {
    id: 'budget',
    label: 'Budget',
    href: '/budget',
    icon: PiggyBank,
    enabled: true
  },
  {
    id: 'mortgage',
    label: 'Mortgage',
    href: '/mortgage',
    icon: Landmark,
    enabled: false
  },
  {
    id: 'schedule',
    label: 'Schedule',
    href: '/schedule',
    icon: Calendar,
    enabled: false
  },
  {
    id: 'todo',
    label: 'Todo',
    href: '/todo',
    icon: ListChecks,
    enabled: false
  },
  {
    id: 'shopping',
    label: 'Shopping',
    href: '/shopping',
    icon: ShoppingBasket,
    enabled: false
  },
  {
    id: 'recipes',
    label: 'Recipes',
    href: '/recipes',
    icon: ChefHat,
    enabled: false
  }
];

export function getActiveAppId(pathname: string): AppId {
  if (pathname === '/' || pathname === '') return 'home';
  const segment = pathname.split('/').filter(Boolean)[0];
  const found = APPS.find((a) => a.id === segment);
  return found ? found.id : 'home';
}
