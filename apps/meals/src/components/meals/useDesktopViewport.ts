import { useSyncExternalStore } from 'react';

const query = '(min-width: 768px)';

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function getSnapshot() {
  return window.matchMedia(query).matches;
}

function getServerSnapshot() {
  return false;
}

export function useDesktopViewport() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
