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
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(0.15);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.6;
      const g = envGain(0.001, 0.18, 0.35);
      src.connect(bp).connect(g).connect(c.destination);
      src.start();
      const o = c.createOscillator();
      o.type = 'square'; o.frequency.setValueAtTime(180, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.08);
      const g2 = envGain(0.001, 0.12, 0.3);
      o.connect(g2).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.12);
    },
    rifle() { // M4A1 — sharp, high
      const c = ac();
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(0.12);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 1.2;
      const g = envGain(0.001, 0.14, 0.32);
      src.connect(bp).connect(g).connect(c.destination);
      src.start();
      const o = c.createOscillator();
      o.type = 'square'; o.frequency.setValueAtTime(240, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.06);
      const g2 = envGain(0.001, 0.08, 0.22);
      o.connect(g2).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.08);
    },
    rifle2() { // AK — deeper, punchier
      const c = ac();
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(0.18);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.9;
      const g = envGain(0.001, 0.2, 0.4);
      src.connect(bp).connect(g).connect(c.destination);
      src.start();
      const o = c.createOscillator();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(130, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(35, c.currentTime + 0.1);
      const g2 = envGain(0.001, 0.13, 0.3);
      o.connect(g2).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.13);
    },
    deagle() { // Desert Eagle — huge boom
      const c = ac();
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(0.3);
      const bp = c.createBiquadFilter();
      bp.type = 'lowpass'; bp.frequency.value = 700;
      const g = envGain(0.001, 0.32, 0.55);
      src.connect(bp).connect(g).connect(c.destination);
      src.start();
      const o = c.createOscillator();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(90, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(25, c.currentTime + 0.28);
      const g2 = envGain(0.001, 0.32, 0.5);
      o.connect(g2).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.32);
    },
    knife() {
      const c = ac();
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(0.15);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 4500; bp.Q.value = 4;
      const g = envGain(0.001, 0.16, 0.22);
      src.connect(bp).connect(g).connect(c.destination);
      src.start();
    },
    reload() {
      const c = ac();
      const now = c.currentTime;
      [0, 0.15, 0.32].forEach((t, i) => {
        const o = c.createOscillator();
        o.type = 'square';
        o.frequency.value = 320 - i * 40;
        const g = c.createGain();
        g.gain.setValueAtTime(0, now + t);
        g.gain.linearRampToValueAtTime(0.15, now + t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.08);
        o.connect(g).connect(c.destination);
        o.start(now + t); o.stop(now + t + 0.09);
      });
    },
    weaponSwitch() {
      const c = ac();
      const o = c.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(240, c.currentTime);
      o.frequency.linearRampToValueAtTime(440, c.currentTime + 0.09);
      const g = envGain(0.001, 0.12, 0.14);
      o.connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.13);
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
    // Enemy voice: procedural "yell" — formant-ish square blob.
    enemySpotted() {
      const c = ac();
      const o = c.createOscillator();
      o.type = 'sawtooth';
      const base = 140 + Math.random() * 60;
      o.frequency.setValueAtTime(base, c.currentTime);
      o.frequency.linearRampToValueAtTime(base * 1.3, c.currentTime + 0.08);
      o.frequency.linearRampToValueAtTime(base * 0.7, c.currentTime + 0.2);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 2;
      const g = envGain(0.005, 0.28, 0.24);
      o.connect(bp).connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.3);
    },
    enemyTaunt() {
      const c = ac();
      const o = c.createOscillator();
      o.type = 'square';
      const base = 110 + Math.random() * 80;
      o.frequency.setValueAtTime(base, c.currentTime);
      o.frequency.linearRampToValueAtTime(base * 0.85, c.currentTime + 0.18);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 1.6;
      const g = envGain(0.01, 0.22, 0.2);
      o.connect(bp).connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.22);
    },
    enemyHurt() {
      const c = ac();
      const o = c.createOscillator();
      o.type = 'sawtooth';
      const base = 240 + Math.random() * 80;
      o.frequency.setValueAtTime(base, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.18);
      const g = envGain(0.001, 0.2, 0.22);
      o.connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.2);
    },
    enemyAttack() {
      const c = ac();
      const o = c.createOscillator();
      o.type = 'square';
      const base = 180 + Math.random() * 90;
      o.frequency.setValueAtTime(base * 1.3, c.currentTime);
      o.frequency.linearRampToValueAtTime(base, c.currentTime + 0.08);
      o.frequency.exponentialRampToValueAtTime(base * 0.5, c.currentTime + 0.22);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 3;
      const g = envGain(0.005, 0.25, 0.22);
      o.connect(bp).connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.26);
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
    hitMarker() {
      const c = ac();
      const o = c.createOscillator();
      o.type = 'square';
      o.frequency.value = 1400;
      const g = envGain(0.001, 0.06, 0.14);
      o.connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.08);
    },
    explode() {
      const c = ac();
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(0.6);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 350;
      const g = envGain(0.005, 0.6, 0.55);
      src.connect(lp).connect(g).connect(c.destination);
      src.start();
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(100, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(28, c.currentTime + 0.5);
      const g2 = envGain(0.005, 0.55, 0.4);
      o.connect(g2).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.55);
    },
    powerup() {
      const c = ac();
      const now = c.currentTime;
      [660, 880, 1320].forEach((f, i) => {
        const o = c.createOscillator();
        o.type = 'square'; o.frequency.value = f;
        const g = c.createGain();
        g.gain.setValueAtTime(0, now + i * 0.06);
        g.gain.linearRampToValueAtTime(0.2, now + i * 0.06 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + 0.16);
        o.connect(g).connect(c.destination);
        o.start(now + i * 0.06); o.stop(now + i * 0.06 + 0.18);
      });
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
    // Streak announcer — pitched tone rising with tier.
    streak(freq = 660) {
      const c = ac();
      const now = c.currentTime;
      [0, 0.09, 0.19].forEach((t, i) => {
        const o = c.createOscillator();
        o.type = 'square';
        o.frequency.value = freq * (1 + i * 0.2);
        const g = c.createGain();
        g.gain.setValueAtTime(0, now + t);
        g.gain.linearRampToValueAtTime(0.22, now + t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.12);
        o.connect(g).connect(c.destination);
        o.start(now + t); o.stop(now + t + 0.14);
      });
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
    play(name, arg) {
      try { if (sounds[name]) sounds[name](arg); } catch (e) { /* silent */ }
    }
  };
})();
