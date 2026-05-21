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

const AUDIO_MODES = [
  { id: 'drone',     label: '🎵',  name: 'Drone'      },
  { id: 'crowd',     label: '👥',  name: 'Crowd'      },
  { id: 'countdown', label: '🎬',  name: 'Countdown'  },
  { id: 'beeping',   label: '🔔',  name: 'Beeping'    },
];

function fireConfetti(winner) {
  const colors = winner === 'Hannah' ? HANNAH_COLORS : ELVIE_COLORS;
  const opts = { particleCount: 100, spread: 65, colors, startVelocity: 48 };
  confetti({ ...opts, angle: 55,  origin: { x: 0,   y: 0.65 } });
  confetti({ ...opts, angle: 125, origin: { x: 1,   y: 0.65 } });
  setTimeout(() => {
    confetti({ ...opts, particleCount: 70, angle: 75,  origin: { x: 0.15, y: 0.7 } });
    confetti({ ...opts, particleCount: 70, angle: 105, origin: { x: 0.85, y: 0.7 } });
  }, 380);
}

export default function App() {
  const [mode, setMode]             = useState('normal');
  const [audioMode, setAudioMode]   = useState('drone');
  const [spinning, setSpinning]     = useState(false);
  const [winner, setWinner]         = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [showEnvelope, setShowEnvelope] = useState(false);

  const { stats, addSpin, resetStats } = useStats();
  const {
    playTick,
    startDrone, startCrowd, startCountdown, startBeeping,
    stopAmbient, stopBeeping,
    playEnvelopeWoosh, playEnvelopeOpen, playFanfare,
    wake,
  } = useSound();

  const startAmbient = useCallback(() => {
    switch (audioMode) {
      case 'drone':     startDrone();     break;
      case 'crowd':     startCrowd();     break;
      case 'countdown': startCountdown(); break;
      case 'beeping':   startBeeping();   break;
    }
  }, [audioMode, startDrone, startCrowd, startCountdown, startBeeping]);

  const stopAllAmbient = useCallback((fade = 0.8) => {
    stopAmbient(fade);
    stopBeeping(); // beeping nodes are separate
  }, [stopAmbient, stopBeeping]);

  const handleSpin = useCallback(() => {
    wake();
    const picked = Math.random() < 0.5 ? 'Hannah' : 'Elvie';
    setWinner(picked);
    setShowResult(false);
    setShowEnvelope(false);
    setSpinning(true);
    if (mode === 'dramatic') startAmbient();
  }, [mode, startAmbient, wake]);

  const handleTick    = useCallback((p) => playTick(p), [playTick]);
  const handleBlurStart = useCallback(() => {}, []);

  const handleComplete = useCallback((w) => {
    setSpinning(false);
    addSpin(w);
    if (mode === 'dramatic') {
      stopAllAmbient(0.7);
      setShowEnvelope(true);
    } else {
      setShowResult(true);
      playFanfare();
      fireConfetti(w);
    }
  }, [mode, addSpin, stopAllAmbient, playFanfare]);

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

      {/* Audio mode picker — only visible in Dramatic mode */}
      {mode === 'dramatic' && (
        <div className="audio-picker">
          <span className="audio-picker-label">Audio</span>
          <div className="audio-picker-btns">
            {AUDIO_MODES.map(({ id, label, name }) => (
              <button
                key={id}
                className={`audio-btn ${audioMode === id ? 'active' : ''}`}
                onClick={() => !spinning && setAudioMode(id)}
                disabled={spinning}
              >
                <span className="audio-icon">{label}</span>
                <span className="audio-name">{name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="wheel-section">
        <Wheel
          spinning={spinning}
          winner={winner}
          mode={mode}
          onComplete={handleComplete}
          onTick={handleTick}
          onBlurStart={handleBlurStart}
        />
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

      <ResultDisplay winner={winner} visible={showResult} />

      <Stats stats={stats} onReset={resetStats} />
    </div>
  );
}
