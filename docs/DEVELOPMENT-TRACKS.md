# Independent placement and model-quality tracks

## Placement / wall integration

Purpose: the visible unit, interaction box, wall plane and exported image must
share the same photo coordinates. This must hold independently of model style.

The high-DPI canvas sizing bug is fixed in its own commit. Pixel-readback tests
cover desktop and phone layouts at DPR 1, 1.25, 2 and 3, after dragging, wall edits,
resizing, model changes, expanded view and orientation changes. They compare
actual painted pixels with the selection box; see [registration](PLACEMENT-REGISTRATION.md).
The old layout was reproduced separately and failed that check.

Changes here should preserve the normalized projection contract and should not
change model artwork merely to make a box test pass.

## Unit models / visual quality

Purpose: improve appliance geometry and appearance without changing placement
coordinates. A dedicated model specialist owns the design module/front artwork;
model-provider data stays separate from camera and wall mathematics.

The current iteration adds family-specific casing cross sections, material
metadata, shaped fronts, inlet/outlet details, underside and side textures. The
shared renderer connects cross-section rings at the correct depth and maps each
side texture across those segments. Screen and JPEG export use the same renderer.
See [model quality](MODEL-QUALITY.md) for sources, design details and limitations.

Current models are improved original illustrations, not manufacturer CAD or a
claim of final photorealistic production quality. The production-quality path
remains a separate model task: validate exact SKU details, obtain permitted
manufacturer geometry or measured reference data, and prepare optimized assets
with proper materials. Verified official BIM sources and conversion limits are
in [LG assets](LG-3D-ASSETS.md). No unverified OEM mesh has been embedded.

## Integration gate

Before a model update ships, run `npm run build`, `npm test`, and
`npm run test:e2e -- tests/placement-registration.spec.ts tests/local-and-proportions.spec.ts`.
Review front/three-quarter views for all families and recheck the physical outer
dimensions. Model quality must not regress selection/paint alignment.
