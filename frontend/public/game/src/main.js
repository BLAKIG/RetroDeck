/* Main game loop. Wires everything together. */
(function () {
  const canvas = document.getElementById('game');
  const damageFlash = document.getElementById('damage-flash');
  const crosshair = document.getElementById('crosshair');
  const startScreen = document.getElementById('start-screen');
  const startBtn = document.getElementById('start-btn');
  const gameOver = document.getElementById('game-over');
  const restartBtn = document.getElementById('restart-btn');
  const hudEl = document.getElementById('hud');
  const bgMusic = document.getElementById('bg-music');
  const rickMusic = document.getElementById('rickroll-music');
  const bossBar = document.getElementById('boss-bar');
  const bossBarInner = document.getElementById('boss-bar-inner');
  const usePrompt = document.getElementById('use-prompt');
  const achievement = document.getElementById('achievement');
  const secretTint = document.getElementById('secret-tint');

  // Set logical size to match visible area for sharp raycast target
  function fitCanvas() {
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.floor(r.width);
    canvas.height = Math.floor(r.height);
    if (game.raycaster) {
      game.raycaster.rw = Math.max(64, Math.floor(canvas.width * game.raycaster.renderScale));
      game.raycaster.rh = Math.max(64, Math.floor(canvas.height * game.raycaster.renderScale));
      game.raycaster.buf.width = game.raycaster.rw;
      game.raycaster.buf.height = game.raycaster.rh;
      game.raycaster.img = game.raycaster.bctx.createImageData(game.raycaster.rw, game.raycaster.rh);
      game.raycaster.pixels = new Uint32Array(game.raycaster.img.data.buffer);
      game.raycaster.zBuffer = new Float32Array(game.raycaster.rw);
    }
  }

  const input = {
    forward: false, back: false, left: false, right: false,
    turnLeft: false, turnRight: false, sprint: false,
    fire: false, use: false, mouseDX: 0
  };

  // Rick easter-egg state (per session). Rick spawns at most once per playthrough.
  const rick = {
    door: null,
    rickSpawn: null,
    slideProgress: 0,
    sliding: false,
    triggered: false,
    enemy: null,
    defeated: false,
    musicVol: 0,
    fadeOut: false,
    achievementShown: false,
    aliveSince: 0
  };

  const game = {
    canvas,
    started: false,
    running: false,
    raycaster: null,
    renderer: null,
    hud: null,
    player: null,
    weapon: null,
    enemies: [],
    pickups: [],
    map: null,
    lastT: 0,
    fps: 0,
    fpsAcc: 0,
    fpsFrames: 0,
    lastFootstep: 0
  };

  function initLevel() {
    const L = LEVEL1;
    game.map = L.map;
    game.player = new Player(L.start.x, L.start.y, L.start.angle);
    game.enemies = L.enemies.map(e => new Enemy(e.x, e.y, e.type));
    game.pickups = L.pickups.map(p => ({ ...p, tex: TEX.get(p.type), scale: 0.6, alive: true }));
    game.weapon = new Pistol();
    // Reset Rick state for a fresh playthrough.
    rick.door = L.secretDoor ? { ...L.secretDoor } : null;
    rick.rickSpawn = L.rickSpawn ? { ...L.rickSpawn } : null;
    rick.slideProgress = 0;
    rick.sliding = false;
    rick.triggered = false;
    rick.enemy = null;
    rick.defeated = false;
    rick.musicVol = 0;
    rick.fadeOut = false;
    rick.achievementShown = false;
    bossBar.classList.add('hidden');
    usePrompt.classList.add('hidden');
    achievement.classList.add('hidden');
    secretTint.classList.remove('on');
    secretTint.classList.add('hidden');
    try { rickMusic.pause(); rickMusic.currentTime = 0; rickMusic.volume = 0; } catch (e) {}
  }

  // Load rick sprites once (async). Safe to call multiple times.
  let rickTexturesReady = false;
  function preloadRickTextures() {
    if (rickTexturesReady) return Promise.resolve();
    return Promise.all([
      TEX.loadImageTexture('rick_idle', 'assets/rick/rick_idle.png', 128),
      TEX.loadImageTexture('rick_walk', 'assets/rick/rick_walk.png', 128),
      TEX.loadImageTexture('rick_death', 'assets/rick/rick_death.png', 128),
    ]).then(() => { rickTexturesReady = true; });
  }

  function start() {
    if (game.started) return;
    startScreen.classList.add('hidden');
    hudEl.classList.remove('hidden');
    crosshair.style.display = 'block';
    game.started = true;
    game.running = true;

    preloadRickTextures();
    initLevel();
    game.raycaster = new Raycaster(canvas, { renderScale: 0.5 });
    game.renderer = new GameRenderer(canvas);
    game.hud = new HUD();

    fitCanvas();
    Sound.unlock();
    try {
      bgMusic.volume = 0.35;
      bgMusic.play().catch(() => { /* browsers may still block; ignore */ });
    } catch (e) {}

    canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
    canvas.requestPointerLock && canvas.requestPointerLock();

    game.lastT = performance.now();
    requestAnimationFrame(loop);
  }

  function restart() {
    gameOver.classList.add('hidden');
    initLevel();
    game.running = true;
    canvas.requestPointerLock && canvas.requestPointerLock();
    game.lastT = performance.now();
    requestAnimationFrame(loop);
  }

  function doGameOver() {
    game.running = false;
    gameOver.classList.remove('hidden');
    document.exitPointerLock && document.exitPointerLock();
    Sound.play('gameover');
  }

  function loop(t) {
    if (!game.running) return;
    let dt = t - game.lastT;
    if (dt > 60) dt = 60;
    game.lastT = t;

    update(dt);
    render();

    game.fpsAcc += dt;
    game.fpsFrames++;
    if (game.fpsAcc >= 500) {
      game.fps = Math.round((game.fpsFrames * 1000) / game.fpsAcc);
      game.fpsAcc = 0; game.fpsFrames = 0;
    }
    game.hud.update(game.player, game.weapon, 1, game.fps, dt);

    requestAnimationFrame(loop);
  }

  function update(dt, keyEvents) {
    const player = game.player;
    if (input.fire && game.weapon.fire(game)) {
      // fire is single-shot per event; keep held for auto-repeat with cooldown
    }
    player.update(dt, input, game.map);

    // Footstep sfx
    if (player.bobActive) {
      game.lastFootstep += dt;
      const rate = input.sprint ? 260 : 380;
      if (game.lastFootstep > rate) { Sound.play('footstep'); game.lastFootstep = 0; }
    }

    // ---- Secret door: proximity + "use" (E) handling ----
    updateSecretDoor(dt);

    for (let i = game.enemies.length - 1; i >= 0; i--) {
      const e = game.enemies[i];
      const res = e.update(dt, player, game.map);
      if (res && res.attacked) {
        Sound.play('hurt');
        damageFlash.classList.add('hit');
        setTimeout(() => damageFlash.classList.remove('hit'), 140);
        game.renderer.triggerShake(e.type === 'rick' ? 12 : 6, e.type === 'rick' ? 320 : 220);
      }
      if (!e.alive && e.deathTime <= 0) {
        if (e === rick.enemy) onRickCorpseGone();
        game.enemies.splice(i, 1);
      }
    }

    // Rick death handling: bar hide + music fade + achievement popup.
    updateRick(dt);

    // Pickups
    for (const p of game.pickups) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d < 0.5) {
        if (p.type === 'ammo') { player.ammo += 15; }
        else if (p.type === 'medkit') { player.heal(25); }
        p.alive = false;
        Sound.play('pickup');
      }
    }

    game.weapon.update(dt, player.bobActive, input.sprint);
    game.renderer.updateParticles(dt);

    if (player.dead) doGameOver();
  }

  // Show the [E] prompt when facing the door within ~1.5 cells and trigger
  // slide-open on key press. Once sliding starts, animate over ~900ms, then
  // spawn Rick + start the boss encounter.
  function updateSecretDoor(dt) {
    if (!rick.door || rick.triggered) { usePrompt.classList.add('hidden'); return; }
    const p = game.player;
    const dx = (rick.door.x + 0.5) - p.x;
    const dy = (rick.door.y + 0.5) - p.y;
    const dist = Math.hypot(dx, dy);
    const angleToDoor = Math.atan2(dy, dx);
    let angleDiff = Math.abs(((angleToDoor - p.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    const facing = angleDiff < 0.55; // ~30°
    const inRange = dist < 1.6;

    if (inRange && facing && !rick.sliding) {
      usePrompt.classList.remove('hidden');
      if (input.use) {
        rick.sliding = true;
        usePrompt.classList.add('hidden');
        // Sound + particles + shake for spawn-in feel.
        Sound.play('pickup');
        game.renderer.triggerShake(10, 400);
        for (let k = 0; k < 20; k++) {
          game.renderer.addSpark(canvas.width/2 + (Math.random()-0.5)*80, canvas.height/2 + (Math.random()-0.5)*80, 1);
        }
      }
    } else {
      usePrompt.classList.add('hidden');
    }

    if (rick.sliding) {
      rick.slideProgress = Math.min(1, rick.slideProgress + dt / 900);
      // Push into raycaster's per-cell sliding map so wall sinks.
      const key = rick.door.x + ',' + rick.door.y;
      if (game.raycaster) game.raycaster.slidingDoors.set(key, rick.slideProgress);
      if (rick.slideProgress >= 1) {
        // Fully open: turn cell into floor + spawn Rick.
        game.map[rick.door.y][rick.door.x] = 0;
        if (game.raycaster) game.raycaster.slidingDoors.delete(key);
        rick.sliding = false;
        rick.triggered = true;
        spawnRick();
      }
    }
  }

  function spawnRick() {
    const e = new Enemy(rick.rickSpawn.x, rick.rickSpawn.y, 'rick');
    // Rick starts hostile immediately.
    e.state = Enemy.STATE ? Enemy.STATE.CHASE : 1;
    game.enemies.push(e);
    rick.enemy = e;
    rick.aliveSince = performance.now();

    // Boss bar in + coloured room tint.
    bossBar.classList.remove('hidden');
    bossBarInner.style.width = '100%';
    secretTint.classList.remove('hidden');
    // small delay lets the CSS transition kick in
    setTimeout(() => secretTint.classList.add('on'), 30);

    // Music: start at very low volume; distance loop will ramp it.
    try {
      rickMusic.volume = 0;
      rickMusic.currentTime = 0;
      rickMusic.play().catch(() => {});
    } catch (err) {}

    // Dramatic spawn burst.
    game.renderer.triggerShake(14, 500);
    const cw = canvas.width, ch = canvas.height;
    for (let k = 0; k < 30; k++) {
      game.renderer.addSpark(cw/2 + (Math.random()-0.5)*120, ch/2 + (Math.random()-0.5)*120, 1);
    }
  }

  function updateRick(dt) {
    if (!rick.enemy) return;
    const e = rick.enemy;
    const player = game.player;

    // Boss bar reflects hp / maxHp.
    const frac = Math.max(0, e.hp / e.maxHp);
    bossBarInner.style.width = (frac * 100) + '%';

    // Distance-based music volume while Rick is alive.
    if (e.alive) {
      const dist = Math.hypot(e.x - player.x, e.y - player.y);
      // Full volume when very close (<2 cells), min ~0.1 at >10 cells.
      const target = Math.max(0.1, Math.min(1.0, 1.2 - dist * 0.09));
      rick.musicVol += (target - rick.musicVol) * Math.min(1, dt / 220);
      try { rickMusic.volume = Math.max(0, Math.min(1, rick.musicVol)); } catch (err) {}
    } else if (!rick.defeated) {
      // Rick just died: trigger achievement + start fadeout.
      rick.defeated = true;
      rick.fadeOut = true;
      game.player.score += e.score;
      // Big burst of blood + sparks at his spot for celebration.
      const cw = canvas.width, ch = canvas.height;
      for (let k = 0; k < 40; k++) {
        game.renderer.addBlood(cw/2 + (Math.random()-0.5)*100, ch/2 + (Math.random()-0.5)*100, 1);
        game.renderer.addSpark(cw/2 + (Math.random()-0.5)*100, ch/2 + (Math.random()-0.5)*100, 1);
      }
      game.renderer.triggerShake(16, 600);
      // Achievement popup (auto-hide after 4.5s).
      if (!rick.achievementShown) {
        rick.achievementShown = true;
        achievement.classList.remove('hidden');
        setTimeout(() => achievement.classList.add('hidden'), 4500);
      }
    }

    // Music fade out over ~2.5s after death.
    if (rick.fadeOut) {
      rick.musicVol = Math.max(0, rick.musicVol - dt / 2500);
      try { rickMusic.volume = rick.musicVol; } catch (err) {}
      if (rick.musicVol <= 0.001) {
        try { rickMusic.pause(); } catch (err) {}
      }
      // Hide boss bar shortly after death.
      if (!e.alive && bossBar && !bossBar.classList.contains('hidden')) {
        setTimeout(() => bossBar.classList.add('hidden'), 900);
      }
    }
  }

  function onRickCorpseGone() {
    // Called when the death sprite finally despawns.
    rick.enemy = null;
    secretTint.classList.remove('on');
    setTimeout(() => secretTint.classList.add('hidden'), 700);
  }

  function render() {
    const shake = game.renderer.applyShake(16);
    const g = canvas.getContext('2d');

    game.raycaster.render(game.map, game.player);

    // Sort sprites back-to-front
    const sprites = [];
    for (const e of game.enemies) {
      const d2 = (e.x - game.player.x) ** 2 + (e.y - game.player.y) ** 2;
      sprites.push({ obj: e, d2, tex: e.tex, x: e.x, y: e.y, scale: e.scale });
    }
    for (const p of game.pickups) {
      if (!p.alive) continue;
      const d2 = (p.x - game.player.x) ** 2 + (p.y - game.player.y) ** 2;
      sprites.push({ obj: p, d2, tex: p.tex, x: p.x, y: p.y, scale: p.scale });
    }
    sprites.sort((a, b) => b.d2 - a.d2);
    for (const s of sprites) {
      game.raycaster.drawSprite({ x: s.x, y: s.y, tex: s.tex, scale: s.scale }, game.player);
    }

    game.raycaster.present();

    // Overlay layer with shake
    g.save();
    g.translate(shake.x, shake.y);
    game.renderer.drawWeapon(game.weapon, canvas.width, canvas.height);
    game.renderer.drawParticles();
    g.restore();
  }

  // ---------- Input ----------
  // 'e' is intentionally NOT a turn key here — arrow keys handle turning.
  // We reclaim 'e' as the "use" action for the secret door.
  const keyMap = {
    'w': 'forward', 'arrowup': 'forward',
    's': 'back',    'arrowdown': 'back',
    'a': 'left',    'q': 'turnLeft',
    'd': 'right',
    'arrowleft': 'turnLeft', 'arrowright': 'turnRight',
    'shift': 'sprint'
  };
  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k in keyMap) { input[keyMap[k]] = true; e.preventDefault(); }
    if (k === ' ') { input.fire = true; e.preventDefault(); }
    if (k === 'e') { input.use = true; e.preventDefault(); }
    if (k === 'escape') { document.exitPointerLock && document.exitPointerLock(); }
  });
  document.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k in keyMap) { input[keyMap[k]] = false; }
    if (k === ' ') { input.fire = false; }
    if (k === 'e') { input.use = false; }
  });
  document.addEventListener('mousedown', (e) => {
    if (!game.started) return;
    if (e.button === 0) input.fire = true;
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.fire = false;
  });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      input.mouseDX += e.movementX || 0;
    }
  });

  startBtn.addEventListener('click', start);
  restartBtn.addEventListener('click', restart);
  window.addEventListener('resize', fitCanvas);
  canvas.addEventListener('click', () => {
    if (game.started && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock && canvas.requestPointerLock();
    }
  });

  // Debug hook (safe to keep — used by automated tests and QA).
  window.__doomfall = { game, rick, input };
})();
