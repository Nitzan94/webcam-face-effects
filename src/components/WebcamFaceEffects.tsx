import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

interface WebcamFaceEffectsProps {
  selectedEffect: string;
}

export default function WebcamFaceEffects({ selectedEffect }: WebcamFaceEffectsProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [fps, setFps] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const detectorRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const animationFrameRef = useRef<number>();

  // Initialize webcam
  useEffect(() => {
    async function setupWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          // Wait for video to be ready
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().then(() => {
              console.log('Video playing successfully');
              setIsVideoReady(true);
            }).catch(err => {
              console.error('Error playing video:', err);
            });
          };
        }
      } catch (error) {
        console.error('Error accessing webcam:', error);
        alert('Cannot access webcam. Please grant camera permissions.');
      }
    }

    setupWebcam();

    return () => {
      // Cleanup: stop webcam
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Load FaceMesh model
  useEffect(() => {
    async function loadModel() {
      try {
        console.log('Loading TensorFlow.js...');
        await tf.ready();
        await tf.setBackend('webgl');

        console.log('Loading FaceMesh model...');
        const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
        const detectorConfig: faceLandmarksDetection.MediaPipeFaceMeshTfjsModelConfig = {
          runtime: 'tfjs',
          maxFaces: 1,
        };

        const detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
        detectorRef.current = detector;

        console.log('FaceMesh model loaded successfully!');
        console.log('Warming up model...');

        // Warmup: Create a dummy canvas to test the model
        const dummyCanvas = document.createElement('canvas');
        dummyCanvas.width = 640;
        dummyCanvas.height = 480;
        const dummyCtx = dummyCanvas.getContext('2d');
        if (dummyCtx) {
          dummyCtx.fillStyle = '#808080';
          dummyCtx.fillRect(0, 0, 640, 480);
          try {
            await detector.estimateFaces(dummyCanvas);
            console.log('Model warmup complete!');
          } catch (err) {
            console.warn('Warmup failed, but continuing:', err);
          }
        }

        setIsModelLoaded(true);
      } catch (error) {
        console.error('Error loading model:', error);
        alert('Failed to load face detection model. Please refresh the page.');
      }
    }

    loadModel();
  }, []);

  // Main detection and rendering loop
  useEffect(() => {
    if (!isModelLoaded || !isVideoReady || !videoRef.current || !canvasRef.current || !detectorRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) return;

    // Wait for video to have dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log('Waiting for video dimensions...');
      return;
    }

    // Set canvas size to match video - CRITICAL: Set both attributes AND style
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Force CSS to match actual canvas size (no scaling!)
    canvas.style.width = `${video.videoWidth}px`;
    canvas.style.height = `${video.videoHeight}px`;

    console.log('Canvas initialized:', canvas.width, 'x', canvas.height);
    console.log('Canvas CSS size:', canvas.style.width, 'x', canvas.style.height);

    let lastTime = performance.now();
    let frameCount = 0;

    let isDetecting = false;
    let lastFace: faceLandmarksDetection.Face | null = null;

    async function detectAndRender() {
      if (!video || !canvas || !ctx || !detectorRef.current) return;
      if (!video.videoWidth || !video.videoHeight) return;

      // Check if video is actually playing
      if (video.paused || video.ended) {
        console.warn('Video is paused or ended');
        animationFrameRef.current = requestAnimationFrame(detectAndRender);
        return;
      }

      // Draw video frame FIRST
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Only detect if not already detecting (throttle)
      if (!isDetecting) {
        isDetecting = true;

        try {
          // Create a temporary canvas with the current frame
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = video.videoWidth;
          tempCanvas.height = video.videoHeight;
          const tempCtx = tempCanvas.getContext('2d');

          if (!tempCtx) {
            isDetecting = false;
            animationFrameRef.current = requestAnimationFrame(detectAndRender);
            return;
          }

          tempCtx.drawImage(video, 0, 0);

          // Detect faces from canvas instead of video element
          const predictions = await detectorRef.current.estimateFaces(tempCanvas);

          if (predictions.length > 0) {
            setFaceDetected(true);
            lastFace = predictions[0];
          } else {
            setFaceDetected(false);
            lastFace = null;
          }
        } catch (error) {
          console.error('Detection error:', error);
        } finally {
          isDetecting = false;
        }
      }

      // CRITICAL: Draw effects AFTER video but BEFORE next frame
      // Always draw test indicator first
      ctx.fillStyle = 'rgba(0, 255, 0, 0.9)';
      ctx.fillRect(10, 10, 30, 30);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px Arial';
      ctx.shadowBlur = 3;
      ctx.shadowColor = 'black';
      ctx.fillText(`Effect: ${selectedEffect}`, 50, 30);
      ctx.shadowBlur = 0;

      // Draw effects if face detected and effect selected
      if (lastFace && selectedEffect !== 'none') {
        try {
          applyEffect(ctx, lastFace, selectedEffect, canvas.width, canvas.height);
        } catch (err) {
          console.error('Error applying effect:', err);
        }
      }

      // Calculate FPS
      frameCount++;
      const currentTime = performance.now();
      if (currentTime - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = currentTime;
      }

      // Continue loop
      animationFrameRef.current = requestAnimationFrame(detectAndRender);
    }

    detectAndRender();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isModelLoaded, isVideoReady, selectedEffect]);

  // Apply effects based on face landmarks
  function applyEffect(
    ctx: CanvasRenderingContext2D,
    face: faceLandmarksDetection.Face,
    effect: string,
    width: number,
    height: number
  ) {
    if (!face.keypoints || face.keypoints.length === 0) {
      console.error('No keypoints found in face');
      return;
    }

    const keypoints = face.keypoints;

    // Calculate bounding box from keypoints if not provided
    let box = face.box;
    if (!box) {
      const xs = keypoints.map(p => p.x);
      const ys = keypoints.map(p => p.y);
      const xMin = Math.min(...xs);
      const xMax = Math.max(...xs);
      const yMin = Math.min(...ys);
      const yMax = Math.max(...ys);
      box = {
        xMin,
        yMin,
        xMax,
        yMax,
        width: xMax - xMin,
        height: yMax - yMin
      };
    }

    switch (effect) {
      case 'landmarks':
        drawLandmarks(ctx, keypoints);
        break;
      case 'boundingBox':
        drawBoundingBox(ctx, box);
        break;
      case 'sunglasses':
        drawSunglasses(ctx, keypoints);
        break;
      case 'faceOutline':
        drawFaceOutline(ctx, keypoints);
        break;
      case 'pixelate':
        pixelateFace(ctx, box, width, height);
        break;
      default:
        drawLandmarks(ctx, keypoints);
    }
  }

  // Effect: Draw all landmarks as dots
  function drawLandmarks(ctx: CanvasRenderingContext2D, keypoints: faceLandmarksDetection.Keypoint[]) {
    ctx.fillStyle = '#00ff00';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ff00';

    keypoints.forEach(point => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });

    ctx.shadowBlur = 0;
  }

  // Effect: Draw bounding box
  function drawBoundingBox(ctx: CanvasRenderingContext2D, box: faceLandmarksDetection.BoundingBox) {
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 5;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff0000';
    ctx.strokeRect(box.xMin, box.yMin, box.width, box.height);
    ctx.shadowBlur = 0;

    // Draw text to confirm it's working
    ctx.fillStyle = '#ff0000';
    ctx.font = '20px Arial';
    ctx.fillText('FACE DETECTED', box.xMin, box.yMin - 10);
  }

  // Effect: Draw sunglasses
  function drawSunglasses(ctx: CanvasRenderingContext2D, keypoints: faceLandmarksDetection.Keypoint[]) {
    // Find eye positions (simplified - using key landmarks)
    const leftEye = keypoints[33]; // Left eye center
    const rightEye = keypoints[263]; // Right eye center

    if (!leftEye || !rightEye) return;

    const eyeDistance = Math.sqrt(
      Math.pow(rightEye.x - leftEye.x, 2) + Math.pow(rightEye.y - leftEye.y, 2)
    );

    // Draw simple sunglasses
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;

    // Left lens
    ctx.beginPath();
    ctx.ellipse(leftEye.x, leftEye.y, eyeDistance * 0.3, eyeDistance * 0.25, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Right lens
    ctx.beginPath();
    ctx.ellipse(rightEye.x, rightEye.y, eyeDistance * 0.3, eyeDistance * 0.25, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Bridge
    ctx.beginPath();
    ctx.moveTo(leftEye.x + eyeDistance * 0.3, leftEye.y);
    ctx.lineTo(rightEye.x - eyeDistance * 0.3, rightEye.y);
    ctx.stroke();
  }

  // Effect: Draw face outline glow
  function drawFaceOutline(ctx: CanvasRenderingContext2D, keypoints: faceLandmarksDetection.Keypoint[]) {
    // Use face oval keypoints (silhouette)
    const faceOval = keypoints.slice(0, 36); // Approximate face contour

    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00ffff';

    ctx.beginPath();
    faceOval.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.closePath();
    ctx.stroke();

    // Reset shadow
    ctx.shadowBlur = 0;
  }

  // Effect: Pixelate face area
  function pixelateFace(
    ctx: CanvasRenderingContext2D,
    box: faceLandmarksDetection.BoundingBox,
    canvasWidth: number,
    canvasHeight: number
  ) {
    const pixelSize = 10;
    const { xMin, yMin, width, height } = box;

    // Get image data
    const imageData = ctx.getImageData(xMin, yMin, width, height);

    // Pixelate
    for (let y = 0; y < height; y += pixelSize) {
      for (let x = 0; x < width; x += pixelSize) {
        const pixelIndex = (y * width + x) * 4;
        const r = imageData.data[pixelIndex];
        const g = imageData.data[pixelIndex + 1];
        const b = imageData.data[pixelIndex + 2];

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(xMin + x, yMin + y, pixelSize, pixelSize);
      }
    }
  }

  return (
    <div className="webcam-container">
      <div className="video-wrapper">
        <video ref={videoRef} style={{ display: 'none' }} playsInline />
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            maxWidth: '100%',
            height: 'auto',
            imageRendering: 'auto'
          }}
        />
      </div>

      <div className="status-bar">
        <div className={`status-indicator ${isModelLoaded ? 'loaded' : 'loading'}`}>
          {isModelLoaded ? '✓ Model Loaded' : '⌛ Loading Model...'}
        </div>
        <div className={`status-indicator ${faceDetected ? 'detected' : 'not-detected'}`}>
          {faceDetected ? '👤 Face Detected' : '❌ No Face'}
        </div>
        <div className="fps-counter">FPS: {fps}</div>
      </div>
    </div>
  );
}
