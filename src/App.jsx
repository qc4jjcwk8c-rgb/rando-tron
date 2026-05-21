import { useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Wheel } from './components/Wheel';
import { ModeToggle } from './components/ModeToggle';
import { ResultDisplay } from './components/ResultDisplay';
import { Stats } from './components/Stats';
import { useSound } from './hooks/useSound';
import { useStats } from './hooks/useStats';
import './App.css';

const HANNAH_COLORS = ['#FF5FA0', '#FF3D85', '#FFD700', '#FF69B4', '#ffffff'];
const ELVIE_COLORS  = ['#9B59FF', '#7B3FDF', '#FFD700', '#00BFFF', '#ffffff'];

function fireConfetti(winner) {
  const colors = winner === 'Hannah' ? HANNAH_COLORS : ELVIE_COLORS;
  const opts = { particleCount: 90, spread: 60, colors, startVelocity: 45 };
  confetti({ ...opts, angle: 55,  origin: { x: 0,    y: 0.65 } });
  confetti({ ...opts, angle: 125, origin: { x: 1,    y: 0.65 } });
  setTimeout(() => {
    confetti({ ...opts, particleCount: 60, angle: 75,  origin: { x: 0.15, y: 0.7 } });
    confetti({ ...opts, particleCount: 60, angle: 105, origin: { x: 0.85, y: 0.7 } });
  }, 400);
}

export default function App() {
  const [mode, setMode]         = useState('normal');
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner]     = useState(null);
  const [showResult, setShowResult] = useState(false);
  const { stats, addSpin, resetStats } = useStats();
  const { playTick, startCheering, stopCheering, playFanfare, wake } = useSound();

  const handleSpin = useCallback(() => {
    wake();
    const picked = Math.random() < 0.5 ? 'Hannah' : 'Elvie';
    setWinner(picked);
    setShowResult(false);
    setSpinning(true);
    if (mode === 'dramatic') startCheering();
  }, [mode, startCheering, wake]);

  const handleTick = useCallback((progress) => {
    playTick(progress);
  }, [playTick]);

  const handleDramaticMoment = useCallback((w) => {
    fireConfetti(w);
  }, []);

  const handleComplete = useCallback((w) => {
    setSpinning(false);
    setShowResult(true);
    addSpin(w);
    if (mode === 'dramatic') {
      stopCheering(1.2);
      setTimeout(() => fireConfetti(w), 600);
      setTimeout(() => playFanfare(), 1400);
    } else {
      playFanfare();
      fireConfetti(w);
    }
  }, [mode, addSpin, stopCheering, playFanfare]);

  const handleModeChange = (m) => {
    if (spinning) return;
    setMode(m);
    setShowResult(false);
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
          onDramaticMoment={handleDramaticMoment}
        />
      </div>

      <button
        className={`spin-btn ${spinning ? 'spinning' : ''} ${mode === 'dramatic' ? 'dramatic-spin' : ''}`}
        onClick={handleSpin}
        disabled={spinning}
      >
        {spinning ? (mode === 'dramatic' ? '🎭' : '...') : 'SPIN!'}
      </button>

      <ResultDisplay winner={winner} mode={mode} visible={showResult} />

      <Stats stats={stats} onReset={resetStats} />
    </div>
  );
}
