# Wall detector model

Runtime: ONNX Runtime (CPU, INT8 QDQ), UPerNet decoder with ConvNeXt-Tiny backbone trained on ADE20K (150 classes, class 0 = wall).

- Original: https://huggingface.co/openmmlab/upernet-convnext-tiny (MIT metadata)
- ONNX export: https://huggingface.co/JElvis/upernet-convnext-tiny-ade-onnx
- Export revision: a8e2807c3479bc617b37d8ed53e68660b3fa1ebb
- File: model.onnx, FP32, 238434293 bytes
- SHA-256: fea729ab6c5d338bc79ad3d986b073e6faa12c97255eafd78a1f7145326e534e
- Model is fetched during Docker build and verified again before loading. No remote model code is executed.
- RGB resized to 512×512; CHW float32, mean 0.485/0.456/0.406, std 0.229/0.224/0.225. Output [1,150,128,128].
- MIT model license is preserved in UPERNET-LICENSE.txt. The app's separate private-use license does not replace third-party terms.

SegFormer was considered but not bundled because the referenced NVIDIA checkpoint is restricted to non-commercial research/evaluation. This UPerNet export instead traces to the MIT-listed OpenMMLab checkpoint.

This model segments visible surfaces; it does not identify metric dimensions or uniquely separate adjacent coplanar-looking walls. Connected-region quadrilaterals are suggestions for user correction. No 90% application-level success rate has been established.

## Default INT8 artifact

- Artifact is included in the repository at models/wall-segmentation-int8.onnx. Docker copies and verifies it; runtime does not download it.
- File: wall-segmentation-int8.onnx, 61157068 bytes
- SHA-256: 44ac510412833bf5e3e8586e6b9cba247b94e4251894e054597ebbd02de47d3f
- Conversion: scripts/quantize-wall-model.py, ONNX Runtime 1.24.3 static QDQ, per-channel INT8 weights / UINT8 activations on Conv, MatMul and Gemm.
- Calibration: three attributed public interiors in tests/fixtures/rooms/manifest.json.
- Calibration-set wall-mask overlap against FP32: 0.85–0.94 IoU. This is not ground-truth accuracy or a held-out validation result.
- Node ONNX Runtime 1.31.1 CPU pipeline benchmark: docs/wall-benchmark.json. The model's license remains MIT; retain UPERNET-LICENSE.txt with redistribution.
- To reproduce: `npm run model:fetch -- --fp32`, create an isolated Python environment with the pinned tools in the converter header, then run the converter. Calibration and re-export can differ by tool version; the shipped artifact always has the exact checksum above.
