// Normal-mode result only — dramatic mode uses the Envelope component
export function ResultDisplay({ winner, visible }) {
  if (!winner || !visible) return null;

  return (
    <div className={`result-normal result-${winner.toLowerCase()}`}>
      <div className="result-name-flash">{winner}!</div>
      <div className="result-sub-text">wins this spin!</div>
    </div>
  );
}
