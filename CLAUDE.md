# Webcam Face Effects - Project Instructions

## Project Overview
- **React + TypeScript + Vite** web app
- **TensorFlow.js MediaPipe FaceMesh** for real-time face detection
- **Canvas-based rendering** with visual effects overlay
- **Photo capture & gallery** - capture photos with effects, download/delete photos
- 9 effects: None, Landmarks, BoundingBox, Sunglasses, FaceOutline, Pixelate, GlowUp, GlowRed, Lipstick

## Tech Stack
- `@tensorflow/tfjs` v4.22.0 (WebGL backend)
- `@tensorflow-models/face-landmarks-detection` v1.0.6
- React 19.1.1
- Vite 7.1.7
- TypeScript 5.9.3

## Architecture

### Key Files
- `src/App.tsx` - UI controls, effect selection, mirror toggle, photo state management
- `src/components/WebcamFaceEffectsSimple.tsx` - Core engine (468 landmarks detection), photo capture
- `src/components/PhotoGallery.tsx` - Photo gallery with download/delete functionality
- Detection runs every 3rd frame (throttled for performance)
- Canvas: 640x480, willReadFrequently optimization

### State Management
- Use **refs** for render loop values (avoid re-renders)
- Props: `selectedEffect`, `isMirrored`, `onPhotoCapture` (optional callback)
- State: `isModelLoaded`, `faceDetected`, `fps`, `photos` (array of data URLs)

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
```bash
npm run dev      # Vite dev server
npm run build    # TypeScript + Vite build
npm run lint     # ESLint check
npm run preview  # Preview production build
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

## Security Notes
- Camera permission required
- No data sent to server (100% client-side)
- No facial data stored (photos only in memory, cleared on refresh)
