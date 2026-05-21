import { useState, useRef } from 'react';

export function Stats({ stats, onReset }) {
  const { total, hannahCount, elvieCount, last5, streak } = stats;
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef(null);

  const pct     = (n) => (total ? Math.round((n / total) * 100) : 0);
  const initial = (name) => name[0];

  const handleResetClick = () => {
    if (!confirming) {
      // First tap — enter confirm state, auto-cancel after 3 s
      setConfirming(true);
      timerRef.current = setTimeout(() => setConfirming(false), 3000);
    } else {
      // Second tap — confirmed, reset
      clearTimeout(timerRef.current);
      setConfirming(false);
      onReset();
    }
  };

  return (
    <div className="stats-section">
      <div className="stats-title-row">
        <h2 className="stats-title">Statistics</h2>
        <button
          className={`reset-btn ${confirming ? 'confirming' : ''}`}
          onClick={handleResetClick}
          disabled={total === 0}
        >
          {confirming ? 'Tap again to confirm' : 'Reset'}
        </button>
      </div>

      <div className="stats-card">
        <div className="stats-label">Last 5 spins</div>
        <div className="last5-row">
          {last5.length === 0 ? (
            <span className="stats-empty">No spins yet</span>
          ) : (
            last5.map((s, i) => (
              <span
                key={i}
                className={`last5-chip ${s.winner === 'Hannah' ? 'hannah' : 'elvie'}`}
              >
                {initial(s.winner)}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="stats-card">
        <div className="stats-label">All-time record</div>
        <div className="record-row">
          <span className="record-name hannah-text">Hannah</span>
          <span className="record-count">{hannahCount}</span>
          <span className="record-pct">({pct(hannahCount)}%)</span>
        </div>
        <div className="record-row">
          <span className="record-name elvie-text">Elvie</span>
          <span className="record-count">{elvieCount}</span>
          <span className="record-pct">({pct(elvieCount)}%)</span>
        </div>
      </div>

      <div className="stats-card">
        <div className="stats-label">Longest streak</div>
        {streak.name ? (
          <div className={`streak-row ${streak.name === 'Hannah' ? 'hannah-text' : 'elvie-text'}`}>
            {streak.name} — {streak.count} in a row
          </div>
        ) : (
          <div className="stats-empty">No spins yet</div>
        )}
      </div>

    </div>
  );
}
