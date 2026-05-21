import { useRef, useCallback } from 'react';

function getCtx(ref) {
  if (!ref.current) {
    ref.current = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ref.current.state === 'suspended') ref.current.resume();
  return ref.current;
}

export function useSound() {
  const ctxRef     = useRef(null);
  const tensionRef = useRef(null);

  // ── Wheel tick (ratchet click) ────────────────────────────────
  const playTick = useCallback((progress = 0.5) => {
    const ctx = getCtx(ctxRef);
    const volume = Math.max(0.04, 0.5 * (1 - progress * 0.55));
    const len = Math.floor(ctx.sampleRate * 0.032);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.22));
    }
    const src  = ctx.createBufferSource();
    src.buffer = buf;
    const hp   = ctx.createBiquadFilter();
    hp.type    = 'highpass';
    hp.frequency.value = 3200;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(hp); hp.connect(gain); gain.connect(ctx.destination);
    src.start();
  }, []);

  // ── Dramatic tension drone ────────────────────────────────────
  const startTension = useCallback(() => {
    const ctx = getCtx(ctxRef);
    if (tensionRef.current) return;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 1.5);
    master.connect(ctx.destination);

    const sources = [];

    // Low root drone
    [[55, 'sawtooth', 0.6], [110, 'triangle', 0.4], [165, 'sine', 0.25], [220, 'sine', 0.15]]
      .forEach(([freq, type, vol]) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(freq * 1.025, ctx.currentTime + 10);

        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(280, ctx.currentTime);
        lp.frequency.linearRampToValueAtTime(800, ctx.currentTime + 9);

        const g = ctx.createGain();
        g.gain.value = vol;

        osc.connect(lp); lp.connect(g); g.connect(master);
        osc.start();
        sources.push(osc);
      });

    // Slow tremolo LFO on master volume
    const lfo   = ctx.createOscillator();
    lfo.frequency.value = 4;
    const lfoG  = ctx.createGain();
    lfoG.gain.value = 0.05;
    lfo.connect(lfoG);
    lfoG.connect(master.gain);
    lfo.start();
    sources.push(lfo);

    tensionRef.current = { sources, master };
  }, []);

  const stopTension = useCallback((fade = 1.2) => {
    if (!tensionRef.current) return;
    const ctx = getCtx(ctxRef);
    const { sources, master } = tensionRef.current;
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
    setTimeout(() => { sources.forEach(s => { try { s.stop(); } catch {} }); }, (fade + 0.2) * 1000);
    tensionRef.current = null;
  }, []);

  // ── Envelope appear woosh ─────────────────────────────────────
  const playEnvelopeWoosh = useCallback(() => {
    const ctx = getCtx(ctxRef);
    const osc = ctx.createOscillator();
    osc.type  = 'sine';
    osc.frequency.setValueAtTime(1800, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(260, ctx.currentTime + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.45);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.5);
  }, []);

  // ── Envelope flap open sound ──────────────────────────────────
  const playEnvelopeOpen = useCallback(() => {
    const ctx = getCtx(ctxRef);

    // Paper rustle
    const nLen = Math.floor(ctx.sampleRate * 0.18);
    const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
    const nd   = nBuf.getChannelData(0);
    for (let i = 0; i < nLen; i++) {
      nd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (nLen * 0.35));
    }
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = nBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 5000;
    const nG = ctx.createGain(); nG.gain.value = 0.28;
    nSrc.connect(hp); hp.connect(nG); nG.connect(ctx.destination);
    nSrc.start();

    // Rising bell tone
    const bell = ctx.createOscillator();
    bell.type  = 'sine';
    bell.frequency.setValueAtTime(350, ctx.currentTime);
    bell.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.35);
    const bG = ctx.createGain();
    bG.gain.setValueAtTime(0, ctx.currentTime);
    bG.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.04);
    bG.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.55);
    bell.connect(bG); bG.connect(ctx.destination);
    bell.start(); bell.stop(ctx.currentTime + 0.6);
  }, []);

  // ── Winner fanfare ────────────────────────────────────────────
  const playFanfare = useCallback(() => {
    const ctx   = getCtx(ctxRef);
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const times = [0, 0.18, 0.36, 0.60];

    notes.forEach((freq, i) => {
      ['triangle', 'sine'].forEach((type, j) => {
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.type  = type;
        osc.frequency.value = j === 1 ? freq * 2 : freq;
        const t   = ctx.currentTime + times[i];
        const vol = j === 0 ? 0.28 : 0.12;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.04);
        g.gain.linearRampToValueAtTime(vol * 0.55, t + 0.22);
        g.gain.linearRampToValueAtTime(0, t + (i === 3 ? 0.95 : 0.42));
        osc.connect(g); g.connect(ctx.destination);
        osc.start(t); osc.stop(t + (i === 3 ? 1.05 : 0.5));
      });
    });
  }, []);

  const wake = useCallback(() => { getCtx(ctxRef); }, []);

  return { playTick, startTension, stopTension, playEnvelopeWoosh, playEnvelopeOpen, playFanfare, wake };
}
