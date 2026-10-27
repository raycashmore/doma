import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitepress';

// eslint-disable-next-line no-restricted-syntax -- VitePress requires a default config export.
export default defineConfig({
  title: 'Doma patterns',
  description: 'Shared guidance with native implementations and explicit evidence gaps.',
  lang: 'en-AU',
  srcDir: fileURLToPath(new URL('../../../packages/design-system/dist/guide', import.meta.url)),
  outDir: fileURLToPath(new URL('./dist', import.meta.url)),
  cacheDir: fileURLToPath(new URL('./cache', import.meta.url)),
  vite: { resolve: { alias: { vue: fileURLToPath(new URL('../node_modules/vue', import.meta.url)) } } },
  head: [
    ['meta', { name: 'robots', content: 'noindex, nofollow' }],
    ['link', { rel: 'icon', href: 'data:,' }]
  ],
  themeConfig: {
    search: { provider: 'local' },
    nav: [
      { text: 'Patterns', link: '/patterns/' },
      { text: 'Foundations', link: '/foundations' },
      { text: 'Contribute', link: '/contributing' }
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Start here', link: '/' },
          { text: 'Patterns', link: '/patterns/' },
          { text: 'List overview and access', link: '/patterns/list-overview-and-access' },
          { text: 'Foundations', link: '/foundations' },
          { text: 'Contribute', link: '/contributing' }
        ]
      }
    ]
  }
});
