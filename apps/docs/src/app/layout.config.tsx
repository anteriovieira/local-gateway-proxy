import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: 'Proxy App',
  },
  links: [
    {
      text: 'Docs',
      url: '/docs',
      active: 'nested-url',
    },
    {
      text: 'Chrome Extension',
      url: 'https://chromewebstore.google.com/detail/proxy-app/gdhjkolpmofllkogghodpnnmjajnbilg',
      external: true,
    },
  ],
};
