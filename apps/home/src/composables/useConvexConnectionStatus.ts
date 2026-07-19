import { useConvexClient } from 'convex-vue';
import { computed, onScopeDispose, ref } from 'vue';

type ConnectionState = {
  isWebSocketConnected: boolean;
  hasEverConnected: boolean;
  connectionRetries: number;
};

type ConnectionClient = {
  connectionState: () => ConnectionState;
  subscribeToConnectionState: (callback: (state: ConnectionState) => void) => () => void;
};

export type ConvexConnectionStatus = 'connecting' | 'connected' | 'reconnecting';

export function useConvexConnectionStatus(client: ConnectionClient = useConvexClient()) {
  const state = ref(client.connectionState());
  const unsubscribe = client.subscribeToConnectionState((nextState) => {
    state.value = nextState;
  });

  onScopeDispose(unsubscribe);

  return computed<ConvexConnectionStatus>(() => {
    if (state.value.isWebSocketConnected) return 'connected';
    if (state.value.hasEverConnected || state.value.connectionRetries > 0) return 'reconnecting';
    return 'connecting';
  });
}
