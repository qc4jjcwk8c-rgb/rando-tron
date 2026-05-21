import { useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Wheel }         from './components/Wheel';
import { ModeToggle }    from './components/ModeToggle';
import { ResultDisplay } from './components/ResultDisplay';
import { Envelope }      from './components/Envelope';
import { Stats }         from './components/Stats';
import { useSound }      from './hooks/useSound';
import { useStats }      from './hooks/useStats';
import './App.css';

const HANNAH_COLORS = ['#FF1A6E','#FF4187','#FFD700','#FF69B4','#ffffff'];
const ELVIE_COLORS  = ['#6600FF','#7B2BFF','#FFD700','#00BFFF','#ffffff'];

function fireConfetti(winner) {
  const colors = winner === 'Hannah' ? HANNAH_COLORS : ELVIE_COLORS;
  const opts = { particleCount: 100, spread: 65, colors, startVelocity: 48 };
  confetti({ ...opts, angle: 55,  origin: { x: 0,    y: 0.65 } });
  confetti({ ...opts, angle: 125, origin: { x: 1,    y: 0.65 } });
  setTimeout(() => {
    confetti({ ...opts, particleCount: 70, angle: 75,  origin: { x: 0.15, y: 0.7 } });
    confetti({ ...opts, particleCount: 70, angle: 105, origin: { x: 0.85, y: 0.7 } });
  }, 380);
}

export default function App() {
  const [mode, setMode]             = useState('normal');
  const [spinning, setSpinning]     = useState(false);
  const [winner, setWinner]         = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [showEnvelope, setShowEnvelope] = useState(false);

  const { stats, addSpin } = useStats();
  const {
    playTick, startTension, stopTension,
    playEnvelopeWoosh, playEnvelopeOpen, playFanfare, wake,
  } = useSound();

  const handleSpin = useCallback(() => {
    wake();
    const picked = Math.random() < 0.5 ? 'Hannah' : 'Elvie';
    setWinner(picked);
    setShowResult(false);
    setShowEnvelope(false);
    setSpinning(true);
    if (mode === 'dramatic') startTension();
  }, [mode, startTension, wake]);

  const handleTick = useCallback((progress) => {
    playTick(progress);
  }, [playTick]);

  // Fired at 82% of dramatic spin when blur begins — nothing extra needed now
  const handleBlurStart = useCallback(() => {}, []);

  const handleComplete = useCallback((w) => {
    setSpinning(false);
    addSpin(w);

    if (mode === 'dramatic') {
      stopTension(0.8);
      setShowEnvelope(true);   // envelope takes over from here
    } else {
      setShowResult(true);
      playFanfare();
      fireConfetti(w);
    }
  }, [mode, addSpin, stopTension, playFanfare]);

  // Called by Envelope when reveal is complete
  const handleEnvelopeDone = useCallback(() => {
    if (winner) fireConfetti(winner);
  }, [winner]);

  const handleModeChange = (m) => {
    if (spinning) return;
    setMode(m);
    setShowResult(false);
    setShowEnvelope(false);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Rando-tron</h1>
        <p className="app-subtitle">The official family dispute resolver</p>
      </header>

      <ModeToggle mode={mode} onChange={handleModeChange} />

      <div className="wheel-section">
        <Wheel
          spinning={spinning}
          winner={winner}
          mode={mode}
          onComplete={handleComplete}
          onTick={handleTick}
          onBlurStart={handleBlurStart}
        />

        {/* Envelope overlays the wheel in dramatic mode */}
        {showEnvelope && winner && (
          <Envelope
            winner={winner}
            onDone={handleEnvelopeDone}
            playWoosh={playEnvelopeWoosh}
            playOpen={playEnvelopeOpen}
            playFanfare={playFanfare}
          />
        )}
      </div>

      <button
        className={`spin-btn ${spinning ? 'spinning' : ''} ${mode === 'dramatic' ? 'dramatic-spin' : ''}`}
        onClick={handleSpin}
        disabled={spinning}
      >
        {spinning ? (mode === 'dramatic' ? '🎭' : '…') : 'SPIN!'}
      </button>

      {/* Normal mode result only */}
      <ResultDisplay winner={winner} visible={showResult} />

      <Stats stats={stats} />
    </div>
  );
}
