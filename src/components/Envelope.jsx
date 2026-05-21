import { useState, useEffect } from 'react';

export function Envelope({ winner, onDone, playWoosh, playOpen, playFanfare }) {
  const [phase, setPhase] = useState('hidden');
  // phases: hidden → appearing → open → revealing → done

  useEffect(() => {
    if (!winner) return;

    playWoosh?.();

    const t1 = setTimeout(() => setPhase('appearing'), 40);
    const t2 = setTimeout(() => { playOpen?.(); setPhase('open'); }, 700);
    const t3 = setTimeout(() => setPhase('revealing'), 1700);
    const t4 = setTimeout(() => { playFanfare?.(); }, 1900);
    const t5 = setTimeout(() => { setPhase('done'); onDone?.(); }, 2400);

    return () => [t1,t2,t3,t4,t5].forEach(clearTimeout);
  }, [winner]);

  if (phase === 'hidden') return null;

  const isHannah = winner === 'Hannah';

  return (
    <div className="envelope-overlay">
      <div className={`envelope-scene ${phase}`}>

        {/* ── Envelope body ── */}
        <div className="env-body">

          {/* Bottom-left fold */}
          <div className="env-fold env-fold-bl" />
          {/* Bottom-right fold */}
          <div className="env-fold env-fold-br" />

          {/* Interior (visible when flap is open) */}
          <div className="env-interior">
            {(phase === 'revealing' || phase === 'done') && (
              <div className={`env-name ${isHannah ? 'hannah' : 'elvie'}`}>
                {winner}!
              </div>
            )}
          </div>

          {/* Flap (folds upward) */}
          <div className="env-flap">
            <div className="env-seal">R</div>
          </div>
        </div>

        {/* Stars / sparkles around envelope on reveal */}
        {(phase === 'revealing' || phase === 'done') && (
          <div className="env-sparkles">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`sparkle sparkle-${i}`}>✦</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
