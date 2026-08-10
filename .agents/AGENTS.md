# Agent Rules for UK Accounting Platform

## MediaPipe & AI Proctoring
This project uses `@mediapipe/tasks-vision` for client-side webcam AI proctoring during Knowledge Checks.
When working with MediaPipe in this codebase, adhere to the following rules:
- **Client-Side Only**: MediaPipe models (`FaceLandmarker`, etc.) must only be initialized dynamically on the client side (`'use client'`). Do not attempt to run or import them in Server Components.
- **CDN Loading**: We load the WASM files via absolute JSDelivr CDN (`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm`) and the model tasks via Google Storage (`https://storage.googleapis.com/mediapipe-models/face_landmarker/...`). Do not attempt to bundle the `.task` or `.wasm` files directly into the Next.js build.
- **Privacy & Performance**: The webcam feed (`getUserMedia`) is processed entirely locally using `requestAnimationFrame`. No video is ever sent to the server.
- **Architecture**: The proctoring logic lives in `components/ProctoringCamera.tsx`, which triggers a violation state passed up to `components/AntiCheatWrapper.tsx` if the user looks away or leaves the camera frame.
- **Dependencies**: Note that `@mediapipe/tasks-vision` may require the `buffer` polyfill in the browser (which is installed in `package.json`).
