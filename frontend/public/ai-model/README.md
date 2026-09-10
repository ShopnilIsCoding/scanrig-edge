# ScanRig custom model

The production model is served by the separate Express server from the AI package's `web_model/` directory.

Stage 20 expects:

- `model.onnx`
- `labels.json`
- `model_meta.json`
- `runtime.json`

Default frontend URL: `http://localhost:5000/ai-model/model.onnx`.

Until an ONNX model exists, workouts continue with MediaPipe + rule validation.
