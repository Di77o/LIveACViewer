# 3D placement registration

The photo, 3D canvas, wall corners and placement control use the same displayed
photo rectangle. Projection points and selection bounds are normalized to that
rectangle. The canvas bitmap may be larger for device pixel ratio (DPR), but its
CSS width and height must remain `100%` of the photo stage.

Previously, the canvas had `position:absolute;inset:0` without CSS dimensions.
Canvas is a replaced element: its bitmap dimensions then became its intrinsic
layout size. At DPR 2, a 360 × 270 CSS-pixel stage acquired a 720 × 540 CSS-pixel
canvas. Normalized geometry appeared twice as far from the stage origin and
twice as large, while the selection box retained the correct photo coordinates.
Explicit CSS width and height prevent bitmap resolution from changing layout.

Run the regression with:

```sh
npx playwright test tests/placement-registration.spec.ts
```

The suite uses DPR 1, 1.25, 2 and 3 on desktop and phone layouts. It reads actual
canvas pixels with alpha above 200 to exclude the translucent contact shadow,
converts their bounds through the displayed canvas rectangle, and requires each
painted edge to remain within 4 CSS pixels of the selection box. It also requires
the canvas and photo rectangles to agree within 1 CSS pixel. Reading bitmap
pixels through an assumed DPR would conceal the original sizing bug.

Each case checks initial wall placement, pointer dragging, a wall-corner edit,
the size slider, a switch from a wide unit to the square Gallery, an expanded
preview, viewport/orientation changes, and returning to the normal preview.
Screenshots are saved in each Playwright test's output directory.

Initial verification: all eight desktop/phone × DPR cases passed before the
separate model-detail and casing-geometry changes.

A temporary browser-only override restoring `width:auto;height:auto` reproduced
the old defect on the phone at DPR 2: the photo measured 351 × 263.25 CSS pixels
while the canvas measured 702 × 527. Actual painted pixels began 136.58 CSS pixels
to the right and 69.38 pixels below the selection's top-left corner. The new
pixel assertion failed as expected. The override and temporary proof test were
removed afterward.
