import { useRef, useCallback } from 'react';

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
  const ambientRef  = useRef(null);   // holds running ambient for all modes
  const beepTimers  = useRef([]);     // oscillator nodes for beeping mode

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
  // STOP AMBIENT  (used to clean up any running mode)
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
  // MODE: CROWD
  // ════════════════════════════════════════════════════════
  const startCrowd = useCallback(() => {
    const ctx = getCtx(ctxRef);
    if (ambientRef.current) return;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 1.2);
    master.connect(ctx.destination);
    const nodes = [];

    // ── Base crowd murmur: pink noise through 2 bandpass filters ──
    const nBuf = makePinkNoise(ctx, 15);
    const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf; nSrc.loop = true;
    const bp1  = ctx.createBiquadFilter(); bp1.type='bandpass'; bp1.frequency.value=900;  bp1.Q.value=1.2;
    const bp2  = ctx.createBiquadFilter(); bp2.type='bandpass'; bp2.frequency.value=2400; bp2.Q.value=1.5;
    const noiseG = ctx.createGain(); noiseG.gain.value = 0.55;
    nSrc.connect(bp1); bp1.connect(noiseG);
    nSrc.connect(bp2); bp2.connect(noiseG);
    noiseG.connect(master); nSrc.start();
    nodes.push(nSrc);

    // ── Chanting / "Let's go!" rhythm  (sawtooth voices, 2.5 Hz pulse) ──
    [[160,'sawtooth',900,0.25],[210,'sawtooth',1150,0.2],[130,'sawtooth',600,0.18]]
      .forEach(([fund, type, formant, vol]) => {
        const osc = ctx.createOscillator(); osc.type = type; osc.frequency.value = fund;
        const bp  = ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value = formant; bp.Q.value = 3;
        const chantLfo = ctx.createOscillator(); chantLfo.type='sine'; chantLfo.frequency.value = 2.5;
        const chantG   = ctx.createGain();        chantG.gain.value = 0.35;
        chantLfo.connect(chantG); chantG.connect(bp.frequency);
        const g = ctx.createGain(); g.gain.value = vol;
        osc.connect(bp); bp.connect(g); g.connect(master);
        osc.start(); chantLfo.start();
        nodes.push(osc, chantLfo);
      });

    // ── Crowd swell LFO (overall wave energy) ──
    const swellLfo = ctx.createOscillator(); swellLfo.frequency.value = 0.4; swellLfo.type='sine';
    const swellG   = ctx.createGain(); swellG.gain.value = 0.1;
    swellLfo.connect(swellG); swellG.connect(master.gain); swellLfo.start(); nodes.push(swellLfo);

    // ── Occasional cheer bursts (random spikes) ──
    for (let i = 0; i < 8; i++) {
      const t  = ctx.currentTime + 1.5 + Math.random() * 9;
      const burst = ctx.createGain();
      burst.gain.setValueAtTime(0, t);
      burst.gain.linearRampToValueAtTime(0.25, t + 0.12);
      burst.gain.linearRampToValueAtTime(0, t + 0.6);
      noiseG.connect(burst); burst.connect(master);
    }

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

    // ── Bass ostinato (low pulsing note) ──
    const bass = ctx.createOscillator(); bass.type='sawtooth'; bass.frequency.value=55;
    const bassLp = ctx.createBiquadFilter(); bassLp.type='lowpass'; bassLp.frequency.value=180;
    const bassLfo = ctx.createOscillator(); bassLfo.frequency.value=2; bassLfo.type='square';
    const bassLfoG = ctx.createGain(); bassLfoG.gain.value=0.5;
    bassLfo.connect(bassLfoG); bassLfoG.connect(bassLp.gain || bassLp.frequency);
    const bassG = ctx.createGain(); bassG.gain.value=0.5;
    bass.connect(bassLp); bassLp.connect(bassG); bassG.connect(master);
    bass.start(); bassLfo.start(); nodes.push(bass, bassLfo);

    // ── Rising string pad (layered sawtooths detuned) ──
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

    // ── Accelerating tick / percussive click ──
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

    // ── Periodic "dun-dun" orchestral hits ──
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

    // Pre-schedule all beeps on the AudioContext timeline
    let t        = ctx.currentTime + 0.3;
    let interval = 0.65;
    let vol      = 0.07;
    let pitch    = 440;
    const end    = ctx.currentTime + 12.5;
    const allNodes = [];

    while (t < end) {
      // Main beep
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

      // Subtle high harmonic for "digital" character
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
    // Paper rustle
    const nlen = Math.floor(ctx.sampleRate * 0.18);
    const nbuf = ctx.createBuffer(1, nlen, ctx.sampleRate);
    const nd   = nbuf.getChannelData(0);
    for (let i = 0; i < nlen; i++) nd[i]=(Math.random()*2-1)*Math.exp(-i/(nlen*0.35));
    const ns = ctx.createBufferSource(); ns.buffer=nbuf;
    const hp = ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=5000;
    const ng = ctx.createGain(); ng.gain.value=0.28;
    ns.connect(hp); hp.connect(ng); ng.connect(ctx.destination); ns.start();
    // Rising bell
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

  const wake = useCallback(() => { getCtx(ctxRef); }, []);

  return {
    playTick,
    // ambient starters
    startDrone, startCrowd, startCountdown, startBeeping,
    // ambient stopper (works for drone / crowd / countdown; beeping uses stopBeeping)
    stopAmbient, stopBeeping,
    // envelope
    playEnvelopeWoosh, playEnvelopeOpen,
    // result
    playFanfare,
    wake,
  };
}
