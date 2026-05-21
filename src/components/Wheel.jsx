import { useRef, useEffect, useCallback } from 'react';

const NAMES = ['Hannah', 'Elvie', 'Hannah', 'Elvie', 'Hannah', 'Elvie', 'Hannah', 'Elvie', 'Hannah', 'Elvie'];
const SEG_COUNT = 10;
const SEG_DEG = 360 / SEG_COUNT;

const HANNAH_COLOR = '#FF5FA0';
const HANNAH_ALT   = '#FF3D85';
const ELVIE_COLOR  = '#9B59FF';
const ELVIE_ALT    = '#7B3FDF';

const COLORS = NAMES.map((name, i) =>
  name === 'Hannah'
    ? (i % 4 === 0 ? HANNAH_COLOR : HANNAH_ALT)
    : (i % 4 === 1 ? ELVIE_COLOR  : ELVIE_ALT)
);

function easeOut(t) {
  return 1 - Math.pow(1 - t, 4);
}

function drawWheel(canvas, rotDeg) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const innerR = 26;

  ctx.clearRect(0, 0, size, size);

  // Outer glow ring
  const grd = ctx.createRadialGradient(cx, cy, r - 4, cx, cy, r + 6);
  grd.addColorStop(0, 'rgba(255, 215, 0, 0.6)');
  grd.addColorStop(1, 'rgba(255, 215, 0, 0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.fillStyle = grd;
  ctx.fill();

  // Gold outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#FFD700';
  ctx.stroke();

  const rotRad = (rotDeg * Math.PI) / 180;

  for (let i = 0; i < SEG_COUNT; i++) {
    const startRad = rotRad + (i / SEG_COUNT) * Math.PI * 2 - Math.PI / 2;
    const endRad   = startRad + (Math.PI * 2) / SEG_COUNT;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r - 3, startRad, endRad);
    ctx.closePath();
    ctx.fillStyle = COLORS[i];
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Text — flip rotation for bottom-half segments so names are always upright
    const midRad = startRad + Math.PI / SEG_COUNT;
    const textR = r * 0.62;
    ctx.save();
    ctx.translate(cx + Math.cos(midRad) * textR, cy + Math.sin(midRad) * textR);
    const flip = Math.sin(midRad) > 0;
    ctx.rotate(midRad + (flip ? -Math.PI / 2 : Math.PI / 2));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = `bold ${size < 300 ? 11 : 13}px -apple-system, sans-serif`;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 3;
    ctx.fillText(NAMES[i], 0, 0);
    ctx.restore();
  }

  // Center hub
  const hubGrd = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, innerR);
  hubGrd.addColorStop(0, '#fff');
  hubGrd.addColorStop(1, '#aaa');
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = hubGrd;
  ctx.fill();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 3;
  ctx.stroke();

  // "R" logo in center
  ctx.fillStyle = '#1a1a2e';
  ctx.font = `bold ${innerR}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowBlur = 0;
  ctx.fillText('R', cx, cy + 1);
}

export function Wheel({ spinning, winner, mode, onComplete, onTick, onDramaticMoment }) {
  const canvasRef = useRef(null);
  const rotRef    = useRef(0);
  const animRef   = useRef(null);
  const momentRef = useRef(false);

  const draw = useCallback((deg) => {
    if (canvasRef.current) drawWheel(canvasRef.current, deg);
  }, []);

  // Initial draw
  useEffect(() => {
    draw(rotRef.current);
  }, [draw]);

  useEffect(() => {
    if (!spinning || !winner) return;

    if (animRef.current) cancelAnimationFrame(animRef.current);
    momentRef.current = false;

    // Determine target segment
    const winnerIndices = NAMES.map((n, i) => (n === winner ? i : -1)).filter((i) => i !== -1);
    const targetIdx = winnerIndices[Math.floor(Math.random() * winnerIndices.length)];

    // Segment midpoint is at: targetIdx * SEG_DEG + SEG_DEG/2 degrees from top (0°)
    // After rotation by rotDeg, segment i center is at (targetIdx * SEG_DEG + SEG_DEG/2) + rotDeg (mod 360)
    // We want that to be 0 (top), so:
    // rotTarget = -(targetIdx * SEG_DEG + SEG_DEG/2) + extraSpins*360 (adjusted to move forward from current)
    const segCenter = targetIdx * SEG_DEG + SEG_DEG / 2;
    const offset    = ((-segCenter - rotRef.current) % 360 + 360) % 360;
    const spins     = mode === 'dramatic' ? 9 + Math.floor(Math.random() * 5) : 4 + Math.floor(Math.random() * 3);
    // small random wobble so we don't stop perfectly on center every time
    const wobble    = (Math.random() - 0.5) * 14;
    const delta     = offset + spins * 360 + wobble;

    const duration  = mode === 'dramatic' ? 11000 : 5200;
    const startRot  = rotRef.current;
    const startTime = performance.now();
    let lastSeg     = Math.floor((((-startRot % 360) + 360) % 360) / SEG_DEG) % SEG_COUNT;

    const animate = (now) => {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = easeOut(progress);
      const curRot   = startRot - (eased * delta); // negative = clockwise in canvas coords
      rotRef.current = curRot;

      // Tick when crossing segment boundary
      const curNorm = (((-curRot % 360) + 360) % 360);
      const curSeg  = Math.floor(curNorm / SEG_DEG) % SEG_COUNT;
      if (curSeg !== lastSeg) {
        onTick?.(progress);
        lastSeg = curSeg;
      }

      // Dramatic moment at 72% — fire confetti
      if (mode === 'dramatic' && !momentRef.current && progress >= 0.72) {
        momentRef.current = true;
        onDramaticMoment?.(winner);
      }

      draw(curRot);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        onComplete?.(winner);
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [spinning, winner, mode]);

  // Resize canvas to container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = Math.min(canvas.parentElement.clientWidth - 16, 340);
    canvas.width  = size;
    canvas.height = size;
    draw(rotRef.current);
  }, [draw]);

  return (
    <div className="wheel-wrap">
      <div className="wheel-pointer" />
      <canvas ref={canvasRef} className="wheel-canvas" />
    </div>
  );
}
