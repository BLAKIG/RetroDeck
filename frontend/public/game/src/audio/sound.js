/* Procedural retro audio via WebAudio. */
(function () {
  let ctx = null;
  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function envGain(a, dur, peak = 0.2) {
    const c = ac();
    const g = c.createGain();
    const now = c.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(peak, now + a);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    return g;
  }

  function noiseBuffer(dur) {
    const c = ac();
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  const sounds = {
    pistol() {
      const c = ac();
      // Noise burst
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(0.15);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.6;
      const g = envGain(0.001, 0.18, 0.35);
      src.connect(bp).connect(g).connect(c.destination);
      src.start();
      // Low thump
      const o = c.createOscillator();
      o.type = 'square'; o.frequency.setValueAtTime(180, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.08);
      const g2 = envGain(0.001, 0.12, 0.3);
      o.connect(g2).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.12);
    },
    enemyDeath() {
      const c = ac();
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(300, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.35);
      const g = envGain(0.005, 0.4, 0.22);
      o.connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.4);

      const src = c.createBufferSource();
      src.buffer = noiseBuffer(0.3);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
      const g2 = envGain(0.001, 0.3, 0.18);
      src.connect(lp).connect(g2).connect(c.destination);
      src.start();
    },
    hurt() {
      const c = ac();
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(0.15);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 400;
      const g = envGain(0.001, 0.18, 0.25);
      src.connect(bp).connect(g).connect(c.destination);
      src.start();
    },
    pickup() {
      const c = ac();
      const o = c.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(660, c.currentTime);
      o.frequency.linearRampToValueAtTime(990, c.currentTime + 0.12);
      const g = envGain(0.005, 0.15, 0.18);
      o.connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.16);
    },
    footstep() {
      const c = ac();
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(0.08);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 350;
      const g = envGain(0.001, 0.08, 0.08);
      src.connect(lp).connect(g).connect(c.destination);
      src.start();
    },
    gameover() {
      const c = ac();
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(220, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(40, c.currentTime + 1.2);
      const g = envGain(0.02, 1.4, 0.25);
      o.connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + 1.4);
    }
  };

  window.Sound = {
    unlock() { ac(); if (ctx.state === 'suspended') ctx.resume(); },
    play(name) {
      try { if (sounds[name]) sounds[name](); } catch (e) { /* silent */ }
    }
  };
})();
