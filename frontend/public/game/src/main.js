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
    fire: false, mouseDX: 0
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
  }

  function start() {
    if (game.started) return;
    startScreen.classList.add('hidden');
    hudEl.classList.remove('hidden');
    crosshair.style.display = 'block';
    game.started = true;
    game.running = true;

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

  function update(dt) {
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

    for (let i = game.enemies.length - 1; i >= 0; i--) {
      const e = game.enemies[i];
      const res = e.update(dt, player, game.map);
      if (res && res.attacked) {
        Sound.play('hurt');
        damageFlash.classList.add('hit');
        setTimeout(() => damageFlash.classList.remove('hit'), 140);
        game.renderer.triggerShake(6, 220);
      }
      if (!e.alive && e.deathTime <= 0) game.enemies.splice(i, 1);
    }

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
  const keyMap = {
    'w': 'forward', 'arrowup': 'forward',
    's': 'back',    'arrowdown': 'back',
    'a': 'left',    'q': 'turnLeft',
    'd': 'right',   'e': 'turnRight',
    'arrowleft': 'turnLeft', 'arrowright': 'turnRight',
    'shift': 'sprint'
  };
  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k in keyMap) { input[keyMap[k]] = true; e.preventDefault(); }
    if (k === ' ') { input.fire = true; e.preventDefault(); }
    if (k === 'escape') { document.exitPointerLock && document.exitPointerLock(); }
  });
  document.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k in keyMap) { input[keyMap[k]] = false; }
    if (k === ' ') { input.fire = false; }
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
})();
