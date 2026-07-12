/* OVERDRIVE SQUAD: Patch Notes
   Side-scrolling run-and-gun. Enemies are broken UI elements (buffering wheels, popups).
   Twist: "fixed" enemies become platforms briefly.
*/
window.Overdrive = (() => {
  const W = 960, H = 540;
  const GRAVITY = 0.6;
  const KILLS_TO_WIN = 20;

  function create(container, onWin, onLose) {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    canvas.style.width = '100%';
    canvas.style.maxWidth = (W * 1.5) + 'px';
    canvas.style.height = 'auto';
    canvas.setAttribute('data-testid', 'overdrive-canvas');
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let raf = null, running = true, keys = {};
    let cameraX = 0;

    const player = {
      x: 100, y: 300, vx: 0, vy: 0, w: 24, h: 40,
      grounded: false, dir: 1, hp: 100, cool: 0
    };
    const bullets = [];
    const enemies = [];
    const platforms = [];
    const fixed = []; // fixed enemies acting as platforms
    let spawnTimer = 30;
    let kills = 0;
    let bg = 0;
    let ended = false;

    // Ground platforms across a long stage
    for (let x = 0; x < 5000; x += 200) {
      platforms.push({ x, y: 440, w: 180, h: 100, type: 'ground' });
    }
    // Some floating platforms
    const floats = [
      [500, 340], [800, 280], [1100, 340], [1400, 260],
      [1700, 340], [2000, 300], [2300, 260], [2600, 340],
      [2900, 280], [3200, 320], [3500, 260], [3800, 340]
    ];
    for (const [x, y] of floats) platforms.push({ x, y, w: 120, h: 20, type: 'float' });

    function onKey(e, down) {
      const k = e.key.toLowerCase();
      keys[k] = down;
      if ((k === ' ' || k === 'w' || k === 'arrowup') && down && player.grounded) {
        player.vy = -12;
        player.grounded = false;
      }
      if (k === 'escape' && down) { onLose && onLose(); teardown(); }
    }
    function onDown() { shoot(); keys['j'] = true; }
    function onUp() { keys['j'] = false; }
    const kd = (e) => onKey(e, true), ku = (e) => onKey(e, false);
    document.addEventListener('keydown', kd);
    document.addEventListener('keyup', ku);
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mouseup', onUp);

    function shoot() {
      if (player.cool > 0) return;
      player.cool = 12;
      bullets.push({
        x: player.x + player.w/2, y: player.y + 18,
        vx: player.dir * 12, vy: 0, life: 60
      });
      beep(880, 0.08, 'square', 0.15);
    }

    function spawnEnemy() {
      const kind = Math.random() < 0.5 ? 'buffer' : 'popup';
      const y = kind === 'buffer' ? 400 : 300 + Math.random() * 80;
      enemies.push({
        x: cameraX + W + 40, y,
        vx: -2 - Math.random() * 1.5, vy: 0,
        w: 32, h: 32, hp: 2, kind, phase: 0
      });
    }

    function rectHit(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function step() {
      if (!running) return;
      // Input horizontal
      const speed = 4;
      if (keys['a'] || keys['arrowleft']) { player.vx = -speed; player.dir = -1; }
      else if (keys['d'] || keys['arrowright']) { player.vx = speed; player.dir = 1; }
      else player.vx = 0;

      if (keys['j']) shoot();

      // Physics
      player.vy += GRAVITY;
      player.x += player.vx;
      player.y += player.vy;

      // Platform collisions
      player.grounded = false;
      const allPlats = platforms.concat(fixed.map(f => ({ x: f.x, y: f.y, w: f.w, h: 8, type: 'fixed' })));
      for (const p of allPlats) {
        if (player.x + player.w > p.x && player.x < p.x + p.w) {
          if (player.vy >= 0 && player.y + player.h >= p.y && player.y + player.h - player.vy <= p.y + 4) {
            player.y = p.y - player.h;
            player.vy = 0;
            player.grounded = true;
          }
        }
      }
      if (player.y > H) { onLose && onLose(); teardown(); return; }

      // Camera follows player
      cameraX = Math.max(0, player.x - W * 0.3);
      if (player.cool > 0) player.cool--;

      // Spawn
      spawnTimer--;
      if (spawnTimer <= 0) { spawnEnemy(); spawnTimer = 40 + Math.random() * 30; }

      // Bullets
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx; b.y += b.vy; b.life--;
        if (b.life <= 0) { bullets.splice(i, 1); continue; }
      }

      // Enemies
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.x += e.vx;
        e.phase += 0.15;
        if (e.kind === 'popup') e.y += Math.sin(e.phase) * 0.6;

        // Hit by player
        if (rectHit({ x: player.x, y: player.y, w: player.w, h: player.h }, e)) {
          player.hp -= 8;
          player.vx = -player.dir * 8;
          player.vy = -6;
          beep(120, 0.15, 'sawtooth', 0.2);
          e.hp = 0;
        }
        // Bullets
        for (let j = bullets.length - 1; j >= 0; j--) {
          const b = bullets[j];
          if (b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
            e.hp--;
            bullets.splice(j, 1);
            beep(400, 0.05, 'square', 0.15);
            if (e.hp <= 0) {
              // Fix -> becomes platform for 3s
              fixed.push({ x: e.x, y: e.y + e.h - 4, w: e.w, life: 180 });
              kills++;
              beep(660, 0.12, 'triangle', 0.2);
              break;
            }
          }
        }
        if (e.hp <= 0 || e.x < cameraX - 200) enemies.splice(i, 1);
      }

      // Decay fixed platforms
      for (let i = fixed.length - 1; i >= 0; i--) {
        fixed[i].life--;
        if (fixed[i].life <= 0) fixed.splice(i, 1);
      }

      // Player HP
      if (player.hp <= 0 && !ended) { ended = true; onLose && onLose(); teardown(); return; }
      if (kills >= KILLS_TO_WIN && !ended) { ended = true; onWin && onWin(); teardown(); return; }

      draw();
      raf = requestAnimationFrame(step);
    }

    function draw() {
      // Sky gradient
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#1a0a2a'); g.addColorStop(0.5, '#5a1a4a'); g.addColorStop(1, '#ff4fa0');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // Sun
      const sunX = 700 - cameraX * 0.05;
      const grd = ctx.createRadialGradient(sunX, 300, 10, sunX, 300, 200);
      grd.addColorStop(0, '#ffe57a'); grd.addColorStop(0.5, '#ff9040'); grd.addColorStop(1, 'rgba(255,150,80,0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(sunX, 300, 200, 0, Math.PI * 2); ctx.fill();

      // Neon horizon lines
      ctx.strokeStyle = '#4ff0ff'; ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const y = 340 + i * 20;
        ctx.globalAlpha = 0.6 - i * 0.06;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Perspective lines
      ctx.strokeStyle = '#ff4fd8';
      for (let i = -20; i <= 20; i++) {
        ctx.beginPath();
        ctx.moveTo(W/2 + i * 40 - (cameraX * 0.3) % 40, 340);
        ctx.lineTo(W/2 + i * 200, H);
        ctx.stroke();
      }

      // Platforms
      for (const p of platforms) {
        const sx = p.x - cameraX;
        if (sx < -p.w || sx > W) continue;
        if (p.type === 'ground') {
          ctx.fillStyle = '#0a0a1e'; ctx.fillRect(sx, p.y, p.w, p.h);
          ctx.fillStyle = '#4ff0ff'; ctx.fillRect(sx, p.y, p.w, 3);
        } else {
          ctx.fillStyle = '#2a1a3a'; ctx.fillRect(sx, p.y, p.w, p.h);
          ctx.fillStyle = '#ffb347'; ctx.fillRect(sx, p.y, p.w, 2);
        }
      }
      // Fixed (green, "patched")
      for (const f of fixed) {
        const sx = f.x - cameraX;
        const alpha = Math.min(1, f.life / 60);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#4fff8a';
        ctx.fillRect(sx, f.y, f.w, 6);
        ctx.fillStyle = '#a8ffcf';
        ctx.fillRect(sx, f.y - 2, f.w, 2);
        ctx.globalAlpha = 1;
      }

      // Enemies
      for (const e of enemies) {
        const sx = e.x - cameraX;
        if (e.kind === 'buffer') {
          // Spinning buffer wheel
          ctx.save();
          ctx.translate(sx + e.w/2, e.y + e.h/2);
          ctx.rotate(e.phase);
          ctx.fillStyle = '#ff4fd8';
          for (let k = 0; k < 8; k++) {
            ctx.save();
            ctx.rotate((Math.PI * 2 * k) / 8);
            ctx.globalAlpha = 0.4 + (k/8)*0.6;
            ctx.fillRect(6, -3, 10, 6);
            ctx.restore();
          }
          ctx.restore();
        } else {
          // Popup ad
          ctx.fillStyle = '#fff'; ctx.fillRect(sx, e.y, e.w, e.h);
          ctx.fillStyle = '#ff2020'; ctx.fillRect(sx, e.y, e.w, 6);
          ctx.fillStyle = '#000';
          ctx.fillRect(sx + e.w - 8, e.y + 1, 6, 4); // close btn
          ctx.font = '10px monospace';
          ctx.fillText('AD', sx + 8, e.y + 22);
        }
      }

      // Bullets
      ctx.fillStyle = '#ffe57a';
      for (const b of bullets) {
        ctx.fillRect(b.x - cameraX - 3, b.y - 2, 6, 4);
      }

      // Player
      const px = player.x - cameraX;
      ctx.fillStyle = '#4ff0ff'; ctx.fillRect(px, player.y, player.w, player.h);
      ctx.fillStyle = '#0a0a1e'; ctx.fillRect(px + 4, player.y + 8, 4, 4);
      ctx.fillStyle = '#0a0a1e'; ctx.fillRect(px + 16, player.y + 8, 4, 4);
      // gun
      ctx.fillStyle = '#111'; ctx.fillRect(px + (player.dir > 0 ? player.w : -14), player.y + 18, 14, 6);

      // HUD
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(10, 10, 260, 60);
      ctx.strokeStyle = '#4ff0ff'; ctx.strokeRect(10, 10, 260, 60);
      ctx.fillStyle = '#ffb347';
      ctx.font = '18px "Press Start 2P", monospace';
      ctx.fillText('HP', 22, 34);
      ctx.fillStyle = '#333'; ctx.fillRect(60, 20, 200, 16);
      ctx.fillStyle = '#ff3b1e'; ctx.fillRect(60, 20, 200 * Math.max(0, player.hp/100), 16);
      ctx.fillStyle = '#fff'; ctx.font = '16px "VT323", monospace';
      ctx.fillText(`FIXED ${kills}/${KILLS_TO_WIN}`, 22, 60);
    }

    function teardown() {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', kd);
      document.removeEventListener('keyup', ku);
    }

    step();
    return { teardown };
  }

  // Tiny procedural beep
  let audioCtx = null;
  function beep(freq, dur, type, vol) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }

  return { create };
})();
