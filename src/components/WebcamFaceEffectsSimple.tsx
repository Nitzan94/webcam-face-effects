import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

interface WebcamFaceEffectsProps {
  selectedEffect: string;
  isMirrored: boolean;
}

export default function WebcamFaceEffectsSimple({ selectedEffect, isMirrored }: WebcamFaceEffectsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const detectorRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const selectedEffectRef = useRef(selectedEffect);
  const isMirroredRef = useRef(isMirrored);

  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [fps, setFps] = useState(0);

  // Update refs when props change
  useEffect(() => {
    selectedEffectRef.current = selectedEffect;
  }, [selectedEffect]);

  useEffect(() => {
    isMirroredRef.current = isMirrored;
  }, [isMirrored]);

  // Setup webcam and model (only once!)
  useEffect(() => {
    let animationId: number;
    let video: HTMLVideoElement;

    async function setup() {
      // Create video element
      video = document.createElement('video');
      video.width = 640;
      video.height = 480;
      videoRef.current = video;

      // Get webcam stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      video.srcObject = stream;
      video.play();

      // Load TensorFlow model
      await tf.ready();
      await tf.setBackend('webgl');

      const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
      const detector = await faceLandmarksDetection.createDetector(model, {
        runtime: 'tfjs',
        maxFaces: 1,
      });
      detectorRef.current = detector;
      setIsModelLoaded(true);

      console.log('Setup complete!');

      // Start render loop
      startRenderLoop();
    }

    let lastFace: any = null;
    let frameCount = 0;
    let lastTime = performance.now();
    let isDetecting = false;

    function startRenderLoop() {
      const canvas = canvasRef.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Set canvas size
      canvas.width = 640;
      canvas.height = 480;

      async function render() {
        if (!ctx || !canvas || !video) return;

        // 1. Draw video frame (with mirror if needed)
        ctx.save();
        if (isMirroredRef.current) {
          ctx.scale(-1, 1);
          ctx.drawImage(video, -640, 0, 640, 480);
        } else {
          ctx.drawImage(video, 0, 0, 640, 480);
        }
        ctx.restore();

        // 2. Detect face (throttled, run every 3rd frame)
        if (frameCount % 3 === 0 && !isDetecting && detectorRef.current) {
          isDetecting = true;

          detectorRef.current.estimateFaces(canvas).then((predictions: any) => {
            if (predictions.length > 0) {
              lastFace = predictions[0];
              setFaceDetected(true);
            } else {
              setFaceDetected(false);
            }
            isDetecting = false;
          }).catch((err: any) => {
            console.error('Detection error:', err);
            isDetecting = false;
          });
        }

        // 3. Draw effects (always use lastFace even if detection skipped this frame)
        const currentEffect = selectedEffectRef.current;
        if (lastFace && currentEffect !== 'none') {
          drawEffect(ctx, lastFace, currentEffect);
        }

        // Calculate FPS
        frameCount++;
        const now = performance.now();
        if (now - lastTime >= 1000) {
          setFps(frameCount);
          frameCount = 0;
          lastTime = now;
        }

        animationId = requestAnimationFrame(render);
      }

      render();
    }

    function drawEffect(ctx: CanvasRenderingContext2D, face: any, effect: string) {
      const keypoints = face.keypoints;
      if (!keypoints || keypoints.length === 0) return;

      switch (effect) {
        case 'landmarks':
          ctx.fillStyle = '#00ff00';
          ctx.shadowBlur = 5;
          ctx.shadowColor = '#00ff00';
          keypoints.forEach((point: any) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
            ctx.fill();
          });
          ctx.shadowBlur = 0;
          break;

        case 'boundingBox':
          const xs = keypoints.map((p: any) => p.x);
          const ys = keypoints.map((p: any) => p.y);
          const xMin = Math.min(...xs);
          const xMax = Math.max(...xs);
          const yMin = Math.min(...ys);
          const yMax = Math.max(...ys);

          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 4;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#ff0000';
          ctx.strokeRect(xMin, yMin, xMax - xMin, yMax - yMin);
          ctx.shadowBlur = 0;

          ctx.fillStyle = '#ff0000';
          ctx.font = 'bold 20px Arial';
          ctx.fillText('FACE DETECTED', xMin, yMin - 10);
          break;

        case 'sunglasses':
          const leftEye = keypoints[33];
          const rightEye = keypoints[263];
          if (leftEye && rightEye) {
            const eyeDist = Math.sqrt(
              Math.pow(rightEye.x - leftEye.x, 2) +
              Math.pow(rightEye.y - leftEye.y, 2)
            );

            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 4;

            // Left lens
            ctx.beginPath();
            ctx.ellipse(leftEye.x, leftEye.y, eyeDist * 0.35, eyeDist * 0.28, 0, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();

            // Right lens
            ctx.beginPath();
            ctx.ellipse(rightEye.x, rightEye.y, eyeDist * 0.35, eyeDist * 0.28, 0, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();

            // Bridge
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(leftEye.x + eyeDist * 0.35, leftEye.y);
            ctx.lineTo(rightEye.x - eyeDist * 0.35, rightEye.y);
            ctx.stroke();
          }
          break;

        case 'faceOutline':
          ctx.strokeStyle = '#00ffff';
          ctx.lineWidth = 4;
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#00ffff';

          ctx.beginPath();
          keypoints.slice(0, 36).forEach((point: any, i: number) => {
            if (i === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
          });
          ctx.closePath();
          ctx.stroke();
          ctx.shadowBlur = 0;
          break;

        case 'pixelate':
          const xs2 = keypoints.map((p: any) => p.x);
          const ys2 = keypoints.map((p: any) => p.y);
          const xMin2 = Math.min(...xs2);
          const xMax2 = Math.max(...xs2);
          const yMin2 = Math.min(...ys2);
          const yMax2 = Math.max(...ys2);
          const width = xMax2 - xMin2;
          const height = yMax2 - yMin2;

          const pixelSize = 12;

          try {
            const imageData = ctx.getImageData(xMin2, yMin2, width, height);

            for (let y = 0; y < height; y += pixelSize) {
              for (let x = 0; x < width; x += pixelSize) {
                const pixelIndex = (Math.floor(y) * Math.floor(width) + Math.floor(x)) * 4;
                const r = imageData.data[pixelIndex] || 0;
                const g = imageData.data[pixelIndex + 1] || 0;
                const b = imageData.data[pixelIndex + 2] || 0;

                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fillRect(xMin2 + x, yMin2 + y, pixelSize, pixelSize);
              }
            }
          } catch (err) {
            console.error('Pixelate error:', err);
          }
          break;
      }
    }

    setup();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // Run only once!

  return (
    <div className="webcam-container">
      <div className="video-wrapper">
        <canvas
          ref={canvasRef}
          style={{
            width: '640px',
            height: '480px',
            display: 'block',
            maxWidth: '100%',
            height: 'auto'
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
