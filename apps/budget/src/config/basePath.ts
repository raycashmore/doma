export const BUDGET_BASE_PATH = '/budget';
export const BUDGET_BASE_URL = `${BUDGET_BASE_PATH}/`;

export function getBudgetBasePath(isDev: boolean): string {
  return isDev ? '/' : BUDGET_BASE_PATH;
}

export function getBudgetBaseUrl(isDev: boolean): string {
  return isDev ? '/' : BUDGET_BASE_URL;
}
