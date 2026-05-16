import type { ReactNode } from 'react';

export interface HeaderProps {
  title: string;
  actions?: ReactNode;
}

export function Header({ title, actions }: HeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 px-7 pt-7 pb-4">
      <h1 className="text-3xl font-warm-display text-warm-text-on-dark">
        {title}
      </h1>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
