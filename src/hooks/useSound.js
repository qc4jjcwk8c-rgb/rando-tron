import { useRef, useCallback } from 'react';

function getCtx(ref) {
  if (!ref.current) {
    ref.current = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ref.current.state === 'suspended') ref.current.resume();
  return ref.current;
}

function makePinkNoise(ctx, durationSec) {
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(2, sr * durationSec, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886*b0 + w*0.0555179;
      b1 = 0.99332*b1 + w*0.0750759;
      b2 = 0.96900*b2 + w*0.1538520;
      b3 = 0.86650*b3 + w*0.3104856;
      b4 = 0.55000*b4 + w*0.5329522;
      b5 = -0.7616*b5 - w*0.0168980;
      d[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;
      b6 = w*0.115926;
    }
  }
  return buf;
}

export function useSound() {
  const ctxRef = useRef(null);
  const cheerRef = useRef(null);

  const playTick = useCallback((progress = 0.5) => {
    const ctx = getCtx(ctxRef);
    const volume = Math.max(0.04, 0.5 * (1 - progress * 0.6));
    const bufLen = Math.floor(ctx.sampleRate * 0.035);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.25));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(hp);
    hp.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }, []);

  const startCheering = useCallback(() => {
    const ctx = getCtx(ctxRef);
    if (cheerRef.current) return;

    const noiseBuf = makePinkNoise(ctx, 20);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;

    const bp1 = ctx.createBiquadFilter();
    bp1.type = 'bandpass';
    bp1.frequency.value = 900;
    bp1.Q.value = 0.8;

    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass';
    bp2.frequency.value = 2200;
    bp2.Q.value = 1.2;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 2.5;
    lfo.type = 'sine';
    const lfoG = ctx.createGain();
    lfoG.gain.value = 250;
    lfo.connect(lfoG);
    lfoG.connect(bp1.frequency);
    lfo.start();

    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 1.2);

    src.connect(bp1);
    bp1.connect(master);
    src.connect(bp2);
    bp2.connect(master);
    master.connect(ctx.destination);
    src.start();

    cheerRef.current = { src, master, lfo };
  }, []);

  const stopCheering = useCallback((fade = 1.5) => {
    if (!cheerRef.current) return;
    const ctx = ctxRef.current;
    const { src, master, lfo } = cheerRef.current;
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
    setTimeout(() => {
      try { src.stop(); lfo.stop(); } catch {}
    }, (fade + 0.2) * 1000);
    cheerRef.current = null;
  }, []);

  const playFanfare = useCallback(() => {
    const ctx = getCtx(ctxRef);
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const delays = [0, 0.18, 0.36, 0.6];

    notes.forEach((freq, i) => {
      ['triangle', 'sine'].forEach((type, j) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = j === 1 ? freq * 2 : freq;
        const t = ctx.currentTime + delays[i];
        const vol = j === 0 ? 0.28 : 0.12;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.04);
        gain.gain.linearRampToValueAtTime(vol * 0.6, t + 0.2);
        gain.gain.linearRampToValueAtTime(0, t + (i === 3 ? 0.9 : 0.4));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + (i === 3 ? 1.0 : 0.5));
      });
    });
  }, []);

  const wake = useCallback(() => {
    getCtx(ctxRef);
  }, []);

  return { playTick, startCheering, stopCheering, playFanfare, wake };
}
