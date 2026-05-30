import { DM_Sans, DM_Serif_Display } from 'next/font/google';

export const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--warm-font-body',
  display: 'swap'
});

export const dmSerifDisplay = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--warm-font-display',
  display: 'swap'
});
