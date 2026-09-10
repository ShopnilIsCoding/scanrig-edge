# ScanRig 1.0 — Final UI Release

This release removes the experimental exercise-specific 3D demonstrations and keeps James/Jody only where they make sense as the product trainers. Exercise instruction uses clear written guidance plus optional YouTube embeds configured in `src/data/exerciseVideos.js`.

Key final fixes:
- reliable workout start gate (camera + lighting + safe space; body lock can finish during countdown)
- camera-first desktop layout and mobile live rep HUD
- dynamic full-rep form scoring instead of a near-fixed phase score
- calorie estimates by exercise, active time, body weight and personalized plan; today/week targets and history exports
- Dark, Light and Blue themes only
- local-first Trainer answers for plan, form, readiness, calories and common coaching questions; Gemini is reserved for open-ended fitness conversation and degrades safely when quota is unavailable
- pose skeleton and alignment guides default OFF; pose-only replay remains optional
- YouTube demo mapping remains editable without code changes elsewhere

Calorie values are estimates for fitness feedback, not direct metabolic measurements.

Keep the existing working `scanrig-ai` directory. This frontend expects the ONNX model to continue being served by the ScanRig server exactly as in the previous working release.
