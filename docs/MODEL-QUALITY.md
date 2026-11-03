# Illustrative LG indoor-unit models

Reviewed against the six official regional LG reference photographs already in `public/models` on 2026-11-03. The source URLs and nominal dimensions remain in `src/data/catalog.ts` and `public/models/SOURCES.md`. The photographs have not been changed or used as baked textures.

`src/lib/unit-model-design.ts` provides dimensioned casing cross sections, family materials, outlet details, and side textures. `src/components/UnitArtwork.tsx` provides the front texture in millimetre coordinates. Geometry is generated in code; the SVGs are self-contained and retain each catalog model's actual width/height ratio.

| Family | Front and casing treatment | Nominal W × H × D (mm) |
| --- | --- | --- |
| ARTCOOL AI Mirror | Low-radius glass face, broad reflection, five slim outlet louvers with brighter edges, recessed intake and rear chassis | 935 × 307 × 235 |
| ARTCOOL AI Matt Black | Shared ARTCOOL casing, high-roughness dark material and restrained highlights, five dark louvers | 935 × 307 × 235 |
| DUALCOOL AI Premium | Rounded shoulders, recessed outlet ends, vertical fins, two shaped vanes and white lower airfoil | 895 × 307 × 235 |
| DUALCOOL AI Deluxe | Gentler square shoulders and family-specific rear taper; white panel above an open outlet and lower airfoil | 895 × 307 × 235 |
| DUALCOOL AI Special | Narrower body, lower panel termination, taller lower airfoil and different rear/lower casing taper | 799 × 307 × 235 |
| ARTCOOL Gallery Premium | Thin grained wood-look rails with mitred joins, off-white board, inset landscape display and recessed rear housing | 652 × 652 × 158 |

Gallery is a square appliance with a wide display inside it. Approximate photo proportions are screen `x=.042, y=.243, width=.916`, with a 16:9 physical aspect ratio and a 9 mm front frame. The vector landscape is an illustrative display image, not a copy of LG's control interface or a claim about installed content. The white families use broad lower airfoils; the ARTCOOL bar units use a denser five-louver outlet. These structural differences are present in SVG paths and metadata, rather than only in paint colors.

## Renderer contract

`getUnitDesign(model)` accepts the catalog model or dimensions with optional `id`, `visualVariant`, and `finish`. Dimension-only inputs use the Deluxe profile. All lengths are millimetres; material properties are illustrative normalized values.

Each `sideProfile` station has `depthFraction` from wall/back `0` to front `1` plus top, bottom and side insets into the nominal bounding rectangle. Connecting successive rings produces the recessed rear shell, curved/beveled shoulders and forward lip. At least one ring reaches the nominal full width and height. The profile stations differ for Premium, Deluxe, Special, ARTCOOL and Gallery. The final ring is the front texture surface. `casing` also describes bevel size, corner radius and front/rear inset estimates for more detailed renderers.

`unitSideSvg(model, face)` uses horizontal UV along the clockwise perimeter edge and vertical UV from back to front: top left→right, right top→bottom, bottom right→left, left bottom→top. It includes recessed top intake slots, an underside outlet with vane/fin details, or a side service seam. A renderer can clip its vertical texture range to the depth interval of each casing segment. The front artwork has separate panel, outlet cavity, horizontal louvers, vertical fins, lower airfoil, and glass-reflection groups.

## Accuracy and limits

The catalog's nominal width, height and depth are sourced dimensions. The intermediate profiles, radii, vent positions, open-vane angles, wood grain, display bounds and material values are visual estimates from photographs. They have not been measured on the appliances. The low-segment casing profiles are a visual approximation, and fixed SVG highlights do not reflect the uploaded room. Different capacity variants and regional SKUs may differ.

This is original illustrative geometry and artwork, **not manufacturer CAD, LG BIM conversion, a photogrammetric scan, or installation clearance documentation**. Installer confirmation remains necessary for exact SKU dimensions and clearances. Official Revit family availability and the licensed conversion path are documented separately in [LG-3D-ASSETS.md](LG-3D-ASSETS.md); no downloaded RFA/CAD geometry has been embedded or redistributed.

`src/lib/unit-model-design.test.ts` checks depth coverage, dimensional bounds, distinct family profiles, physical Gallery screen aspect, material ranges, front SVG rasterization and paint references, louver/fin structure, and side texture UV dimensions. Run with `node --import tsx --test src/lib/unit-model-design.test.ts`.
