import type { ReactNode } from 'react';

export type HeaderProps = {
  title: string;
  actions?: ReactNode;
  className?: string;
};

export function Header({ title, actions, className }: HeaderProps) {
  return (
    <header
      className={`flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-2 pb-4 ${className ?? ''}`}
    >
      <h1 className="text-[24px] leading-[1.1] font-warm-display text-warm-text-on-dark md:text-[32px]">{title}</h1>
      {actions ? <div className="flex min-w-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
