export default {
  transpilePackages: ['@proxy-app/app', '@proxy-app/ui', '@proxy-app/shared'],
  config: (config) => {
    // Add PostCSS/Tailwind support for CSS
    const cssRule = config.module?.rules?.find(
      (r) => r && typeof r === 'object' && r.test?.toString?.().includes('css')
    )
    if (cssRule && cssRule.use) {
      const hasPostcss = Array.isArray(cssRule.use)
        ? cssRule.use.some((u) => String(u).includes('postcss'))
        : String(cssRule.use).includes('postcss')
      if (!hasPostcss) {
        cssRule.use = ['postcss-loader', ...(Array.isArray(cssRule.use) ? cssRule.use : [cssRule.use])]
      }
    }
    return config
  },
}
