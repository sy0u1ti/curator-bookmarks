# GlassSurface in Curator

Source: [React Bits / GlassSurface](https://github.com/DavidHDev/react-bits/tree/3e619ca31732d5d6849ecd5130ddd7b266aa7bd7/src/ts-default/Components/GlassSurface).
Pinned upstream commit: `3e619ca31732d5d6849ecd5130ddd7b266aa7bd7`.
The upstream license is preserved in `LICENSE.md` and included in extension builds.

Curator uses the component's Frosted (`refraction={false}`) material: native
backdrop blur, inset highlights and a gradient sheen. The upstream sheen colors
and stops are retained.

Integration changes:

- Specialize to Frosted. Omit unused SVG/WebGL optics, shape decoding, size
  observers and renderer negotiation so every surface paints this material on
  its first render. There is no wallpaper capture, Worker, PNG cache or late swap.
- Forward native props and React 19 refs, and support `as` so anchors, buttons,
  sections and Base UI primitives keep their semantics and DOM element.
- Let the host own size, layout, overflow and focus. Render children directly.
- Paint the sheen as the host's background image and keep its inset highlights.
  Remove the masked rim and separate decoration spans: an inset child that
  inherits the outer radius misaligns the corners and composites another
  antialiased edge. The material now shares the host's native border geometry,
  including asymmetric corners, without size observers or extra mask layers.
- Expose blur, saturation, brightness, fill, highlight and shadow CSS variables.
  New Tab applies its neutral theme, density tiers and user preferences outside
  the vendor component. The upstream fixed 12px Frosted blur becomes a variable.

This directory contains the third-party material implementation. Product-specific
composition and accessibility overrides live in `src/newtab`.
