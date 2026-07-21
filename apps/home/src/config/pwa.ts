const EXTERNAL_NAVIGATION_PREFIXES = ['/api', '/budget', '/schedule', '/lists', '/meals'];

export const HOME_NAVIGATION_DENYLIST = EXTERNAL_NAVIGATION_PREFIXES.map((prefix) => new RegExp(`^${prefix}(?:/|$)`));

export function isHomeNavigationPath(pathname: string) {
  return !HOME_NAVIGATION_DENYLIST.some((pattern) => pattern.test(pathname));
}
