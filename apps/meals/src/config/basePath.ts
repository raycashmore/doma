export const MEALS_BASE_PATH = '/meals';
export const MEALS_BASE_URL = `${MEALS_BASE_PATH}/`;

export function getMealsBasePath(isDev: boolean): string {
  return isDev ? '/' : MEALS_BASE_PATH;
}

export function getMealsBaseUrl(isDev: boolean): string {
  return isDev ? '/' : MEALS_BASE_URL;
}
