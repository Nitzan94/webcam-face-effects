import { useState } from 'react';
import WebcamFaceEffectsSimple from './components/WebcamFaceEffectsSimple';
import './App.css';

function App() {
  const [selectedEffect, setSelectedEffect] = useState('none');
  const [isMirrored, setIsMirrored] = useState(true);

  const effects = [
    { id: 'none', name: '⭕ None', description: 'No effect (default)' },
    { id: 'landmarks', name: '🎯 Show Landmarks', description: 'Display face tracking points' },
    { id: 'boundingBox', name: '📦 Bounding Box', description: 'Show face detection box' },
    { id: 'sunglasses', name: '🕶️ Sunglasses', description: 'Cool sunglasses overlay' },
    { id: 'faceOutline', name: '✨ Neon Outline', description: 'Glowing face contour' },
    { id: 'pixelate', name: '🟦 Pixelate', description: 'Pixelated face effect' },
    { id: 'glowUp', name: '💎 Glow Up 3.0', description: 'Diamond skin with cosmic sparkles on blink' },
    { id: 'glowRed', name: '❤️ Red Glow', description: 'Red glow with fire sparkles on blink' },
    { id: 'lipstick', name: '💄 Lipstick', description: 'Red lipstick on your lips' },
  ];

  const handleEffectChange = (effectId: string) => {
    console.log('Effect changed to:', effectId);
    // Toggle: if clicking same effect, turn it off
    if (selectedEffect === effectId && effectId !== 'none') {
      setSelectedEffect('none');
    } else {
      setSelectedEffect(effectId);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎭 Webcam Face Effects</h1>
        <p>Real-time face detection with TensorFlow.js</p>
      </header>

      <main className="app-main">
        <WebcamFaceEffectsSimple selectedEffect={selectedEffect} isMirrored={isMirrored} />

        <div className="mirror-control">
          <label>
            <input
              type="checkbox"
              checked={isMirrored}
              onChange={(e) => setIsMirrored(e.target.checked)}
            />
            🪞 Mirror Video
          </label>
        </div>

        <div className="effects-selector">
          <h2>Select Effect:</h2>
          <div className="effects-grid">
            {effects.map(effect => (
              <button
                key={effect.id}
                className={`effect-button ${selectedEffect === effect.id ? 'active' : ''}`}
                onClick={() => handleEffectChange(effect.id)}
                title={effect.description}
              >
                <span className="effect-name">{effect.name}</span>
              </button>
            ))}
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p>Built with React + Vite + TensorFlow.js FaceMesh</p>
      </footer>
    </div>
  );
}

export default App;
