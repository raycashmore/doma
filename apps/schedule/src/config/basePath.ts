export const SCHEDULE_BASE_PATH = '/schedule';
export const SCHEDULE_BASE_URL = `${SCHEDULE_BASE_PATH}/`;

/** Next.js `basePath`: the subpath in production, empty string (root) in dev. */
export function getScheduleBasePath(isDev: boolean): string {
  return isDev ? '' : SCHEDULE_BASE_PATH;
}

export function getScheduleAssetUrl(isDev: boolean, assetPath: string): string {
  return `${getScheduleBasePath(isDev)}/${assetPath}`;
}
