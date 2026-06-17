export type ListRouteTarget = {
  publicId: string;
  slug: string;
};

export const LAST_LIST_STORAGE_KEY = 'doma.lists.lastPublicId';

function normalizeBase(basePath: string) {
  return basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
}

export function buildListsHomeHref(basePath: string) {
  return normalizeBase(basePath) || '/';
}

export function buildListHref(basePath: string, list: ListRouteTarget) {
  const prefix = normalizeBase(basePath);
  return `${prefix}/l/${list.publicId}/${list.slug}`;
}

export function readLastListPublicId() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(LAST_LIST_STORAGE_KEY);
}

export function writeLastListPublicId(publicId: string) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LAST_LIST_STORAGE_KEY, publicId);
}
