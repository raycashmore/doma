import localFont from 'next/font/local';

export const dmSans = localFont({
  src: '../../../../packages/tokens/fonts/dm-sans-latin.woff2',
  weight: '400 700',
  style: 'normal',
  variable: '--warm-font-body',
  display: 'swap'
});

export const merriweather = localFont({
  src: '../../../../packages/tokens/fonts/merriweather-800-latin.woff2',
  weight: '800',
  style: 'normal',
  variable: '--warm-font-display',
  display: 'swap'
});
