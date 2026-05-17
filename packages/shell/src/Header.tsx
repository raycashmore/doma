import type { ReactNode } from 'react';

export interface HeaderProps {
  title: string;
  actions?: ReactNode;
  className?: string;
}

export function Header({ title, actions, className }: HeaderProps) {
  return (
    <header
      className={`flex items-center justify-between gap-4 px-4 pt-2 pb-4 ${className ?? ''}`}
    >
      <h1 className="text-[36px] leading-[1.1] font-warm-display text-warm-text-on-dark">
        {title}
      </h1>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
