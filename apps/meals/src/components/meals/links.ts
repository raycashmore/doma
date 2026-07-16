export function mealHref(baseUrl: string, relativePath = '') {
  return `${baseUrl.replace(/\/$/, '')}/${relativePath.replace(/^\//, '')}`;
}
