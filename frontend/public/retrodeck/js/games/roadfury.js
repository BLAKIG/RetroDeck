/* ROAD FURY — a Road Rash-inspired motorcycle combat racer.
   Pseudo-3D scanline road (curves + hills), rival AI, punches, checkpoints. */
window.RoadFury = (() => {
  const W = 960, H = 540;
  const ROAD_W = 2000;   // road half-width at ground plane
  const SEGMENT_LEN = 200;
  const RUMBLE_LEN = 3;
  const CAMERA_HEIGHT = 1000;
  const CAMERA_DEPTH = 0.84; // 1 / tan(fov/2)
  const DRAW_DIST = 120;
  const FINISH_MARK = 4000; // segments
  const MAX_SPEED = SEGMENT_LEN * 60; // per second
  const ACCEL = MAX_SPEED / 4;
  const BRAKE = -MAX_SPEED;
  const DECEL = -MAX_SPEED / 6;
  const OFFROAD_LIMIT = MAX_SPEED / 3;
  const CENTRIFUGAL = 0.3;

  function create(container, onWin, onLose) {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    canvas.style.width = '100%';
    canvas.style.maxWidth = (W * 1.5) + 'px';
    canvas.style.height = 'auto';
    canvas.setAttribute('data-testid', 'roadfury-canvas');
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // Build road: mix of straight, curves, hills
    const segments = [];
    function addSeg(curve, y) {
      const n = segments.length;
      segments.push({
        index: n,
        p1: { world: { y: lastY(), z: n * SEGMENT_LEN } },
        p2: { world: { y: y,       z: (n + 1) * SEGMENT_LEN } },
        curve,
        color: Math.floor(n / RUMBLE_LEN) % 2 ? 'dark' : 'light',
        sprites: []
      });
    }
    function lastY() { return segments.length === 0 ? 0 : segments[segments.length - 1].p2.world.y; }
    function addRoad(enter, hold, leave, curve, y) {
      const total = enter + hold + leave;
      for (let n = 0; n < enter; n++) addSeg(easeIn(0, curve, n / enter), easeInOut(lastY(), y, n / total));
      for (let n = 0; n < hold; n++) addSeg(curve, easeInOut(lastY(), y, (enter + n) / total));
      for (let n = 0; n < leave; n++) addSeg(easeInOut(curve, 0, n / leave), easeInOut(lastY(), y, (enter + hold + n) / total));
    }
    function easeIn(a, b, p) { return a + (b - a) * Math.pow(p, 2); }
    function easeInOut(a, b, p) { return a + (b - a) * ((-Math.cos(p * Math.PI) / 2) + 0.5); }

    addRoad(50, 200, 50, 0, 0);
    addRoad(40, 60, 40, 3, 0);
    addRoad(40, 80, 40, 0, 200);
    addRoad(40, 60, 40, -3, 200);
    addRoad(60, 100, 60, 0, 0);
    addRoad(40, 60, 40, 4, 400);
    addRoad(40, 60, 40, 0, 0);
    addRoad(50, 100, 50, -4, 0);
    addRoad(80, 40, 30, 2, 300);
    while (segments.length < FINISH_MARK) addRoad(30, 60, 30, (Math.random() * 6 - 3), Math.random() * 300);

    // Roadside decor sprites
    for (let i = 0; i < segments.length; i += 12) {
      const s = segments[i];
      const kind = Math.random() < 0.5 ? 'palm' : 'sign';
      const side = Math.random() < 0.5 ? -1 : 1;
      s.sprites.push({ kind, offset: side * (1.5 + Math.random() * 0.8) });
    }

    // Player
    const player = {
      x: 0, z: SEGMENT_LEN * 2,
      speed: 0,
      health: 100,
      money: 0,
      nitroMax: 100, nitro: 100,
      punchCool: 0,
      punchFrame: 0,
      damageFlash: 0
    };

    // Rivals
    const rivals = [];
    for (let i = 0; i < 8; i++) {
      rivals.push({
        x: (Math.random() * 2 - 1) * 0.6,
        z: SEGMENT_LEN * (15 + i * 45),
        speed: MAX_SPEED * (0.55 + Math.random() * 0.15),
        health: 60,
        hitFlash: 0,
        color: ['#ff2f2f', '#ffc72f', '#2fff9c', '#4ff0ff', '#ff4fd8', '#8dff4f', '#ff9040', '#a86bff'][i],
        alive: true,
        ko: false,
        angerCool: 0
      });
    }

    const particles = [];
    let keys = {}, running = true, raf = null, ended = false;
    let startTime = performance.now();
    let position = 1; // race rank
    let cameraShake = 0;
    let slowmo = 0;

    // Audio: procedural engine
    let audioCtx = null, engineOsc = null, engineGain = null;
    function initAudio() {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        engineOsc = audioCtx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 60;
        engineGain = audioCtx.createGain();
        engineGain.gain.value = 0.0;
        const lp = audioCtx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 700;
        engineOsc.connect(lp).connect(engineGain).connect(audioCtx.destination);
        engineOsc.start();
      } catch (e) {}
    }
    function beep(freq, dur, type, vol) {
      try {
        if (!audioCtx) initAudio();
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(vol, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
        o.connect(g).connect(audioCtx.destination);
        o.start(); o.stop(audioCtx.currentTime + dur);
      } catch (e) {}
    }
    function crashSound() {
      try {
        if (!audioCtx) initAudio();
        const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.4, audioCtx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const s = audioCtx.createBufferSource();
        s.buffer = buf;
        const g = audioCtx.createGain(); g.gain.value = 0.3;
        s.connect(g).connect(audioCtx.destination);
        s.start();
      } catch (e) {}
    }
    initAudio();

    function onKey(e, down) {
      const k = e.key.toLowerCase();
      keys[k] = down;
      if (down && k === ' ' && player.punchCool <= 0) {
        player.punchCool = 0.35;
        player.punchFrame = 0.35;
        // Punch nearest rival within range
        for (const r of rivals) {
          if (!r.alive) continue;
          const dz = r.z - player.z;
          const dx = r.x - player.x;
          if (dz > 0 && dz < SEGMENT_LEN * 3 && Math.abs(dx) < 0.6) {
            r.health -= 25;
            r.hitFlash = 0.3;
            r.angerCool = 1.5;
            particles.push({ x: W/2 + (dx * 200), y: H/2 - dz * 0.1, vx: (Math.random()-0.5)*3, vy: -3, life: 500, color: '#ffe57a', size: 4 });
            beep(220, 0.08, 'square', 0.2);
            if (r.health <= 0) {
              r.alive = false; r.ko = true;
              player.money += 500;
              slowmo = 0.4;
              crashSound();
            }
            break;
          }
        }
      }
      if (down && k === 'escape') { onLose && onLose(); teardown(); }
    }
    const kd = (e) => onKey(e, true), ku = (e) => onKey(e, false);
    document.addEventListener('keydown', kd);
    document.addEventListener('keyup', ku);

    function findSegment(z) { return segments[Math.floor(z / SEGMENT_LEN) % segments.length]; }

    let lastT = performance.now();
    function step() {
      if (!running) return;
      const now = performance.now();
      let dt = (now - lastT) / 1000;
      if (dt > 0.1) dt = 0.1;
      lastT = now;

      const slowFactor = slowmo > 0 ? 0.3 : 1;
      const gdt = dt * slowFactor;
      if (slowmo > 0) slowmo -= dt;

      const playerSeg = findSegment(player.z);
      const speedPercent = player.speed / MAX_SPEED;
      const dx = gdt * 2 * speedPercent;

      // Input
      if (keys['a'] || keys['arrowleft']) player.x -= dx;
      if (keys['d'] || keys['arrowright']) player.x += dx;
      // Centrifugal on curves
      player.x -= dx * speedPercent * playerSeg.curve * CENTRIFUGAL;

      const nitroActive = keys['shift'] && player.nitro > 0;
      if (nitroActive) player.nitro = Math.max(0, player.nitro - 20 * gdt);
      else player.nitro = Math.min(player.nitroMax, player.nitro + 8 * gdt);

      if (keys['w'] || keys['arrowup']) {
        player.speed += (nitroActive ? ACCEL * 1.7 : ACCEL) * gdt;
      } else if (keys['s'] || keys['arrowdown']) {
        player.speed += BRAKE * gdt;
      } else {
        player.speed += DECEL * gdt;
      }
      if (Math.abs(player.x) > 1 && player.speed > OFFROAD_LIMIT) {
        player.speed += DECEL * 2 * gdt;
      }
      player.speed = Math.max(0, Math.min(MAX_SPEED * (nitroActive ? 1.4 : 1), player.speed));
      player.x = Math.max(-2, Math.min(2, player.x));
      player.z = (player.z + player.speed * gdt);
      if (player.punchCool > 0) player.punchCool -= dt;
      if (player.punchFrame > 0) player.punchFrame -= dt;
      if (player.damageFlash > 0) player.damageFlash -= dt;

      // Engine sound pitch
      if (engineOsc && engineGain) {
        engineOsc.frequency.value = 60 + speedPercent * 260 + (nitroActive ? 60 : 0);
        engineGain.gain.value = 0.08 + speedPercent * 0.06;
      }

      // Rivals AI
      let rank = 1;
      for (const r of rivals) {
        if (!r.alive) continue;
        r.z += r.speed * gdt;
        if (r.hitFlash > 0) r.hitFlash -= dt;
        if (r.angerCool > 0) r.angerCool -= dt;
        // Lane change toward player when angry
        const target = r.angerCool > 0 ? player.x : (r.x < 0 ? -0.5 : 0.5);
        r.x += Math.sign(target - r.x) * 0.4 * gdt;
        r.x = Math.max(-1.2, Math.min(1.2, r.x));

        // Ram player if close
        const dz = r.z - player.z;
        if (Math.abs(dz) < SEGMENT_LEN && Math.abs(r.x - player.x) < 0.45) {
          player.health -= 15 * dt;
          player.damageFlash = 0.2;
          cameraShake = 8;
          if (Math.random() < 0.02) beep(160, 0.1, 'sawtooth', 0.2);
          if (player.health <= 0 && !ended) { ended = true; onLose && onLose(); teardown(); return; }
        }
        if (r.z > player.z) rank++;
      }
      position = rank;

      // Finish check
      const totalDist = FINISH_MARK * SEGMENT_LEN;
      if (player.z >= totalDist && !ended) {
        ended = true; onWin && onWin(); teardown(); return;
      }

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= dt * 1000;
        if (p.life <= 0) particles.splice(i, 1);
      }
      // Speed dust
      if (speedPercent > 0.6 && Math.random() < 0.5) {
        particles.push({ x: W/2 + (Math.random()-0.5)*30, y: H - 80 + Math.random()*20, vx: (Math.random()-0.5)*4, vy: -1, life: 300, color: 'rgba(210,190,140,0.7)', size: 3 });
      }
      if (cameraShake > 0) cameraShake -= dt * 30;

      draw(playerSeg, speedPercent, nitroActive);
      raf = requestAnimationFrame(step);
    }

    function project(p, cameraX, cameraY, cameraZ, cameraDepth, width, height, roadWidth) {
      p.camera = { x: (p.world.x || 0) - cameraX, y: (p.world.y || 0) - cameraY, z: (p.world.z || 0) - cameraZ };
      p.screen = {};
      p.screen.scale = cameraDepth / p.camera.z;
      p.screen.x = Math.round((width / 2) + (p.screen.scale * p.camera.x * width / 2));
      p.screen.y = Math.round((height / 2) - (p.screen.scale * p.camera.y * height / 2));
      p.screen.w = Math.round(p.screen.scale * roadWidth * width / 2);
      return p;
    }

    function drawSegment(x1, y1, w1, x2, y2, w2, color) {
      const road1 = w1 * 0.9, road2 = w2 * 0.9;
      // grass
      ctx.fillStyle = color === 'dark' ? '#0e5a2a' : '#137a3a';
      ctx.fillRect(0, y2, W, y1 - y2);
      // rumble
      ctx.fillStyle = color === 'dark' ? '#c0202a' : '#f0f0f0';
      polygon(x1 - w1, y1, x1 - road1, y1, x2 - road2, y2, x2 - w2, y2);
      polygon(x1 + w1, y1, x1 + road1, y1, x2 + road2, y2, x2 + w2, y2);
      // road
      ctx.fillStyle = color === 'dark' ? '#2a2a2a' : '#3a3a3a';
      polygon(x1 - road1, y1, x1 + road1, y1, x2 + road2, y2, x2 - road2, y2);
      // lane
      if (color === 'light') {
        ctx.fillStyle = '#e8e8e8';
        const lane1 = road1 * 0.02, lane2 = road2 * 0.02;
        polygon(x1 - lane1, y1, x1 + lane1, y1, x2 + lane2, y2, x2 - lane2, y2);
      }
    }
    function polygon(x1, y1, x2, y2, x3, y3, x4, y4) {
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
      ctx.closePath(); ctx.fill();
    }

    function drawBike(sx, sy, scale, color, leaning, punching, isPlayer) {
      const s = Math.max(0.2, scale);
      const w = 60 * s, h = 80 * s;
      const tx = sx - w/2, ty = sy - h;
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.ellipse(sx, sy, w*0.6, w*0.15, 0, 0, Math.PI*2); ctx.fill();
      // wheel
      ctx.fillStyle = '#000';
      ctx.fillRect(tx + w*0.1, ty + h*0.75, w*0.25, h*0.22);
      ctx.fillRect(tx + w*0.65, ty + h*0.75, w*0.25, h*0.22);
      // body
      ctx.fillStyle = color;
      const leanOff = leaning * w * 0.15;
      ctx.fillRect(tx + w*0.15 + leanOff, ty + h*0.4, w*0.7, h*0.4);
      // fuel tank highlight
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(tx + w*0.2 + leanOff, ty + h*0.42, w*0.6, 4);
      // rider
      ctx.fillStyle = isPlayer ? '#3a2a14' : '#222';
      ctx.fillRect(tx + w*0.3 + leanOff, ty + h*0.15, w*0.4, h*0.35);
      // helmet
      ctx.fillStyle = isPlayer ? '#4ff0ff' : '#ff2020';
      ctx.fillRect(tx + w*0.3 + leanOff, ty, w*0.4, h*0.2);
      ctx.fillStyle = '#000';
      ctx.fillRect(tx + w*0.35 + leanOff, ty + h*0.08, w*0.3, h*0.06);
      // punch arm
      if (punching > 0) {
        ctx.fillStyle = isPlayer ? '#e0b088' : '#c08868';
        ctx.fillRect(tx + w*0.8 + leanOff, ty + h*0.25, w*0.5, h*0.15);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px "Press Start 2P", monospace';
        ctx.fillText('POW!', tx + w*1.1 + leanOff, ty + h*0.3);
      }
    }

    function drawSideSprite(kind, sx, sy, scale) {
      const s = scale;
      if (kind === 'palm') {
        ctx.fillStyle = '#3a2a14'; ctx.fillRect(sx - 4*s, sy - 100*s, 8*s, 100*s);
        ctx.fillStyle = '#2f9c3a';
        ctx.beginPath(); ctx.ellipse(sx, sy - 100*s, 40*s, 20*s, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#4fcf5a';
        ctx.beginPath(); ctx.ellipse(sx, sy - 110*s, 30*s, 12*s, 0, 0, Math.PI*2); ctx.fill();
      } else if (kind === 'sign') {
        ctx.fillStyle = '#6a4818'; ctx.fillRect(sx - 3*s, sy - 60*s, 6*s, 60*s);
        ctx.fillStyle = '#ffc72f'; ctx.fillRect(sx - 30*s, sy - 80*s, 60*s, 24*s);
        ctx.fillStyle = '#000'; ctx.font = `${10*s|0}px monospace`;
        ctx.fillText('ROAD FURY', sx - 26*s, sy - 66*s);
      }
    }

    function draw(playerSeg, speedPercent, nitroActive) {
      // Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H*0.55);
      skyGrad.addColorStop(0, '#ff5a2a'); skyGrad.addColorStop(0.5, '#ff2f8a'); skyGrad.addColorStop(1, '#4a1a5a');
      ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H*0.55);
      // Sun
      const sunX = W/2 - playerSeg.curve * 20;
      const sunGrad = ctx.createRadialGradient(sunX, H*0.4, 5, sunX, H*0.4, 120);
      sunGrad.addColorStop(0, '#ffe57a'); sunGrad.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = sunGrad; ctx.fillRect(0, 0, W, H*0.55);

      // Camera shake
      const shx = (Math.random()-0.5) * cameraShake;
      const shy = (Math.random()-0.5) * cameraShake;
      ctx.save(); ctx.translate(shx, shy);

      // Road: iterate segments
      const baseSegIdx = Math.floor(player.z / SEGMENT_LEN) % segments.length;
      const cameraX = player.x * ROAD_W;
      const cameraY = CAMERA_HEIGHT + segments[baseSegIdx].p1.world.y;
      const cameraZ = player.z - (Math.floor(player.z / SEGMENT_LEN) === 0 ? 0 : 0);

      let maxY = H;
      let x = 0, dx = 0;
      for (let n = 0; n < DRAW_DIST; n++) {
        const seg = segments[(baseSegIdx + n) % segments.length];
        const loopedZ = (baseSegIdx + n) >= segments.length ? segments.length * SEGMENT_LEN : 0;
        seg.p1.world.x = -x; seg.p2.world.x = -x - dx;
        project(seg.p1, cameraX - x, cameraY, player.z - loopedZ, CAMERA_DEPTH, W, H, ROAD_W);
        project(seg.p2, cameraX - x - dx, cameraY, player.z - loopedZ, CAMERA_DEPTH, W, H, ROAD_W);
        x += dx; dx += seg.curve;
        if (seg.p1.camera.z <= CAMERA_DEPTH || seg.p2.screen.y >= maxY) continue;
        drawSegment(seg.p1.screen.x, seg.p1.screen.y, seg.p1.screen.w,
                    seg.p2.screen.x, seg.p2.screen.y, seg.p2.screen.w, seg.color);
        maxY = seg.p2.screen.y;
        seg._proj = { x1: seg.p1.screen.x, y1: seg.p1.screen.y, w1: seg.p1.screen.w, scale: seg.p1.screen.scale };
      }

      // Roadside sprites (draw back-to-front)
      for (let n = DRAW_DIST - 1; n >= 0; n--) {
        const seg = segments[(baseSegIdx + n) % segments.length];
        if (!seg._proj) continue;
        for (const sp of seg.sprites) {
          const sx = seg._proj.x1 + sp.offset * seg._proj.w1;
          const sy = seg._proj.y1;
          drawSideSprite(sp.kind, sx, sy, seg._proj.scale * 200);
        }
      }

      // Rivals (draw back-to-front)
      const sortedRivals = rivals.slice().sort((a, b) => b.z - a.z);
      for (const r of sortedRivals) {
        if (!r.alive) continue;
        const dz = r.z - player.z;
        if (dz < 0 || dz > DRAW_DIST * SEGMENT_LEN) continue;
        const scale = CAMERA_DEPTH / dz;
        const sx = W/2 + scale * (r.x - player.x) * ROAD_W * W / 2;
        const sy = H/2 + scale * CAMERA_HEIGHT * H / 2;
        drawBike(sx, Math.min(H - 40, sy), scale * 200, r.color, 0, 0, false);
        if (r.hitFlash > 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillRect(sx - 40, sy - 80, 80, 80);
        }
      }

      // Player bike (bottom center)
      const lean = ((keys['a']||keys['arrowleft']) ? -1 : (keys['d']||keys['arrowright']) ? 1 : 0) + player.x * 0.3;
      drawBike(W/2, H - 40, 1, '#ff2f2f', lean, player.punchFrame, true);

      // Speed lines
      if (speedPercent > 0.4) {
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.1 + speedPercent * 0.25) + ')';
        for (let i = 0; i < 12; i++) {
          const y = (Math.random() * H * 0.6) + H * 0.35;
          const len = 40 + Math.random() * 60 * speedPercent;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(len, y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(W - len, y); ctx.lineTo(W, y); ctx.stroke();
        }
      }
      if (nitroActive) {
        ctx.fillStyle = 'rgba(79,240,255,0.15)';
        ctx.fillRect(0, 0, W, H);
      }

      // Particles
      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 400));
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      ctx.restore();

      // Damage flash
      if (player.damageFlash > 0) {
        ctx.fillStyle = `rgba(255,20,20,${player.damageFlash})`;
        ctx.fillRect(0, 0, W, H);
      }

      // HUD
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, W, 60);
      ctx.strokeStyle = '#ff4fd8'; ctx.strokeRect(0, 0, W, 60);
      ctx.fillStyle = '#ffb347'; ctx.font = '18px "Press Start 2P", monospace';
      ctx.fillText('SPEED', 20, 26);
      ctx.fillStyle = '#333'; ctx.fillRect(120, 12, 200, 20);
      ctx.fillStyle = '#ff2f2f'; ctx.fillRect(120, 12, 200 * speedPercent, 20);
      ctx.fillStyle = '#fff'; ctx.font = '18px "VT323", monospace';
      ctx.fillText(`${Math.round(speedPercent * 220)} MPH`, 130, 50);

      ctx.fillStyle = '#ffb347';
      ctx.font = '14px "Press Start 2P", monospace';
      ctx.fillText('HP', 350, 26);
      ctx.fillStyle = '#333'; ctx.fillRect(390, 14, 160, 16);
      ctx.fillStyle = '#4fff8a'; ctx.fillRect(390, 14, 160 * Math.max(0, player.health/100), 16);

      ctx.fillText('NOS', 570, 26);
      ctx.fillStyle = '#333'; ctx.fillRect(620, 14, 140, 16);
      ctx.fillStyle = '#4ff0ff'; ctx.fillRect(620, 14, 140 * (player.nitro/100), 16);

      ctx.fillStyle = '#ffe57a';
      ctx.fillText(`POS ${position}/${rivals.length + 1}`, 780, 26);
      ctx.fillStyle = '#fff'; ctx.font = '16px "VT323", monospace';
      const dist = Math.min(100, (player.z / (FINISH_MARK * SEGMENT_LEN)) * 100);
      ctx.fillText(`TRACK ${dist.toFixed(0)}%`, 780, 48);

      // Elapsed time
      const t = ((performance.now() - startTime) / 1000).toFixed(1);
      ctx.fillText(`${t}s  $${player.money}`, 20, 78);
    }

    function teardown() {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', kd);
      document.removeEventListener('keyup', ku);
      try { if (engineOsc) engineOsc.stop(); } catch (e) {}
      try { if (audioCtx) audioCtx.close(); } catch (e) {}
    }

    step();
    return { teardown };
  }

  return { create };
})();
