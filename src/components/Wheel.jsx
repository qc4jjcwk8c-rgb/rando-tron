import { useRef, useEffect, useCallback } from 'react';

const NAMES = ['Hannah','Elvie','Hannah','Elvie','Hannah','Elvie','Hannah','Elvie','Hannah','Elvie'];
const SEG_COUNT = 10;
const SEG_DEG   = 360 / SEG_COUNT;

// Alternating shades within each name to add visual depth
const COLORS = NAMES.map((name, i) => {
  const pair = Math.floor(i / 2) % 2 === 0;
  return name === 'Hannah'
    ? (pair ? '#FF1A6E' : '#FF4187')
    : (pair ? '#6600FF' : '#7B2BFF');
});

function easeOut(t) { return 1 - Math.pow(1 - t, 4); }

function drawWheel(canvas, rotDeg) {
  const ctx  = canvas.getContext('2d');
  const size = canvas.width;
  const cx = size / 2, cy = size / 2;
  const r  = size / 2 - 14;

  ctx.clearRect(0, 0, size, size);

  // ── Outer glow ring ──────────────────────────────
  const glow = ctx.createRadialGradient(cx, cy, r - 6, cx, cy, r + 28);
  glow.addColorStop(0,   'rgba(255,200,0,0.75)');
  glow.addColorStop(0.4, 'rgba(255,130,0,0.35)');
  glow.addColorStop(1,   'rgba(255,215,0,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r + 28, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  const rotRad = (rotDeg * Math.PI) / 180;

  // ── Segments ────────────────────────────────────
  for (let i = 0; i < SEG_COUNT; i++) {
    const s = rotRad + (i / SEG_COUNT) * Math.PI * 2 - Math.PI / 2;
    const e = s + (Math.PI * 2) / SEG_COUNT;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r - 7, s, e);
    ctx.closePath();
    ctx.fillStyle = COLORS[i];
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ── Dome shine (glass-dome effect) ──────────────
  const dome = ctx.createRadialGradient(cx - r * 0.15, cy - r * 0.28, 0, cx, cy, r - 7);
  dome.addColorStop(0,    'rgba(255,255,255,0.24)');
  dome.addColorStop(0.42, 'rgba(255,255,255,0.07)');
  dome.addColorStop(0.68, 'rgba(0,0,0,0)');
  dome.addColorStop(1,    'rgba(0,0,0,0.22)');
  ctx.beginPath();
  ctx.arc(cx, cy, r - 7, 0, Math.PI * 2);
  ctx.fillStyle = dome;
  ctx.fill();

  // ── Segment text ─────────────────────────────────
  const fontSize = Math.max(11, Math.floor(size * 0.044));
  for (let i = 0; i < SEG_COUNT; i++) {
    const s   = rotRad + (i / SEG_COUNT) * Math.PI * 2 - Math.PI / 2;
    const mid = s + Math.PI / SEG_COUNT;
    const tr  = (r - 7) * 0.63;
    ctx.save();
    ctx.translate(cx + Math.cos(mid) * tr, cy + Math.sin(mid) * tr);
    const flip = Math.sin(mid) > 0;
    ctx.rotate(mid + (flip ? -Math.PI / 2 : Math.PI / 2));
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = `bold ${fontSize}px -apple-system, sans-serif`;
    ctx.shadowColor  = 'rgba(0,0,0,0.75)';
    ctx.shadowBlur   = 5;
    ctx.fillStyle    = '#ffffff';
    ctx.fillText(NAMES[i], 0, 0);
    ctx.restore();
  }

  // ── Metallic rim (layered strokes) ───────────────
  ctx.beginPath();
  ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
  ctx.lineWidth    = 12; ctx.strokeStyle = 'rgba(0,0,0,0.55)';    ctx.stroke();
  ctx.lineWidth    = 9;  ctx.strokeStyle = '#7A5800';              ctx.stroke();
  ctx.lineWidth    = 6;  ctx.strokeStyle = '#FFD700';              ctx.stroke();
  ctx.lineWidth    = 3;  ctx.strokeStyle = '#FFE566';              ctx.stroke();
  ctx.lineWidth    = 1;  ctx.strokeStyle = 'rgba(255,255,210,0.9)'; ctx.stroke();

  // ── Centre gem hub ───────────────────────────────
  const hr = Math.max(22, Math.floor(size * 0.09));

  // Dark ring behind gem
  ctx.beginPath();
  ctx.arc(cx, cy, hr + 5, 0, Math.PI * 2);
  ctx.fillStyle = '#5A4000';
  ctx.fill();

  // Gem gradient
  const gemG = ctx.createLinearGradient(cx - hr, cy - hr, cx + hr, cy + hr);
  gemG.addColorStop(0,    '#FFF8DC');
  gemG.addColorStop(0.25, '#FFD700');
  gemG.addColorStop(0.55, '#FFA500');
  gemG.addColorStop(0.8,  '#FFD700');
  gemG.addColorStop(1,    '#8B6914');
  ctx.beginPath();
  ctx.arc(cx, cy, hr, 0, Math.PI * 2);
  ctx.fillStyle = gemG;
  ctx.fill();

  // Gem specular highlight
  const gemHL = ctx.createRadialGradient(cx - hr * 0.32, cy - hr * 0.34, 0, cx, cy, hr);
  gemHL.addColorStop(0,   'rgba(255,255,255,0.65)');
  gemHL.addColorStop(0.5, 'rgba(255,255,255,0.1)');
  gemHL.addColorStop(1,   'rgba(0,0,0,0.18)');
  ctx.beginPath();
  ctx.arc(cx, cy, hr, 0, Math.PI * 2);
  ctx.fillStyle = gemHL;
  ctx.fill();

  // "R" label
  ctx.shadowBlur   = 0;
  ctx.fillStyle    = '#3A1A00';
  ctx.font         = `900 ${Math.floor(hr * 0.95)}px -apple-system, sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('R', cx, cy + 1);
}

export function Wheel({ spinning, winner, mode, onComplete, onTick, onBlurStart }) {
  const canvasRef = useRef(null);
  const rotRef    = useRef(0);   // cumulative rotation in degrees (negative = CCW)
  const animRef   = useRef(null);
  const blurFired = useRef(false);

  const draw = useCallback((deg) => {
    if (canvasRef.current) drawWheel(canvasRef.current, deg);
  }, []);

  // Initial draw
  useEffect(() => { draw(rotRef.current); }, [draw]);

  // Sync canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sz = Math.min(canvas.parentElement.clientWidth - 16, 340);
    canvas.width = sz; canvas.height = sz;
    draw(rotRef.current);
  }, [draw]);

  useEffect(() => {
    if (!spinning || !winner) return;

    if (animRef.current) cancelAnimationFrame(animRef.current);
    blurFired.current = false;

    // Clear any previous blur
    if (canvasRef.current) canvasRef.current.style.filter = 'none';

    // ── Determine target segment ──────────────────────────────────────────
    const winnerIdxs = NAMES.map((n, i) => n === winner ? i : -1).filter(i => i !== -1);
    const targetIdx  = winnerIdxs[Math.floor(Math.random() * winnerIdxs.length)];

    // currentPos: how many degrees CCW we've rotated, normalised to [0,360)
    const currentPos = ((-rotRef.current % 360) + 360) % 360;
    // segment i's centre sits at  i*36 + 18  degrees from the top (going CCW)
    const segCenter  = targetIdx * SEG_DEG + SEG_DEG / 2;
    // how many more degrees CCW to reach that centre
    const extraNeeded = ((segCenter - currentPos) % 360 + 360) % 360 || 360;
    const spins  = mode === 'dramatic' ? 9 + Math.floor(Math.random() * 5) : 4 + Math.floor(Math.random() * 3);
    const wobble = (Math.random() - 0.5) * SEG_DEG * 0.65; // stay well within segment
    const delta  = extraNeeded + spins * 360 + wobble;

    const duration  = mode === 'dramatic' ? 11000 : 5200;
    const startRot  = rotRef.current;
    const startTime = performance.now();
    let lastSeg = Math.floor(currentPos / SEG_DEG) % SEG_COUNT;

    const animate = (now) => {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = easeOut(progress);
      const curRot   = startRot - eased * delta;
      rotRef.current = curRot;

      // Tick sound when segment boundary crossed
      const curPos = ((-curRot % 360) + 360) % 360;
      const curSeg = Math.floor(curPos / SEG_DEG) % SEG_COUNT;
      if (curSeg !== lastSeg) { onTick?.(progress); lastSeg = curSeg; }

      // Dramatic: blur based on EASED position (how far through the rotation),
      // not clock time — otherwise the wheel stops visibly before blur starts.
      // eased >= 0.82 means 82% of total rotation covered; wheel still has
      // ~1–2 visible spins left so names blur while it's still moving.
      if (mode === 'dramatic' && eased >= 0.82) {
        const blurPct = Math.min((eased - 0.82) / 0.14, 1);
        if (canvasRef.current) {
          canvasRef.current.style.filter = `blur(${blurPct * 15}px)`;
        }
        if (!blurFired.current) { blurFired.current = true; onBlurStart?.(); }
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

  // Clear blur when mode changes away from dramatic
  useEffect(() => {
    if (mode !== 'dramatic' && canvasRef.current) {
      canvasRef.current.style.filter = 'none';
    }
  }, [mode]);

  return (
    <div className="wheel-wrap">
      <div className="wheel-pointer" />
      <canvas ref={canvasRef} className="wheel-canvas" />
    </div>
  );
}
