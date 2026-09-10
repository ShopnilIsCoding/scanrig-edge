# ScanRig API 1.0 — Final Release

Key final changes:
- calorie fields persisted with each workout and included in summaries
- personalized plan exposes daily and weekly estimated calorie targets
- Trainer context includes calorie targets and recorded burn estimates
- Trainer chat is local-first for user-specific questions and common coaching intents
- Gemini quota failures are hidden from users and fall back to clean ScanRig answers
- normal personalization refreshes do not consume Gemini requests

Keep the existing working `scanrig-ai` directory and its current `.venv`, TensorFlow training workflow and ONNX output.
