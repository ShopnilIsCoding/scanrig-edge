# ScanRig Frontend v3 changes

## Trainer and onboarding

- Rebuilt the trainer SVG with separate upper arms, forearms, thighs and calves.
- Corrected the layer order so the head sits in front of the neck and collar.
- Reduced limb rotation and moved joint pivots to the shoulders, elbows, hips and knees.
- Moved the coach speech panel above and beside the trainer.
- Moved age, goal, level and schedule equipment to the side of the trainer.
- Kept the height gate around the trainer and the scale platform under the feet.
- Moved the scale display beside the trainer so it remains readable.

## Camera engine

- Added a live movement heatmap.
- Replaced the full-body visibility gate with exercise-specific landmark checks.
- Added upper-body-only jumping-jack counting.
- Added one-arm push-up and curl tracking.
- Added partial-body high-knee tracking using hips and knees.
- Relaxed push-up and squat thresholds.
- Added stable-frame validation before a phase transition counts as a rep.
- Reduced MediaPipe pose confidence thresholds for less rigid tracking.
- Added shoulder press, hammer curl and high knees.

## Mobile camera

- Detects insecure HTTP access before requesting the camera.
- Shows a clear HTTPS instruction instead of silently doing nothing.
