import { useEffect, useState, useRef } from 'react';
import { getDramaticMessage } from '../utils/messages';

export function ResultDisplay({ winner, mode, visible }) {
  const [parts, setParts] = useState([]);
  const [shown, setShown] = useState([]);
  const timersRef = useRef([]);

  const loser = winner === 'Hannah' ? 'Elvie' : 'Hannah';

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setShown([]);
    setParts([]);

    if (!winner || !visible) return;

    if (mode === 'normal') {
      setParts([{ text: winner, highlight: true, delay: 0 }]);
      setShown([0]);
      return;
    }

    const message = getDramaticMessage(winner, loser);
    setParts(message);

    message.forEach((part, i) => {
      const id = setTimeout(() => {
        setShown((prev) => [...prev, i]);
      }, part.delay + 200);
      timersRef.current.push(id);
    });

    return () => timersRef.current.forEach(clearTimeout);
  }, [winner, mode, visible]);

  if (!winner || !visible) return null;

  if (mode === 'normal') {
    return (
      <div className={`result-normal result-${winner.toLowerCase()}`}>
        <div className="result-name-flash">{winner}!</div>
        <div className="result-sub-text">wins this spin!</div>
      </div>
    );
  }

  return (
    <div className="result-dramatic">
      {parts.map((part, i) =>
        shown.includes(i) ? (
          <div
            key={i}
            className={`dramatic-line ${part.highlight ? `highlight result-${winner.toLowerCase()}` : ''} ${part.fakeout ? `fakeout result-${loser.toLowerCase()}` : ''}`}
          >
            {part.text}
          </div>
        ) : null
      )}
    </div>
  );
}
