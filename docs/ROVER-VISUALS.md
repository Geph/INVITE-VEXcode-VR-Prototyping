# Rover Rescue 2D artwork

The September 2026 visual update uses the supplied VEXcode VR Rover Rescue
screenshots and documentation as visual references. It remains a Canvas 2D game.

- Ochre, charcoal, sandstone and mauve ground with seeded strata, grit and pebbles.
- Bright green river with shore shading and moving flow lines clipped to the real
  hazard polygon, including its bridge cutouts.
- Faceted rocks, multicoloured alien foliage, steel mineral crates with gold straps,
  articulated spider legs and coloured serpents.
- Solar-panel rover with cyan trim, wheel treads and a forward sensor mast.
- Metal bridge decking, a quieter map grid, compass and zoom-aware scale bar.
- Updated map-key labels and colours for the revised artwork.

The ground texture is generated once per seed, anchored in world coordinates and
cached in one 2400 x 1200 offscreen canvas (~11 MB). Browsers without OffscreenCanvas
retain vector terrain. Props are drawn in batches so zooming into a populated area
keeps the same silhouettes without switching to a cheaper icon set.

Artwork uses its own seeded random stream. Collision geometry, spawn positions,
entity radii, sensing, program execution and research logging are unchanged.
The camera implementation, 1x-3x zoom limits, pan bounds and normal/maximized
canvas sizes are unchanged. Surface colours are independent of debug-zone colours.
This is an illustrative 2D interpretation; it does not add the original game's
3D perspective, terrain elevation or unimplemented game systems.

Validation: lint, typecheck, all 167 tests and production build pass. The existing
render-budget test is unchanged. New tests check texture reuse, bounded allocation,
seed reproducibility and the no-OffscreenCanvas fallback. Browser checks cover the
normal and maximized views, zoom ceiling, pan/follow interaction and map-key toggle.
