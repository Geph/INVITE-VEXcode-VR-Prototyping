# Rover Rescue 2D artwork

The September 2026 visual update uses the supplied VEXcode VR Rover Rescue
screenshots and documentation as visual references. It remains a Canvas 2D game.

- Broad terracotta basin, a smaller ochre area around the base, charcoal ridges,
  sandstone breaks and a mauve eastern shelf traced from the overhead reference.
  Terrain artwork is separate from the A-E encounter-zone polygons; its organic
  borders no longer form the previous rectangular zones and diagonal grey wedge.
- A smooth green river with darker banks, textured water and flowing ribbons.
- Faceted rocks, multicoloured alien foliage, steel mineral crates with gold straps,
  articulated spider legs and coloured serpents.
- Solar-panel rover with cyan trim, wheel treads and a forward sensor mast.
- Metal bridge decking, a quieter map grid, compass and zoom-aware scale bar.
- Updated map-key labels and colours for the revised artwork.

The ground texture is generated once per seed, anchored in world coordinates and
cached in one 2400 x 1200 offscreen canvas (~11 MB). Browsers without OffscreenCanvas
retain vector terrain. Props are drawn in batches so zooming into a populated area
keeps the same silhouettes without switching to a cheaper icon set.

Artwork uses its own seeded random stream. The camera implementation, 1x-3x zoom
limits, pan bounds and normal/maximized canvas sizes are unchanged. Entity radii,
encounter-zone polygons, program execution and research logging are unchanged.

The September 11 map refinement intentionally updates the river's bank geometry:
its existing editable survey handles are interpolated before generating both the
visible banks and the hazard polygon. The original survey handles, nominal width
and bridge locations remain in place. The channel continues beyond its first and
last handles and is clipped to the field, carrying water fully through the left
and bottom edges without visible end caps. Physics, sensing and spawn exclusion use the
same curved boundary as the artwork, avoiding invisible water hazards. Near-bank
classifications and some seeded spawn placements can therefore differ from the
older coarse polygon version; use the code revision as well as the seed for replay.

This is an illustrative 2D interpretation; it does not add the original game's
3D perspective, terrain elevation or unimplemented game systems.

Validation: lint, typecheck, all 172 tests and production build pass. Existing
characterisation and render-budget tests are unchanged. New tests check texture
reuse, bounded allocation, seed reproducibility and the no-OffscreenCanvas fallback,
plus river sampling, full-width edge crossings, non-intersecting banks and traversability of both bridges.
Browser checks cover overview and close-up rendering, zoom limits, pan/follow
interaction, normal/maximized windows and the map-key toggle.
