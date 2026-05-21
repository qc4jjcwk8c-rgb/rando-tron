import { useRef, useEffect, useCallback } from 'react';

function getCtx(ref) {
  if (!ref.current) {
    ref.current = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ref.current.state === 'suspended') ref.current.resume();
  return ref.current;
}

// ── Pink noise buffer (reused across modes) ───────────────────────────────────
function makePinkNoise(ctx, sec = 12) {
  const sr  = ctx.sampleRate;
  const buf = ctx.createBuffer(2, sr * sec, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
      b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
      b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
      d[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11; b6=w*0.115926;
    }
  }
  return buf;
}

export function useSound() {
  const ctxRef      = useRef(null);
  const ambientRef  = useRef(null);
  const beepTimers  = useRef([]);

  // ── iOS audio unlock: play silent buffer on first touch/click ────────────────
  // IMPORTANT: must be fully synchronous — async/await breaks the user-gesture
  // context in iOS PWA standalone mode, causing all subsequent audio to be blocked.
  useEffect(() => {
    const unlock = () => {
      try {
        const ctx = getCtx(ctxRef);
        ctx.resume(); // fire-and-forget — do NOT await (would exit gesture context)
        const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
      } catch {}
    };
    document.addEventListener('touchstart', unlock, { once: true, passive: true });
    document.addEventListener('mousedown',  unlock, { once: true });
    return () => {
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('mousedown',  unlock);
    };
  }, []);

  // ── Resume AudioContext when app comes back to foreground (iOS PWA) ──────────
  // iOS can set state to 'suspended' OR 'interrupted' after backgrounding.
  useEffect(() => {
    const handleVis = () => {
      if (document.visibilityState === 'visible') {
        const ctx = ctxRef.current;
        if (ctx && ctx.state !== 'running') ctx.resume();
      }
    };
    document.addEventListener('visibilitychange', handleVis);
    return () => document.removeEventListener('visibilitychange', handleVis);
  }, []);

  // ════════════════════════════════════════════════════════
  // TICK  (wheel ratchet click — used in every mode)
  // ════════════════════════════════════════════════════════
  const playTick = useCallback((progress = 0.5) => {
    const ctx = getCtx(ctxRef);
    const vol = Math.max(0.04, 0.5 * (1 - progress * 0.55));
    const len = Math.floor(ctx.sampleRate * 0.032);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1)*Math.exp(-i/(len*0.22));
    const src = ctx.createBufferSource(); src.buffer = buf;
    const hp  = ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=3200;
    const g   = ctx.createGain();         g.gain.value = vol;
    src.connect(hp); hp.connect(g); g.connect(ctx.destination);
    src.start();
  }, []);

  // ════════════════════════════════════════════════════════
  // STOP AMBIENT
  // ════════════════════════════════════════════════════════
  const stopAmbient = useCallback((fade = 1.2) => {
    if (!ambientRef.current) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { nodes, master } = ambientRef.current;
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
    setTimeout(() => {
      nodes.forEach(n => { try { n.stop?.(); } catch {} });
    }, (fade + 0.25) * 1000);
    ambientRef.current = null;
  }, []);

  const stopBeeping = useCallback(() => {
    beepTimers.current.forEach(n => { try { n.stop(); } catch {} });
    beepTimers.current = [];
  }, []);

  // ════════════════════════════════════════════════════════
  // MODE: DRONE
  // ════════════════════════════════════════════════════════
  const startDrone = useCallback(() => {
    const ctx = getCtx(ctxRef);
    if (ambientRef.current) return;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 1.5);
    master.connect(ctx.destination);
    const nodes = [];
    [[55,'sawtooth',0.6],[110,'triangle',0.4],[165,'sine',0.25],[220,'sine',0.15]]
      .forEach(([freq, type, vol]) => {
        const osc = ctx.createOscillator(); osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(freq * 1.025, ctx.currentTime + 10);
        const lp = ctx.createBiquadFilter(); lp.type='lowpass';
        lp.frequency.setValueAtTime(280, ctx.currentTime);
        lp.frequency.linearRampToValueAtTime(800, ctx.currentTime + 9);
        const g = ctx.createGain(); g.gain.value = vol;
        osc.connect(lp); lp.connect(g); g.connect(master); osc.start();
        nodes.push(osc);
      });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 4;
    const lg  = ctx.createGain(); lg.gain.value = 0.05;
    lfo.connect(lg); lg.connect(master.gain); lfo.start(); nodes.push(lfo);
    ambientRef.current = { nodes, master };
  }, []);

  // ════════════════════════════════════════════════════════
  // MODE: CROWD CHEER
  // Layered clapping + crowd roar + "Woo!" voice sweeps
  // ════════════════════════════════════════════════════════
  const startCrowd = useCallback(() => {
    const ctx = getCtx(ctxRef);
    if (ambientRef.current) return;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.8);
    master.connect(ctx.destination);
    const nodes = [];
    const now = ctx.currentTime;

    // ── CROWD ROAR: pink noise through vocal-tract formant filters ──────
    // Three layers simulate the combined resonance of a large crowd
    [[750, 2.5, 0.22], [1500, 2.0, 0.16], [2900, 1.5, 0.09]].forEach(([freq, Q, vol]) => {
      const nBuf = makePinkNoise(ctx, 15);
      const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf; nSrc.loop = true;
      const bp   = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.setValueAtTime(freq, now);
      bp.frequency.linearRampToValueAtTime(freq * 1.12, now + 9); // crowd energy rising
      bp.Q.value = Q;
      const g = ctx.createGain(); g.gain.value = vol;
      nSrc.connect(bp); bp.connect(g); g.connect(master); nSrc.start();
      nodes.push(nSrc);
    });

    // ── CLAPPING: rhythmic hand-clap transients at ~120 BPM ─────────────
    // Real claps are broadband transients peaking around 1–3 kHz
    const bpm  = 120;
    const beat = 60 / bpm; // 0.5s between beats
    for (let i = 0; i < 22; i++) {
      const t      = now + 0.2 + i * beat + (Math.random() - 0.5) * 0.025;
      const cLen   = Math.floor(ctx.sampleRate * 0.055);
      const cBuf   = ctx.createBuffer(1, cLen, ctx.sampleRate);
      const cd     = cBuf.getChannelData(0);
      for (let j = 0; j < cLen; j++) {
        cd[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / cLen, 1.8);
      }
      const cSrc = ctx.createBufferSource(); cSrc.buffer = cBuf;
      const cBp  = ctx.createBiquadFilter(); cBp.type = 'bandpass';
      cBp.frequency.value = 1600 + Math.random() * 800;
      cBp.Q.value = 0.6;
      const cg = ctx.createGain();
      // Clapping builds in intensity as excitement rises
      cg.gain.value = 0.15 + (i / 22) * 0.22;
      cSrc.connect(cBp); cBp.connect(cg); cg.connect(master);
      cSrc.start(t); nodes.push(cSrc);
    }

    // ── "WOOOO!" SWEEPS: individual voices rising in pitch ──────────────
    // Sawtooth (voice-like) filtered through bandpass, pitching upward
    for (let i = 0; i < 7; i++) {
      const t    = now + 0.4 + i * 1.55 + Math.random() * 0.5;
      const osc  = ctx.createOscillator(); osc.type = 'sawtooth';
      const lo   = 160 + Math.random() * 60;
      const hi   = 300 + Math.random() * 100;
      osc.frequency.setValueAtTime(lo, t);
      osc.frequency.linearRampToValueAtTime(hi, t + 0.55); // rising "Woo"
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 1100 + Math.random() * 400;
      bp.Q.value = 3.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.13 + Math.random() * 0.09, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.7 + Math.random() * 0.3);
      osc.connect(bp); bp.connect(g); g.connect(master);
      osc.start(t); osc.stop(t + 1.2); nodes.push(osc);
    }

    // ── ENERGY SWELL: overall crowd gets louder as tension builds ────────
    master.gain.linearRampToValueAtTime(0.62, now + 9);

    ambientRef.current = { nodes, master };
  }, []);

  // ════════════════════════════════════════════════════════
  // MODE: COUNTDOWN MUSIC
  // ════════════════════════════════════════════════════════
  const startCountdown = useCallback(() => {
    const ctx = getCtx(ctxRef);
    if (ambientRef.current) return;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.5);
    master.connect(ctx.destination);
    const nodes = [];

    // ── Bass ostinato ──
    const bass = ctx.createOscillator(); bass.type='sawtooth'; bass.frequency.value=55;
    const bassLp = ctx.createBiquadFilter(); bassLp.type='lowpass'; bassLp.frequency.value=180;
    const bassLfo = ctx.createOscillator(); bassLfo.frequency.value=2; bassLfo.type='square';
    const bassLfoG = ctx.createGain(); bassLfoG.gain.value=0.5;
    bassLfo.connect(bassLfoG); bassLfoG.connect(bassLp.frequency);
    const bassG = ctx.createGain(); bassG.gain.value=0.5;
    bass.connect(bassLp); bassLp.connect(bassG); bassG.connect(master);
    bass.start(); bassLfo.start(); nodes.push(bass, bassLfo);

    // ── Rising string pad ──
    [[220,0],[220.5,1],[219.5,-1],[440,0.5]].forEach(([freq, detune]) => {
      const osc = ctx.createOscillator(); osc.type='sawtooth'; osc.frequency.value=freq;
      osc.detune.value = detune * 8;
      osc.frequency.linearRampToValueAtTime(freq * 1.15, ctx.currentTime + 11);
      const lp = ctx.createBiquadFilter(); lp.type='lowpass';
      lp.frequency.setValueAtTime(600, ctx.currentTime);
      lp.frequency.linearRampToValueAtTime(2400, ctx.currentTime + 10);
      const g = ctx.createGain(); g.gain.value=0.12;
      osc.connect(lp); lp.connect(g); g.connect(master); osc.start(); nodes.push(osc);
    });

    // ── Accelerating percussive tick ──
    const tick = () => {
      const blen = Math.floor(ctx.sampleRate * 0.025);
      const bbuf = ctx.createBuffer(1, blen, ctx.sampleRate);
      const bd   = bbuf.getChannelData(0);
      for (let i = 0; i < blen; i++) bd[i] = (Math.random()*2-1)*Math.exp(-i/(blen*0.15));
      return bbuf;
    };
    const tickBuf = tick();
    let tTime = ctx.currentTime + 0.2;
    let tInterval = 0.5;
    const tickNodes = [];
    while (tTime < ctx.currentTime + 11.5) {
      const ts = ctx.createBufferSource(); ts.buffer = tickBuf;
      const hp = ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=4000;
      const tg = ctx.createGain(); tg.gain.value=0.45;
      ts.connect(hp); hp.connect(tg); tg.connect(master);
      ts.start(tTime); tickNodes.push(ts);
      tTime += tInterval;
      tInterval = Math.max(0.08, tInterval * 0.94);
    }
    nodes.push(...tickNodes);

    // ── Orchestral dun-dun hits ──
    [[0.5,110],[1.5,98],[2.5,110],[4,87],[6,98],[8,110],[9.5,130]].forEach(([t, freq]) => {
      const o = ctx.createOscillator(); o.type='triangle'; o.frequency.value=freq;
      const g = ctx.createGain();
      const at = ctx.currentTime + t;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.4, at + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.55);
      o.connect(g); g.connect(master); o.start(at); o.stop(at + 0.6); nodes.push(o);
    });

    ambientRef.current = { nodes, master };
  }, []);

  // ════════════════════════════════════════════════════════
  // MODE: OMINOUS BEEPING
  // ════════════════════════════════════════════════════════
  const startBeeping = useCallback(() => {
    const ctx = getCtx(ctxRef);
    beepTimers.current.forEach(n => { try { n.stop(); } catch {} });
    beepTimers.current = [];

    let t        = ctx.currentTime + 0.3;
    let interval = 0.65;
    let vol      = 0.07;
    let pitch    = 440;
    const end    = ctx.currentTime + 12.5;
    const allNodes = [];

    while (t < end) {
      const osc = ctx.createOscillator(); osc.type = 'sine';
      osc.frequency.value = pitch;
      const g   = ctx.createGain();
      const dur = Math.min(interval * 0.55, 0.14);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.008);
      g.gain.linearRampToValueAtTime(vol * 0.6, t + dur * 0.6);
      g.gain.linearRampToValueAtTime(0, t + dur);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t); osc.stop(t + dur + 0.02);
      allNodes.push(osc);

      const h  = ctx.createOscillator(); h.type='sine'; h.frequency.value = pitch * 3;
      const hg = ctx.createGain();
      hg.gain.setValueAtTime(0, t); hg.gain.linearRampToValueAtTime(vol*0.12, t+0.008);
      hg.gain.linearRampToValueAtTime(0, t + dur);
      h.connect(hg); hg.connect(ctx.destination);
      h.start(t); h.stop(t + dur + 0.02);
      allNodes.push(h);

      t        += interval;
      interval  = Math.max(0.065, interval * 0.938);
      vol       = Math.min(0.48, vol  * 1.038);
      pitch     = Math.min(1100, pitch * 1.012);
    }

    beepTimers.current = allNodes;
  }, []);

  // ════════════════════════════════════════════════════════
  // ENVELOPE SOUNDS
  // ════════════════════════════════════════════════════════
  const playEnvelopeWoosh = useCallback(() => {
    const ctx = getCtx(ctxRef);
    const osc = ctx.createOscillator(); osc.type='sine';
    osc.frequency.setValueAtTime(1800, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(260, ctx.currentTime + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.45);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.5);
  }, []);

  const playEnvelopeOpen = useCallback(() => {
    const ctx = getCtx(ctxRef);
    const nlen = Math.floor(ctx.sampleRate * 0.18);
    const nbuf = ctx.createBuffer(1, nlen, ctx.sampleRate);
    const nd   = nbuf.getChannelData(0);
    for (let i = 0; i < nlen; i++) nd[i]=(Math.random()*2-1)*Math.exp(-i/(nlen*0.35));
    const ns = ctx.createBufferSource(); ns.buffer=nbuf;
    const hp = ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=5000;
    const ng = ctx.createGain(); ng.gain.value=0.28;
    ns.connect(hp); hp.connect(ng); ng.connect(ctx.destination); ns.start();
    const bell = ctx.createOscillator(); bell.type='sine';
    bell.frequency.setValueAtTime(350, ctx.currentTime);
    bell.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.35);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0, ctx.currentTime);
    bg.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.04);
    bg.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.55);
    bell.connect(bg); bg.connect(ctx.destination);
    bell.start(); bell.stop(ctx.currentTime + 0.6);
  }, []);

  // ════════════════════════════════════════════════════════
  // FANFARE
  // ════════════════════════════════════════════════════════
  const playFanfare = useCallback(() => {
    const ctx   = getCtx(ctxRef);
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const times = [0, 0.18, 0.36, 0.60];
    notes.forEach((freq, i) => {
      ['triangle','sine'].forEach((type, j) => {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = type; osc.frequency.value = j===1 ? freq*2 : freq;
        const t = ctx.currentTime + times[i]; const vol = j===0 ? 0.28 : 0.12;
        g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol, t+0.04);
        g.gain.linearRampToValueAtTime(vol*0.55, t+0.22);
        g.gain.linearRampToValueAtTime(0, t+(i===3?0.95:0.42));
        osc.connect(g); g.connect(ctx.destination);
        osc.start(t); osc.stop(t+(i===3?1.05:0.5));
      });
    });
  }, []);

  // Wake + silent-buffer unlock (called synchronously inside the SPIN button handler)
  // Must stay synchronous — iOS PWA kills audio permission the moment we await anything.
  const wake = useCallback(() => {
    try {
      const ctx = getCtx(ctxRef);
      ctx.resume(); // fire-and-forget — no await
      const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch {}
  }, []);

  return {
    playTick,
    startDrone, startCrowd, startCountdown, startBeeping,
    stopAmbient, stopBeeping,
    playEnvelopeWoosh, playEnvelopeOpen,
    playFanfare,
    wake,
  };
}
