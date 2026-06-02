import { createContext, useContext, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';

const BudgetHeaderActionsContext = createContext<((actions: ReactNode) => void) | null>(null);

export function BudgetHeaderActionsProvider({
  children,
  setActions
}: {
  children: ReactNode;
  setActions: (actions: ReactNode) => void;
}) {
  const value = useMemo(() => setActions, [setActions]);

  return <BudgetHeaderActionsContext.Provider value={value}>{children}</BudgetHeaderActionsContext.Provider>;
}

export function useBudgetHeaderActions(actions: ReactNode) {
  const setActions = useContext(BudgetHeaderActionsContext);

  useEffect(() => {
    if (!setActions) return;
    setActions(actions);
    return () => setActions(null);
  }, [actions, setActions]);
}
