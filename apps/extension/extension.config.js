/**
 * extension.js 3.8.16 adds a "main-world bridge" content script to the manifest for every
 * `world: "MAIN"` entry, but looks for `main-world-bridge.js` while the package ships `.cjs`, so the
 * bridge file is never emitted and Chrome refuses to load the extension. Drop manifest content
 * script entries whose files weren't emitted.
 */
class DropMissingContentScriptsPlugin {
  apply(compiler) {
    const { Compilation, sources } = compiler.webpack
    compiler.hooks.thisCompilation.tap('DropMissingContentScripts', (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: 'DropMissingContentScripts', stage: Compilation.PROCESS_ASSETS_STAGE_REPORT },
        () => {
          const asset = compilation.getAsset('manifest.json')
          if (!asset) return
          const manifest = JSON.parse(asset.source.source().toString())
          if (!Array.isArray(manifest.content_scripts)) return
          const exists = (file) => Boolean(compilation.getAsset(file))
          const kept = manifest.content_scripts.filter((cs) => (cs.js ?? []).every(exists))
          if (kept.length === manifest.content_scripts.length) return
          manifest.content_scripts = kept
          compilation.updateAsset('manifest.json', new sources.RawSource(JSON.stringify(manifest, null, 2)))
        }
      )
    })
  }
}

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
    config.plugins = [...(config.plugins ?? []), new DropMissingContentScriptsPlugin()]
    return config
  },
}
