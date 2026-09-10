# ScanRig Frontend — Stage 18

React/Vite frontend for the ScanRig home-gym system.

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Default local services:

```text
API:      http://localhost:5000/api
AI model: http://localhost:5000/ai-model
```

## Main frontend features

- React 19 + Vite
- Tailwind CSS + ScanRig design system
- Three.js / React Three Fiber James + Jody trainers
- cached trainer/model assets
- account-aware onboarding
- MediaPipe Pose Landmarker camera tracking
- stricter exercise posture validation
- camera-friendly personalized workout queue
- live form feedback and voice coaching
- per-user dashboard, XP, history, achievements and progress
- custom ONNX Runtime Web movement-classifier integration

## Private Admin AI Lab

`/ai-lab` is administrator-only. Normal users do not see the link and are redirected if they manually enter the URL. The server also enforces the administrator role for every dataset/training API, so this is not only a frontend restriction.

The Admin AI Lab can:

- record a labeled 4-second real pose sequence;
- save it directly to MongoDB;
- show progressive counts for each exercise;
- relabel samples;
- mark samples Approved / Review / Rejected;
- delete bad samples;
- export the real dataset;
- start a full retraining run that combines the synthetic base with the current real samples.

Only normalized landmarks are stored by the AI dataset API. Webcam images/video are not stored.

## Custom AI flow

```text
Synthetic ScanRig dataset
        +
Admin-collected real samples in MongoDB
        ↓
Python TensorFlow training
        ↓
ONNX Runtime Web model served by scanrig-server
        ↓
React custom movement classifier
        ↓
geometry/form/rep validation
```

The custom model validates what movement is being performed. The existing geometry engine still handles rep phases and form feedback.
