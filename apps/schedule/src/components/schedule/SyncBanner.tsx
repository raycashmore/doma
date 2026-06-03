import { RefreshCw } from 'lucide-react';

type SyncBannerProps = {
  lastSyncedAt: number | null;
  isRefreshing: boolean;
  error?: string;
  onRefresh: () => void;
};

function formatLastSyncedAt(lastSyncedAt: number | null): string {
  if (!lastSyncedAt) return 'Not synced yet';
  const seconds = Math.max(0, Math.round((Date.now() - lastSyncedAt) / 1000));
  if (seconds < 60) return 'Synced just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Synced ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `Synced ${hours}h ago`;
}

export function SyncBanner({ lastSyncedAt, isRefreshing, error, onRefresh }: SyncBannerProps) {
  return (
    <div className="schedule-sync" role="status">
      <div>
        <span className="schedule-sync__title">Synced from Google Calendar</span>
        <span className={error ? 'schedule-sync__meta schedule-sync__meta--error' : 'schedule-sync__meta'}>
          {error ?? formatLastSyncedAt(lastSyncedAt)}
        </span>
      </div>
      <button className="schedule-sync__button" type="button" onClick={onRefresh} disabled={isRefreshing}>
        <RefreshCw aria-hidden size={14} className={isRefreshing ? 'schedule-sync__spinner' : undefined} />
        <span>Refresh</span>
      </button>
    </div>
  );
}
