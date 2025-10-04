# Webcam Face Effects - Project Instructions

## Project Overview
- **React + TypeScript + Vite** web app
- **TensorFlow.js MediaPipe FaceMesh** for real-time face detection
- **TensorFlow.js MediaPipe Hands** for hand gesture recognition
- **Canvas-based rendering** with visual effects overlay
- **Photo capture & gallery** - capture photos with effects, download/delete photos
- **Hand gesture video recording** - raise right hand to start/stop recording with audio
- 9 effects: None, Landmarks, BoundingBox, Sunglasses, FaceOutline, Pixelate, GlowUp, GlowRed, Lipstick

## Tech Stack
- `@tensorflow/tfjs` v4.22.0 (WebGL backend)
- `@tensorflow-models/face-landmarks-detection` v1.0.6
- `@tensorflow-models/hand-pose-detection` v2.0.1
- React 19.1.1
- Vite 7.1.7
- TypeScript 5.9.3

## Architecture

### Key Files
- `src/App.tsx` - UI controls, effect selection, mirror toggle, photo state management
- `src/components/WebcamFaceEffectsSimple.tsx` - Core engine (face + hand detection), photo capture, video recording
- `src/components/PhotoGallery.tsx` - Photo gallery with download/delete functionality
- Face detection runs every 3rd frame (throttled)
- Hand detection runs every 5th frame (throttled)
- Canvas: 640x480, willReadFrequently optimization

### State Management
- Use **refs** for render loop values (avoid re-renders)
- Props: `selectedEffect`, `isMirrored`, `onPhotoCapture` (optional callback)
- State: `isModelLoaded`, `faceDetected`, `fps`, `photos`, `isRecording`, `rightHandRaised`

## Effects Implementation

### Simple Effects
- **landmarks** - Green dots on all keypoints
- **boundingBox** - Red box around face
- **sunglasses** - Black ellipses on eyes (keypoints 33, 263)
- **faceOutline** - Cyan neon line (first 36 keypoints)
- **pixelate** - 12x12 pixel blocks using getImageData

### Advanced Effects
- **glowUp/glowRed** - Radial gradient + 3 stars above head + blink-triggered particle burst
- **lipstick** - Red fill on lip keypoints (upperLipOuter/Inner, lowerLipOuter/Inner)

### Particle System (Glow Effects)
- Blink detection: eye height < 5px (keypoints 159-145, 386-374)
- 40 particles/blink (20 per eye)
- Physics: velocity, gravity, fade out
- Star-shaped particles (5-pointed)

## Performance Rules
- **Always throttle detection** (every 3 frames minimum)
- **Reuse last face data** during async detection
- **Use refs for render loop** to avoid re-renders
- **Clear particles** when life <= 0

## Development Commands

### Local Development
```bash
npm run dev      # Vite dev server (http://localhost:5173)
npm run build    # TypeScript + Vite build
npm run lint     # ESLint check
npm run preview  # Preview production build
```

### Docker Development (with hot reload)
```bash
# Development mode with volume mapping
docker-compose -f docker-compose.dev.yml up --build

# Access: http://localhost:5173
# Changes in src/ will auto-reload
```

### Docker Production
```bash
# Production build with nginx
docker-compose up --build -d

# Access: http://localhost:3000
# Optimized static files served by nginx
```

## Adding New Effects

1. Add effect to `effects` array in `App.tsx`
2. Add case to `drawEffect()` switch in `WebcamFaceEffectsSimple.tsx`
3. Use `keypoints[index]` for facial landmarks (see MediaPipe FaceMesh keypoint map)
4. Draw on `ctx` - effects render AFTER video frame
5. Remember: mirrored video affects x-coordinates

## Common Keypoints
- Eyes: 33 (left), 263 (right)
- Eye top/bottom: 159-145 (left), 386-374 (right)
- Forehead: 10
- Lips: See lines 529-532 for full lip indices
- Face outline: 0-36

## Browser Requirements
- WebRTC support (getUserMedia)
- WebGL support (TensorFlow.js backend)
- Canvas 2D context

## Photo Capture Feature

### How It Works
1. **Capture:** Click "📸 Capture Photo" button
2. **Storage:** Photo stored as base64 data URL in state (client-side only)
3. **Display:** Photos shown in grid gallery below effects
4. **Download:** Click 💾 to download photo as PNG
5. **Delete:** Click ❌ to remove individual photo, or "🗑️ Clear All" for all photos

### Implementation Details
- `canvas.toDataURL('image/png')` captures current canvas frame with effect
- Photos array stored in `App.tsx` state
- Download via programmatic `<a>` element with `download` attribute
- Confirmation dialog before clearing all photos

## Hand Gesture Video Recording

### How It Works
1. **Detection:** MediaPipe Hands detects right hand position every 5 frames
2. **Gesture Recognition:** Right hand raised = wrist Y position < average keypoint Y - 50px
3. **Toggle Recording:** Raising right hand starts/stops recording (edge detection)
4. **Recording:** MediaRecorder captures canvas stream (video with effects) + audio track
5. **Visual Feedback:** Red "🔴 RECORDING" indicator with pulsing animation
6. **Auto-Save:** Recording automatically downloads as `.webm` file when stopped

### Implementation Details
- `canvas.captureStream(30)` captures canvas video at 30 FPS
- Audio track extracted from original getUserMedia stream
- MediaRecorder combines canvas video + audio into single stream
- Format: `video/webm;codecs=vp9`
- Filename: `webcam-recording-{timestamp}.webm`
- Hand detection throttled to every 5th frame for performance
- Edge detection prevents multiple toggles (state change only)

### Hand Keypoints
- Wrist: keypoint[0]
- Hand gesture detection uses wrist vs average position comparison
- Only RIGHT hand triggers recording (handedness check)

## Security Notes
- Camera AND microphone permissions required for recording
- No data sent to server (100% client-side)
- No facial data stored (photos only in memory, cleared on refresh)
- Recordings processed locally, auto-downloaded to user's device
