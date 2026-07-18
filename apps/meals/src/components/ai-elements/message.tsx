'use client';

import { memo } from 'react';
import { Streamdown } from 'streamdown';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export type MessageResponseProps = ComponentProps<typeof Streamdown>;

export const MessageResponse = memo(
  ({ className, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn(
        'size-full text-xs leading-relaxed text-warm-text-secondary [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        className
      )}
      {...props}
    />
  ),
  (previous, next) => previous.children === next.children && previous.isAnimating === next.isAnimating
);

MessageResponse.displayName = 'MessageResponse';
