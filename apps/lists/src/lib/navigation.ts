export type AppNavItem = {
  id: 'home' | 'budget' | 'schedule' | 'lists';
  label: string;
  href: string;
  devPort: number;
};

export const appNavItems: AppNavItem[] = [
  { id: 'home', label: 'Home', href: '/', devPort: 3000 },
  { id: 'budget', label: 'Budget', href: '/budget', devPort: 3001 },
  { id: 'schedule', label: 'Schedule', href: '/schedule', devPort: 3003 },
  { id: 'lists', label: 'Lists', href: '/lists', devPort: 3004 }
];

export function getAppHref(item: AppNavItem, isDev: boolean): string {
  if (!isDev) return item.href;
  return `http://localhost:${item.devPort}/`;
}
