# Hyalite in Curator

Upstream: [VII-Cae/hyalite--liquid-glass](https://github.com/VII-Cae/hyalite--liquid-glass), version 0.3.0, commit `b0692b8aecdf264fcb49276f45d7d1d1f80f6dd0`. Distributed under the included MIT license.

The refraction profile, no-fold constraint, displacement maps, and original SVG filter assembly remain upstream's implementation. The local adapter exposes the pixel generator and prepared-map cache so `src/newtab/hyalite-map-worker.ts` can generate and encode maps off the UI thread. The live tuning preview uses the original SVG pipeline with `requirePreparedMap`.

For static wallpapers, `hyalite-raster.ts` samples those same two displacement fields and RGB dispersion offsets in a Worker and caches only the refracting rim as a transparent PNG. Ring smoothing uses a small Gaussian approximation. Native backdrop blur renders the live centre, including any content underneath. The cached edge is blended with the shared tint once. This avoids running full SVG backdrop filters across the page on every input, hover, or drawer frame. Blob URLs are decoded before use and released when replaced or removed.

The playground was designed around a 380px card with 30px corners. Applying its pixel-based bevel and thickness directly to a 6px corner clamps many slider positions to identical output. `getGlassRefractionOptions` in `src/newtab/glass-settings.ts` maps these two controls across each surface's useful geometry range. The other five optical controls retain their upstream units. Defaults approximate the playground's bevel and thickness on its reference geometry; blur defaults to the requested 12px.

The shared material uses the playground's 13% neutral tint and edge highlights. Tint is an additional CSS-only control. The settings drawer rebinds local theme aliases so nested fields and previews do not inherit opaque application surfaces.

The runtime prepares visible surfaces with count and area limits and reuses maps. Input postpones pending map work without changing existing materials. Only a surface whose actual layout size changes returns to a compatible blur until its new lens is ready; hover, focus, and unrelated clicks do not switch the page's filters. The tuning preview continues to render refraction during adjustments. A compatible blur is also used when SVG backdrop filtering is unavailable.

Flat-colour, video, and animated shader backgrounds retain the native tint/blur/rim material. Static images and simple masks use cached refraction; the tuning preview always uses the SVG reference renderer. These are wallpaper-level choices, never interaction-triggered material switches. The solid background grain is a small cached image, rather than a viewport-sized SVG filter.

`npm run test:newtab-glass` checks geometry controls on several corner sizes, verifies that all seven optical controls change both SVG-preview and cached-edge pixels, checks map reuse, and exercises persistence, immediate refresh, click stability, joined search recommendations, typing, compatible rendering, and the narrow settings drawer. Run `npm run build` first.
