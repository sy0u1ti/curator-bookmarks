# Textures

MIT-licensed React/SVG textures from https://textures.dev, retrieved October 30, 2026.
Source endpoints: `https://textures.dev/r/{current,settle,curtain,sphere,watch,twist}.json`.
The free-texture licence is published at https://textures.dev/legal/license.

The geometry and deformation code retain their attribution. Dashes, dots and
stripes are smaller and cover less of the field than the original hero-sized samples;
the Twist response is local rather than full-field. Curator replaces
the duplicated animation engines with a shared, on-demand pointer adapter:
no ambient loop, network requests or third-party runtime dependencies.
The New Tab layer owns interaction exclusion zones and static/reduced-motion
fallbacks. Only the selected texture's code is loaded.

`node src/vendor/textures/generate-previews.mjs` regenerates the local static SVGs
used for first paint and the settings picker. The licence is copied beside them
so it also ships in the extension package.
