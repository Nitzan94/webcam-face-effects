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

    // Particle system for glowUp effect
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      size: number;
      color: string;
    }
    let particles: Particle[] = [];
    let lastBlinkTime = 0;

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

        case 'glowUp':
          // 1. Diamond-like glow on skin - BRIGHT and VISIBLE
          const xs3 = keypoints.map((p: any) => p.x);
          const ys3 = keypoints.map((p: any) => p.y);
          const xMin3 = Math.min(...xs3);
          const xMax3 = Math.max(...xs3);
          const yMin3 = Math.min(...ys3);
          const yMax3 = Math.max(...ys3);
          const centerX = (xMin3 + xMax3) / 2;
          const centerY = (yMin3 + yMax3) / 2;

          // Apply SUBTLE glowing overlay with radial gradient
          const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, (xMax3 - xMin3) / 1.5);
          gradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
          gradient.addColorStop(0.4, 'rgba(255, 223, 186, 0.2)');
          gradient.addColorStop(0.7, 'rgba(255, 192, 203, 0.15)');
          gradient.addColorStop(1, 'rgba(255, 192, 203, 0)');

          ctx.fillStyle = gradient;
          ctx.shadowBlur = 25;
          ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
          ctx.fillRect(xMin3, yMin3, xMax3 - xMin3, yMax3 - yMin3);
          ctx.shadowBlur = 0;

          // 2. BRIGHT Sparkle highlights - 3 stars above the head
          const forehead = keypoints[10];

          if (forehead) {
            const headTop = yMin3; // Top of the head
            const headCenterX = centerX;
            const starSpacing = 40;

            // 3 stars above the head in a horizontal line
            const sparklePositions = [
              { x: headCenterX - starSpacing, y: headTop - 30 },  // Left star
              { x: headCenterX, y: headTop - 50 },                // Center star (higher)
              { x: headCenterX + starSpacing, y: headTop - 30 }   // Right star
            ];

            sparklePositions.forEach((pos) => {
              const sparkleGradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 30);
              sparkleGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
              sparkleGradient.addColorStop(0.3, 'rgba(255, 223, 186, 0.8)');
              sparkleGradient.addColorStop(0.6, 'rgba(255, 192, 203, 0.4)');
              sparkleGradient.addColorStop(1, 'rgba(255, 192, 203, 0)');

              ctx.shadowBlur = 20;
              ctx.shadowColor = '#ffffff';
              ctx.fillStyle = sparkleGradient;
              ctx.beginPath();
              ctx.arc(pos.x, pos.y, 30, 0, 2 * Math.PI);
              ctx.fill();
              ctx.shadowBlur = 0;
            });
          }

          // 3. Eye blink detection and particle burst
          const leftEyeTop = keypoints[159];
          const leftEyeBottom = keypoints[145];
          const rightEyeTop = keypoints[386];
          const rightEyeBottom = keypoints[374];

          if (leftEyeTop && leftEyeBottom && rightEyeTop && rightEyeBottom) {
            const leftEyeHeight = Math.abs(leftEyeTop.y - leftEyeBottom.y);
            const rightEyeHeight = Math.abs(rightEyeTop.y - rightEyeBottom.y);
            const avgEyeHeight = (leftEyeHeight + rightEyeHeight) / 2;

            // Detect blink (eyes are closed if height is very small)
            const isBlinking = avgEyeHeight < 5;
            const now = performance.now();

            if (isBlinking && (now - lastBlinkTime) > 300) {
              lastBlinkTime = now;

              // Create particle burst around eyes
              const eyePoints = [keypoints[33], keypoints[263]]; // Left and right eye centers
              eyePoints.forEach((eye: any) => {
                if (!eye) return;

                // Create 20 particles per eye
                for (let i = 0; i < 20; i++) {
                  const angle = Math.random() * Math.PI * 2;
                  const speed = 2 + Math.random() * 3;
                  const colors = ['#ffffff', '#ffd700', '#ffeb3b', '#ffc0cb', '#e0bbff'];

                  particles.push({
                    x: eye.x,
                    y: eye.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 1.0,
                    size: 2 + Math.random() * 3,
                    color: colors[Math.floor(Math.random() * colors.length)]
                  });
                }
              });
            }
          }

          // 4. Update and draw particles
          particles = particles.filter(p => p.life > 0);
          particles.forEach((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1; // Gravity
            p.life -= 0.02;

            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = p.color;

            // Draw star shape
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
              const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
              const radius = i % 2 === 0 ? p.size : p.size / 2;
              const px = p.x + Math.cos(angle) * radius;
              const py = p.y + Math.sin(angle) * radius;
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
          });

          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
          break;

        case 'glowRed':
          // 1. RED glowing overlay with radial gradient
          const xs4 = keypoints.map((p: any) => p.x);
          const ys4 = keypoints.map((p: any) => p.y);
          const xMin4 = Math.min(...xs4);
          const xMax4 = Math.max(...xs4);
          const yMin4 = Math.min(...ys4);
          const yMax4 = Math.max(...ys4);
          const centerX4 = (xMin4 + xMax4) / 2;
          const centerY4 = (yMin4 + yMax4) / 2;

          // Apply RED glowing overlay
          const gradientRed = ctx.createRadialGradient(centerX4, centerY4, 0, centerX4, centerY4, (xMax4 - xMin4) / 1.5);
          gradientRed.addColorStop(0, 'rgba(255, 100, 100, 0.25)');
          gradientRed.addColorStop(0.4, 'rgba(255, 60, 60, 0.2)');
          gradientRed.addColorStop(0.7, 'rgba(255, 0, 0, 0.15)');
          gradientRed.addColorStop(1, 'rgba(255, 0, 0, 0)');

          ctx.fillStyle = gradientRed;
          ctx.shadowBlur = 25;
          ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
          ctx.fillRect(xMin4, yMin4, xMax4 - xMin4, yMax4 - yMin4);
          ctx.shadowBlur = 0;

          // 2. RED/ORANGE stars above the head
          const foreheadRed = keypoints[10];

          if (foreheadRed) {
            const headTopRed = yMin4;
            const headCenterXRed = centerX4;
            const starSpacingRed = 40;

            const sparklePositionsRed = [
              { x: headCenterXRed - starSpacingRed, y: headTopRed - 30 },
              { x: headCenterXRed, y: headTopRed - 50 },
              { x: headCenterXRed + starSpacingRed, y: headTopRed - 30 }
            ];

            sparklePositionsRed.forEach((pos) => {
              const sparkleGradientRed = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 30);
              sparkleGradientRed.addColorStop(0, 'rgba(255, 100, 0, 1)');
              sparkleGradientRed.addColorStop(0.3, 'rgba(255, 50, 0, 0.8)');
              sparkleGradientRed.addColorStop(0.6, 'rgba(255, 0, 0, 0.4)');
              sparkleGradientRed.addColorStop(1, 'rgba(255, 0, 0, 0)');

              ctx.shadowBlur = 20;
              ctx.shadowColor = '#ff3300';
              ctx.fillStyle = sparkleGradientRed;
              ctx.beginPath();
              ctx.arc(pos.x, pos.y, 30, 0, 2 * Math.PI);
              ctx.fill();
              ctx.shadowBlur = 0;
            });
          }

          // 3. Eye blink detection for RED fire particles
          const leftEyeTopRed = keypoints[159];
          const leftEyeBottomRed = keypoints[145];
          const rightEyeTopRed = keypoints[386];
          const rightEyeBottomRed = keypoints[374];

          if (leftEyeTopRed && leftEyeBottomRed && rightEyeTopRed && rightEyeBottomRed) {
            const leftEyeHeightRed = Math.abs(leftEyeTopRed.y - leftEyeBottomRed.y);
            const rightEyeHeightRed = Math.abs(rightEyeTopRed.y - rightEyeBottomRed.y);
            const avgEyeHeightRed = (leftEyeHeightRed + rightEyeHeightRed) / 2;

            const isBlinkingRed = avgEyeHeightRed < 5;
            const nowRed = performance.now();

            if (isBlinkingRed && (nowRed - lastBlinkTime) > 300) {
              lastBlinkTime = nowRed;

              const eyePointsRed = [keypoints[33], keypoints[263]];
              eyePointsRed.forEach((eye: any) => {
                if (!eye) return;

                for (let i = 0; i < 20; i++) {
                  const angle = Math.random() * Math.PI * 2;
                  const speed = 2 + Math.random() * 3;
                  const colorsRed = ['#ff0000', '#ff3300', '#ff6600', '#ff9900', '#ffcc00'];

                  particles.push({
                    x: eye.x,
                    y: eye.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 1.0,
                    size: 2 + Math.random() * 3,
                    color: colorsRed[Math.floor(Math.random() * colorsRed.length)]
                  });
                }
              });
            }
          }

          // 4. Update and draw RED particles
          particles = particles.filter(p => p.life > 0);
          particles.forEach((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1;
            p.life -= 0.02;

            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = p.color;

            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
              const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
              const radius = i % 2 === 0 ? p.size : p.size / 2;
              const px = p.x + Math.cos(angle) * radius;
              const py = p.y + Math.sin(angle) * radius;
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
          });

          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
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
