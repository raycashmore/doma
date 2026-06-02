export function budgetDisplayMonthEndFromCaptureDate(captureDate: number): number {
  const date = new Date(captureDate);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 0);
}

export function budgetCaptureDatesFromCaptureDate(captureDate: number): {
  date: number;
  captureDate: number;
} {
  return {
    date: budgetDisplayMonthEndFromCaptureDate(captureDate),
    captureDate
  };
}
