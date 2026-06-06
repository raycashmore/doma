import { DM_Sans, Merriweather } from 'next/font/google';

export const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--warm-font-body',
  display: 'swap'
});

export const merriweather = Merriweather({
  subsets: ['latin'],
  weight: ['800'],
  variable: '--warm-font-display',
  display: 'swap'
});
