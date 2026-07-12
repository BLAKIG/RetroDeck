/* OVERDRIVE SQUAD: Patch Notes
   Side-scrolling run-and-gun. You're a developer who stepped inside a live
   server to hunt down what's breaking it: literal bugs, malware viruses,
   infinite loops, and uncaught exceptions.
   Twist: enemies you "fix" become platforms briefly.
*/
window.Overdrive = (() => {
  const W = 960, H = 540;
  const GRAVITY = 0.55;
  const KILLS_TO_WIN = 20;
  const DROP_CHANCE = 0.4;       // chance an enemy drops a pickup on death
  const RAPIDFIRE_DURATION = 240; // frames the rapid-fire buff lasts (~4s)
  const HEALTH_RESTORE = 25;

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

    // Server-interior background art
    const bgImg = new Image();
    bgImg.src = 'assets/images/overdrive_bg.png';
    let bgReady = false;
    bgImg.onload = () => { bgReady = true; };

    // Background music
    const music = new Audio('assets/audio/overdrive-theme.mp3');
    music.loop = true;
    music.volume = 0.35;
    music.play().catch(() => {
      // Autoplay blocked until a user gesture; retry on first input.
      const resume = () => { music.play().catch(() => {}); document.removeEventListener('keydown', resume); canvas.removeEventListener('mousedown', resume); };
      document.addEventListener('keydown', resume, { once: true });
      canvas.addEventListener('mousedown', resume, { once: true });
    });

    let raf = null, running = true, keys = {};
    let cameraX = 0;

    const player = {
      x: 100, y: 300, vx: 0, vy: 0, w: 24, h: 40,
      grounded: false, dir: 1, hp: 100, cool: 0, rapidTimer: 0
    };
    const bullets = [];
    const enemies = [];
    const platforms = [];
    const fixed = []; // fixed enemies acting as platforms
    const drops = []; // pickups dropped by killed enemies
    let spawnTimer = 45;
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
        player.vy = -11;
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
      player.cool = player.rapidTimer > 0 ? 8 : 18;
      bullets.push({
        x: player.x + player.w/2, y: player.y + 18,
        vx: player.dir * 10, vy: 0, life: 60
      });
      beep(880, 0.08, 'square', 0.15);
    }

    function spawnEnemy() {
      const roll = Math.random();
      const kind = roll < 0.3 ? 'bug' : roll < 0.55 ? 'virus' : roll < 0.8 ? 'loop' : 'exception';
      let y, w, h, hp, vx;
      if (kind === 'bug') {
        // Literal bug: crawls along the ground
        y = 408; w = 32; h = 32; hp = 2;
        vx = -1.4 - Math.random() * 1;
      } else if (kind === 'virus') {
        // Spiky malware ball that slowly homes toward the player's height
        y = 260 + Math.random() * 140; w = 30; h = 30; hp = 3;
        vx = -1 - Math.random() * 0.7;
      } else if (kind === 'loop') {
        // Infinite loop: spinning process wheel
        y = 400; w = 32; h = 32; hp = 2;
        vx = -1.2 - Math.random() * 0.9;
      } else {
        // Uncaught exception: red error dialog
        y = 300 + Math.random() * 80; w = 32; h = 32; hp = 2;
        vx = -1.2 - Math.random() * 0.9;
      }
      enemies.push({ x: cameraX + W + 40, y, vx, vy: 0, w, h, hp, kind, phase: 0 });
    }

    function spawnDrop(x, y) {
      if (Math.random() > DROP_CHANCE) return;
      const kind = Math.random() < 0.5 ? 'health' : 'rapid';
      drops.push({ x, y, vx: 0, vy: -3, w: 16, h: 16, kind, life: 500, bob: 0 });
    }

    function rectHit(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function step() {
      if (!running) return;
      // Input horizontal
      const speed = 3.2;
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
      if (spawnTimer <= 0) { spawnEnemy(); spawnTimer = 60 + Math.random() * 40; }

      // Rapid-fire buff countdown
      if (player.rapidTimer > 0) player.rapidTimer--;

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
        if (e.kind === 'exception') e.y += Math.sin(e.phase) * 0.6;
        if (e.kind === 'bug') e.y = 408 + Math.sin(e.phase * 2) * 2; // leg-scuttle wobble
        if (e.kind === 'virus') e.y += Math.max(-0.6, Math.min(0.6, (player.y - e.y) * 0.01));

        // Hit by player
        if (rectHit({ x: player.x, y: player.y, w: player.w, h: player.h }, e)) {
          player.hp -= 8;
          player.vx = -player.dir * 8;
          player.vy = -6;
          beep(120, 0.15, 'sawtooth', 0.2);
          e.hp = 0;
          spawnDrop(e.x + e.w / 2 - 8, e.y);
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
              spawnDrop(e.x + e.w / 2 - 8, e.y);
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

      // Drops: pop up, fall, settle on platforms, and get collected
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.vy += GRAVITY * 0.5;
        d.y += d.vy;
        d.x += d.vx;
        d.bob += 0.12;
        for (const p of allPlats) {
          if (d.x + d.w > p.x && d.x < p.x + p.w) {
            if (d.vy >= 0 && d.y + d.h >= p.y && d.y + d.h - d.vy <= p.y + 4) {
              d.y = p.y - d.h;
              d.vy = 0;
            }
          }
        }
        d.life--;
        let collected = false;
        if (rectHit({ x: player.x, y: player.y, w: player.w, h: player.h }, d)) {
          collected = true;
          if (d.kind === 'health') {
            player.hp = Math.min(100, player.hp + HEALTH_RESTORE);
            beep(520, 0.15, 'sine', 0.2);
          } else {
            player.rapidTimer = RAPIDFIRE_DURATION;
            beep(980, 0.15, 'triangle', 0.2);
          }
        }
        if (collected || d.life <= 0 || d.x < cameraX - 200) drops.splice(i, 1);
      }

      // Player HP
      if (player.hp <= 0 && !ended) { ended = true; onLose && onLose(); teardown(); return; }
      if (kills >= KILLS_TO_WIN && !ended) { ended = true; onWin && onWin(); teardown(); return; }

      draw();
      raf = requestAnimationFrame(step);
    }

    function draw() {
      // Server-interior background (circuit board), slow parallax scroll
      if (bgReady) {
        const iw = bgImg.width, ih = bgImg.height;
        const scale = H / ih;
        const drawW = iw * scale;
        const offset = (cameraX * 0.25) % drawW;
        let sx0 = -offset;
        for (let x = sx0; x < W; x += drawW) {
          ctx.drawImage(bgImg, x, 0, drawW, H);
        }
        // Dark overlay for readability + magenta tint to keep the arcade mood
        const tint = ctx.createLinearGradient(0, 0, 0, H);
        tint.addColorStop(0, 'rgba(10,5,25,0.55)');
        tint.addColorStop(0.6, 'rgba(20,5,35,0.35)');
        tint.addColorStop(1, 'rgba(40,5,30,0.55)');
        ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H);
      } else {
        // Fallback while the image loads
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#1a0a2a'); g.addColorStop(0.5, '#5a1a4a'); g.addColorStop(1, '#ff4fa0');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }

      // Neon horizon lines (server floor grid)
      ctx.strokeStyle = '#4ff0ff'; ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const y = 340 + i * 20;
        ctx.globalAlpha = 0.5 - i * 0.05;
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
        if (e.kind === 'loop') {
          // Spinning process wheel (infinite loop)
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
        } else if (e.kind === 'exception') {
          // Uncaught exception dialog
          ctx.fillStyle = '#fff'; ctx.fillRect(sx, e.y, e.w, e.h);
          ctx.fillStyle = '#ff2020'; ctx.fillRect(sx, e.y, e.w, 6);
          ctx.fillStyle = '#000';
          ctx.fillRect(sx + e.w - 8, e.y + 1, 6, 4); // close btn
          ctx.font = '9px monospace';
          ctx.fillText('ERR', sx + 5, e.y + 22);
        } else if (e.kind === 'bug') {
          // Literal crawling bug (beetle-like)
          const legPhase = Math.sin(e.phase * 3);
          ctx.save();
          ctx.translate(sx + e.w/2, e.y + e.h/2);
          // legs
          ctx.strokeStyle = '#1a3a1a'; ctx.lineWidth = 2;
          for (let k = -1; k <= 1; k++) {
            ctx.beginPath(); ctx.moveTo(k * 8, -2); ctx.lineTo(k * 8 + legPhase * 3, 10); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(k * 8, 2); ctx.lineTo(k * 8 - legPhase * 3, -10); ctx.stroke();
          }
          // body
          ctx.fillStyle = '#3fae3f'; ctx.beginPath(); ctx.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#0a0a1e'; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, 9); ctx.stroke();
          // antennae
          ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(-16, -12); ctx.moveTo(10, -6); ctx.lineTo(16, -12); ctx.stroke();
          ctx.restore();
        } else if (e.kind === 'virus') {
          // Spiky malware ball
          ctx.save();
          ctx.translate(sx + e.w/2, e.y + e.h/2);
          ctx.rotate(-e.phase * 0.6);
          ctx.fillStyle = '#c04fff';
          for (let k = 0; k < 10; k++) {
            const a = (Math.PI * 2 * k) / 10;
            ctx.save(); ctx.rotate(a);
            ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, -14); ctx.lineTo(-4, -14); ctx.closePath(); ctx.fill();
            ctx.restore();
          }
          ctx.fillStyle = '#7a1fbf'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#f0c0ff';
          ctx.beginPath(); ctx.arc(-3, -2, 1.6, 0, Math.PI * 2); ctx.arc(3, -2, 1.6, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }

      // Drops
      for (const d of drops) {
        const sx = d.x - cameraX;
        const bobY = d.y + Math.sin(d.bob) * 3;
        ctx.save();
        ctx.translate(sx + d.w / 2, bobY + d.h / 2);
        if (d.kind === 'health') {
          ctx.fillStyle = '#2a1a3a'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#4fff8a'; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = '#4fff8a';
          ctx.fillRect(-6, -1.5, 12, 3);
          ctx.fillRect(-1.5, -6, 3, 12);
        } else {
          ctx.fillStyle = '#2a1a3a'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#ffe57a'; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = '#ffe57a';
          ctx.beginPath();
          ctx.moveTo(2, -7); ctx.lineTo(-4, 1); ctx.lineTo(0, 1);
          ctx.lineTo(-2, 7); ctx.lineTo(4, -1); ctx.lineTo(0, -1);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
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

      if (player.rapidTimer > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(280, 10, 150, 30);
        ctx.strokeStyle = '#ffe57a'; ctx.strokeRect(280, 10, 150, 30);
        ctx.fillStyle = '#ffe57a'; ctx.font = '14px "VT323", monospace';
        ctx.fillText(`RAPID FIRE ${Math.ceil(player.rapidTimer / 60)}s`, 290, 30);
      }
    }

    function teardown() {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', kd);
      document.removeEventListener('keyup', ku);
      try { music.pause(); music.currentTime = 0; } catch (e) {}
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
