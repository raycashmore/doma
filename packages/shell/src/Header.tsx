import type { ReactNode } from 'react';

export interface HeaderProps {
  title: string;
  brandLabel?: string;
  actions?: ReactNode;
}

export function Header({ title, brandLabel = 'D', actions }: HeaderProps) {
  return (
    <header className="flex items-center gap-4 px-6 py-4 border-b border-neutral-200">
      <div className="flex items-center justify-center w-9 h-9 rounded-md bg-orange-500 text-white font-bold text-base">
        {brandLabel}
      </div>
      <h1 className="text-2xl font-serif font-semibold text-neutral-900">
        {title}
      </h1>
      {actions ? <div className="ml-auto">{actions}</div> : null}
    </header>
  );
}
