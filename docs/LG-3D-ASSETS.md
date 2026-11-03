# LG 3D/BIM assets checked 2026-11-03

Official regional source: https://www.lgklimaat.nl/downloads/

Public links returned HTTP 200 without login:

- Revit RAC: https://www.lgklimaat.nl/media/qx5l5f1i/rac.zip (12,032,144 bytes)
- Revit Single Split: https://www.lgklimaat.nl/media/atibbzks/single-split.zip (39,594,488 bytes)

The RAC archive was inspected. It includes:

- Gallery Premium / Special GA2–GA1 indoor families: `LG_Indoor_Wall_Mounted_SE_GA1_9-12MBh_Region_v0.0.rfa` and `LG_Indoor_Wall_Mounted_SE_GA2_9-12MBh_Region_v0.0.rfa`.
- Premium / Deluxe S1P–S1D indoor family: `LG_Indoor_Wall_Mounted_S1_9-24MBh_v0.0_240613.rfa`.
- Older 2021 Artcool SJ/SK indoor families and corresponding outdoor-unit families.
- Companion TXT type catalogs. Presence of a family does not establish every 2026 Belgian SKU or capacity variant matches it.

These are actual Revit BIM families, not browser-ready GLB/glTF files. No directly embeddable GLB or separate explicit web-redistribution license was verified. A public download is not treated as permission to redistribute it in this application. The ZIP/RFA files have therefore not been bundled.

To replace the current illustrative body with manufacturer geometry: obtain the exact SKU/family and LG's permission for web embedding, export it through an authorized Revit workflow to a suitable interchange format, convert/optimize to GLB, confirm millimetre scale and wall-back orientation, then verify material/texture rights and dimensions against the catalog. Remove BIM metadata not needed by the visualization.

The shipped preview is a parametric 3D body, dimensioned from the cited catalog, with illustrative front artwork. It is not claimed to be an LG CAD mesh or a measured 3D reconstruction of the room. Projection uses an estimated pinhole camera; it can be adjusted or switched off for flat illustration.
