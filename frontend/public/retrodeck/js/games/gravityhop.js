/* GRAVITY HOP: Sync Error
   Platformer with gravity-flip. Collect corrupted pixels.
*/
window.GravityHop = (() => {
  const W = 960, H = 540;
  const G_STRENGTH = 0.65;
  const PIXELS_TO_WIN = 12;

  function create(container, onWin, onLose) {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    canvas.style.width = '100%';
    canvas.style.maxWidth = (W * 1.5) + 'px';
    canvas.style.height = 'auto';
    canvas.setAttribute('data-testid', 'gravityhop-canvas');
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let raf = null, running = true, keys = {}, ended = false;
    let gravDir = 1; // 1 = down, -1 = up
    let flipCool = 0;
    let cameraX = 0;

    const player = { x: 100, y: 400, vx: 0, vy: 0, w: 22, h: 32, grounded: false, hp: 3 };
    let collected = 0;

    // Level: ground + ceiling + floating platforms + hazard gaps.
    // ceiling at y=40, ground at y=460, gameplay height ~420
    const platforms = [];
    for (let x = 0; x < 4200; x += 200) {
      platforms.push({ x, y: 460, w: 180, h: 60, type: 'ground' });
      platforms.push({ x, y: 0, w: 180, h: 40, type: 'ceiling' });
    }
    // Floating platforms (some near top, some near bottom)
    const floats = [
      [500, 360, 100], [700, 260, 100], [900, 160, 100],
      [1200, 360, 100], [1400, 260, 100],
      [1700, 160, 100], [1900, 260, 100], [2100, 360, 100],
      [2400, 160, 100], [2600, 300, 100],
      [2900, 200, 100], [3100, 380, 100], [3400, 260, 100]
    ];
    for (const [x, y, w] of floats) platforms.push({ x, y, w, h: 16, type: 'float' });

    // Buffering platforms (flicker in and out)
    const buffers = [
      { x: 1050, y: 220, w: 80, phase: 0 },
      { x: 1550, y: 320, w: 80, phase: 1.5 },
      { x: 2250, y: 260, w: 80, phase: 0.8 },
      { x: 2750, y: 380, w: 80, phase: 2.2 },
      { x: 3250, y: 180, w: 80, phase: 1.1 },
    ];

    // Corrupted pixels to collect
    const pixels = [
      { x: 550, y: 300 }, { x: 750, y: 200 }, { x: 950, y: 100 },
      { x: 1250, y: 300 }, { x: 1450, y: 200 },
      { x: 1750, y: 100 }, { x: 1950, y: 200 }, { x: 2150, y: 300 },
      { x: 2450, y: 100 }, { x: 2650, y: 250 },
      { x: 2950, y: 150 }, { x: 3150, y: 330 }, { x: 3450, y: 200 }
    ].map(p => ({ ...p, alive: true, phase: Math.random() * 6 }));

    function onKey(e, down) {
      const k = e.key.toLowerCase();
      keys[k] = down;
      if (down && (k === ' ' || k === 'w' || k === 'arrowup') && player.grounded) {
        player.vy = -11 * gravDir;
        player.grounded = false;
        beep(660, 0.08, 'square', 0.15);
      }
      if (down && (k === 's' || k === 'g' || k === 'arrowdown') && flipCool <= 0) {
        gravDir *= -1;
        flipCool = 20;
        player.vy = -3 * gravDir;
        beep(220, 0.2, 'triangle', 0.2);
        beep(440, 0.15, 'triangle', 0.15);
      }
      if (down && k === 'escape') { onLose && onLose(); teardown(); }
    }
    const kd = (e) => onKey(e, true), ku = (e) => onKey(e, false);
    document.addEventListener('keydown', kd);
    document.addEventListener('keyup', ku);

    function rectHit(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function step() {
      if (!running) return;
      const speed = 4.4;
      if (keys['a'] || keys['arrowleft']) player.vx = -speed;
      else if (keys['d'] || keys['arrowright']) player.vx = speed;
      else player.vx *= 0.7;

      player.vy += G_STRENGTH * gravDir;
      player.x += player.vx;
      player.y += player.vy;
      if (flipCool > 0) flipCool--;

      // Compose all currently-valid platforms
      const now = performance.now() / 500;
      const activeBuffers = buffers.filter(b => Math.sin(now + b.phase) > 0);
      const allPlats = platforms.concat(activeBuffers.map(b => ({ x: b.x, y: b.y, w: b.w, h: 10, type: 'buffer' })));

      player.grounded = false;
      for (const p of allPlats) {
        if (!(player.x + player.w > p.x && player.x < p.x + p.w)) continue;
        if (gravDir > 0) {
          if (player.vy >= 0 && player.y + player.h >= p.y && player.y + player.h - player.vy <= p.y + 4) {
            player.y = p.y - player.h; player.vy = 0; player.grounded = true;
          }
        } else {
          if (player.vy <= 0 && player.y <= p.y + p.h && player.y - player.vy >= p.y + p.h - 4) {
            player.y = p.y + p.h; player.vy = 0; player.grounded = true;
          }
        }
      }
      if (player.y > H + 100 || player.y < -100) {
        player.hp--;
        if (player.hp <= 0) { onLose && onLose(); teardown(); return; }
        player.x = Math.max(50, player.x - 200); player.y = 400; player.vy = 0; gravDir = 1;
        beep(120, 0.4, 'sawtooth', 0.25);
      }

      cameraX = Math.max(0, player.x - W * 0.3);

      // Collect
      for (const p of pixels) {
        if (!p.alive) continue;
        p.phase += 0.15;
        if (Math.abs((p.x) - (player.x + player.w/2)) < 18 && Math.abs(p.y - (player.y + player.h/2)) < 18) {
          p.alive = false;
          collected++;
          beep(880, 0.1, 'square', 0.15);
          beep(1320, 0.1, 'square', 0.12);
        }
      }
      if (collected >= PIXELS_TO_WIN && !ended) { ended = true; onWin && onWin(); teardown(); return; }

      draw(now, activeBuffers);
      raf = requestAnimationFrame(step);
    }

    function draw(now, activeBuffers) {
      // Sky
      const grd = ctx.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, '#1e3a6e'); grd.addColorStop(1, '#8a4fd8');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);

      // Parallax stars
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 91 - cameraX * 0.2) % W + W) % W;
        const sy = (i * 37) % (H - 80) + 20;
        ctx.globalAlpha = 0.4 + (i % 3) * 0.2;
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.globalAlpha = 1;

      // Platforms
      for (const p of platforms) {
        const sx = p.x - cameraX;
        if (sx < -p.w || sx > W) continue;
        if (p.type === 'ground' || p.type === 'ceiling') {
          ctx.fillStyle = '#4a2e0e'; ctx.fillRect(sx, p.y, p.w, p.h);
          ctx.fillStyle = '#8a6a2a'; ctx.fillRect(sx, p.y + (p.type === 'ground' ? 0 : p.h - 4), p.w, 4);
        } else {
          ctx.fillStyle = '#2a3a5a'; ctx.fillRect(sx, p.y, p.w, p.h);
          ctx.fillStyle = '#4ff0ff'; ctx.fillRect(sx, p.y, p.w, 2);
        }
      }
      // Buffering platforms — spinner + flicker
      for (const b of activeBuffers) {
        const sx = b.x - cameraX;
        ctx.globalAlpha = 0.5 + Math.abs(Math.sin(now + b.phase)) * 0.5;
        ctx.fillStyle = '#4ff0ff'; ctx.fillRect(sx, b.y, b.w, 10);
        ctx.fillStyle = '#000'; ctx.fillRect(sx + 2, b.y + 2, b.w - 4, 6);
        // spinner glyph
        ctx.fillStyle = '#ffb347';
        for (let k = 0; k < 8; k++) {
          const a = (now * 4 + (k / 8) * Math.PI * 2);
          const px = sx + b.w/2 + Math.cos(a) * 12;
          const py = b.y - 8 + Math.sin(a) * 4;
          ctx.globalAlpha = (k / 8) * 0.8;
          ctx.fillRect(px, py, 3, 3);
        }
        ctx.globalAlpha = 1;
      }

      // Corrupted pixels
      for (const p of pixels) {
        if (!p.alive) continue;
        const sx = p.x - cameraX;
        const wob = Math.sin(p.phase) * 3;
        ctx.fillStyle = '#4ff0ff'; ctx.fillRect(sx - 8, p.y + wob - 8, 16, 16);
        ctx.fillStyle = '#fff'; ctx.fillRect(sx - 4, p.y + wob - 4, 8, 8);
        // glitch offset
        ctx.fillStyle = 'rgba(255,79,216,0.5)';
        ctx.fillRect(sx - 8 + Math.sin(p.phase * 3) * 2, p.y + wob - 8, 16, 4);
      }

      // Player
      const px = player.x - cameraX;
      ctx.save();
      if (gravDir < 0) {
        ctx.translate(px + player.w/2, player.y + player.h/2);
        ctx.scale(1, -1);
        ctx.translate(-(px + player.w/2), -(player.y + player.h/2));
      }
      ctx.fillStyle = '#ff4fd8'; ctx.fillRect(px, player.y, player.w, player.h);
      ctx.fillStyle = '#fff'; ctx.fillRect(px, player.y, player.w, 8);
      ctx.fillStyle = '#000'; ctx.fillRect(px + 4, player.y + 3, 3, 3); ctx.fillRect(px + 14, player.y + 3, 3, 3);
      ctx.restore();

      // HUD
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(10, 10, 280, 68);
      ctx.strokeStyle = '#4ff0ff'; ctx.strokeRect(10, 10, 280, 68);
      ctx.fillStyle = '#ffb347';
      ctx.font = '14px "Press Start 2P", monospace';
      ctx.fillText(`PIXELS ${collected}/${PIXELS_TO_WIN}`, 22, 32);
      ctx.fillStyle = '#fff';
      ctx.font = '18px "VT323", monospace';
      ctx.fillText(`HP ${'♥'.repeat(player.hp)}`, 22, 54);
      ctx.fillStyle = gravDir > 0 ? '#4fff8a' : '#ff4fd8';
      ctx.fillText(`GRAVITY: ${gravDir > 0 ? 'DOWN' : 'UP'} (S/G to flip)`, 22, 72);
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
