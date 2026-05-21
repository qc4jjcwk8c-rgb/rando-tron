export function ModeToggle({ mode, onChange }) {
  return (
    <div className="mode-toggle">
      <button
        className={`mode-btn ${mode === 'normal' ? 'active' : ''}`}
        onClick={() => onChange('normal')}
      >
        Normal
      </button>
      <button
        className={`mode-btn ${mode === 'dramatic' ? 'active dramatic-active' : ''}`}
        onClick={() => onChange('dramatic')}
      >
        Dramatic
      </button>
    </div>
  );
}
