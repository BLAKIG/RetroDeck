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
  const hitMarker = document.getElementById('hit-marker');
  const streakPopup = document.getElementById('streak-popup');
  const streakCountTxt = document.getElementById('streak-count-txt');
  const streakNameTxt = document.getElementById('streak-name-txt');
  const buffStack = document.getElementById('buff-stack');
  const damageIndicator = document.getElementById('damage-indicator');
  const lowHealth = document.getElementById('low-health');
  const toast = document.getElementById('toast');

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
    game.player.armor = 0;
    game.player.ammo = 999; // legacy field (unused now that Arsenal owns ammo).
    game.enemies = L.enemies.map(e => new Enemy(e.x, e.y, e.type));
    game.pickups = L.pickups.map(p => ({ ...p, tex: TEX.get(p.type), scale: 0.6, alive: true }));
    // Extra loot pool populated by enemy drops.
    game.loot = [];
    game.arsenal = new Arsenal();
    game.weapon = game.arsenal.current();
    game.streak = new KillStreak();
    game.buffs = new Buffs();
    game.barrels = (L.barrels || []).map(b => new Barrel(b.x, b.y));

    // Wire hooks used by weapons.
    game._onHitConfirmed = (enemy) => {
      hitMarker.classList.remove('on');
      void hitMarker.offsetWidth;
      hitMarker.classList.add('on');
      Sound.play('hitMarker');
    };
    // Called by Barrel.detonate + Enemy.attack — points the damage indicator
    // at the source and briefly shows it.
    game._onPlayerHitFrom = (sx, sy) => {
      const p = game.player;
      const ang = Math.atan2(sy - p.y, sx - p.x) - p.angle;
      damageIndicator.style.transform =
        `translate(-50%, -50%) rotate(${(ang * 180 / Math.PI + 90).toFixed(1)}deg)`;
      damageIndicator.classList.remove('hidden');
      clearTimeout(game._dmgIndTimer);
      game._dmgIndTimer = setTimeout(() => damageIndicator.classList.add('hidden'), 700);
    };
    game._toast = (msg) => {
      toast.textContent = msg;
      toast.classList.remove('show', 'hidden');
      void toast.offsetWidth;
      toast.classList.add('show');
      clearTimeout(game._toastTimer);
      game._toastTimer = setTimeout(() => toast.classList.add('hidden'), 2600);
    };
    game._onEnemyKilled = (enemy) => {
      // Kill streak.
      const now = performance.now();
      const tier = game.streak.onKill(now);
      if (tier) {
        streakCountTxt.textContent = `${game.streak.count} KILLS`;
        streakNameTxt.textContent = tier.name;
        streakNameTxt.style.color = tier.color;
        streakPopup.classList.remove('show');
        void streakPopup.offsetWidth;
        streakPopup.classList.add('show');
        streakPopup.classList.remove('hidden');
        Sound.play('streak', tier.freq);
      }
      // Loot drops.
      if (window.LootSystem) {
        const drops = LootSystem.rollDrops(enemy.type, enemy.x, enemy.y);
        for (const d of drops) game.loot.push(d);
      }
    };

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
    game.hud.update(game.player, game.weapon, 1, game.fps, dt, {
      streak: game.streak ? game.streak.count : 0,
      slot: game.arsenal ? game.arsenal.currentSlot : 1
    });

    requestAnimationFrame(loop);
  }

  function update(dt, keyEvents) {
    const player = game.player;
    if (input.fire && game.weapon.fire(game)) {
      // Auto-fire is handled by per-weapon cooldown; keep held.
    }
    // Speed boost buff: temporarily raise movement speed.
    const baseSpeed = 3.0;
    player.moveSpeed = (game.buffs && game.buffs.has('speed')) ? baseSpeed * 1.55 : baseSpeed;
    player.update(dt, input, game.map);

    // Keep game.weapon in sync with the arsenal's currently equipped weapon.
    game.weapon = game.arsenal.current();

    // Kill streak decay + buffs.
    game.streak.update(performance.now());
    game.buffs.update(performance.now());
    renderBuffStack();

    // Low health warning + heartbeat.
    if (player.health <= 30 && !player.dead) lowHealth.classList.remove('hidden');
    else lowHealth.classList.add('hidden');

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
        if (game._onPlayerHitFrom) game._onPlayerHitFrom(e.x, e.y);
      }
      if (!e.alive && e.deathTime <= 0) {
        if (e === rick.enemy) onRickCorpseGone();
        game.enemies.splice(i, 1);
      }
    }

    // Barrels: any that were shot below 0 hp explode after their fuse.
    if (game.barrels) {
      const now = performance.now();
      for (const b of game.barrels) {
        if (!b.alive && b._explodeAt && now >= b._explodeAt && !b._detonated) {
          b._detonated = true;
          b.detonate(game);
        }
      }
    }

    // Rick death handling: bar hide + music fade + achievement popup.
    updateRick(dt);

    // Pickups (auto-collect world medkits/ammo laid out in level)
    for (const p of game.pickups) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d < 0.5) {
        if (p.type === 'ammo') { game.arsenal.addAmmo('rifle', 15); }
        else if (p.type === 'medkit') { player.heal(25); }
        p.alive = false;
        Sound.play('pickup');
      }
    }

    // Enemy-dropped loot: requires E press when facing it, prompt hoverable.
    updateLoot(dt);

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
    rick.enemy = null;
    secretTint.classList.remove('on');
    setTimeout(() => secretTint.classList.add('hidden'), 700);
  }

  // ---- Loot pickup logic ----
  let _lootPromptShown = false;
  function updateLoot(dt) {
    if (!game.loot) return;
    const player = game.player;
    let near = null;
    for (const l of game.loot) {
      if (!l.alive) continue;
      const d = Math.hypot(l.x - player.x, l.y - player.y);
      if (d < 0.7 && (!near || d < near._dist)) { near = l; near._dist = d; }
    }
    // Only show pickup prompt if we're NOT prompting the secret door already.
    if (near && !usePrompt.classList.contains('show-secret')) {
      usePrompt.textContent = '[E] PICK UP';
      usePrompt.classList.remove('hidden');
      _lootPromptShown = true;
      if (input.use) {
        applyLoot(near);
        near.alive = false;
        Sound.play('pickup');
      }
    } else if (_lootPromptShown) {
      _lootPromptShown = false;
      // Restore default text so the secret-door path still uses "[E] OPEN".
      usePrompt.textContent = '[E] OPEN';
      usePrompt.classList.add('hidden');
    }
    // Compact dead loot occasionally.
    if (game.loot.length > 40) game.loot = game.loot.filter(l => l.alive);
  }
  function applyLoot(l) {
    const player = game.player;
    if (l.isPowerup && window.PowerUps) {
      game.buffs.apply(l.id);
      const def = PowerUps.DEFS[l.id];
      Sound.play('powerup');
      if (game._toast) game._toast(def.name + ' ACTIVE');
      return;
    }
    if (l.kind === 'ammo') { game.arsenal.addAmmo('rifle', l.amount); if (game._toast) game._toast('+' + l.amount + ' AMMO'); }
    else if (l.kind === 'medkit') { player.heal(l.amount); if (game._toast) game._toast('+' + l.amount + ' HP'); }
    else if (l.kind === 'armor') { player.armor = Math.min(100, (player.armor || 0) + l.amount); if (game._toast) game._toast('+' + l.amount + ' ARMOR'); }
  }

  function renderBuffStack() {
    if (!game.buffs) return;
    const active = game.buffs.list();
    // Clear + rebuild only when set changes (cheap comparison via ids).
    const key = active.map(a => a.id).join(',');
    if (buffStack._key === key) {
      // Just update timers.
      for (const a of active) {
        const el = buffStack.querySelector('[data-buff="' + a.id + '"]');
        if (el) {
          el.querySelector('.buff-time').textContent = Math.ceil(a.remaining / 1000) + 's';
          el.querySelector('.buff-progress').style.width = ((a.remaining / a.def.duration) * 100) + '%';
        }
      }
      return;
    }
    buffStack._key = key;
    buffStack.innerHTML = '';
    for (const a of active) {
      const el = document.createElement('div');
      el.className = 'buff-icon';
      el.setAttribute('data-buff', a.id);
      el.setAttribute('data-testid', 'buff-' + a.id);
      el.style.borderColor = a.def.color;
      el.style.color = a.def.color;
      el.innerHTML = `<div class="buff-glyph">${a.def.icon}</div><div class="buff-time"></div><div class="buff-progress" style="width:100%"></div>`;
      buffStack.appendChild(el);
    }
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
    if (game.loot) for (const l of game.loot) {
      if (!l.alive) continue;
      const d2 = (l.x - game.player.x) ** 2 + (l.y - game.player.y) ** 2;
      // Powerup crystals bob and rotate slightly for visual interest.
      if (l.isPowerup) l.bob = (l.bob || 0) + 0.09;
      sprites.push({ obj: l, d2, tex: l.tex, x: l.x, y: l.y, scale: l.scale });
    }
    if (game.barrels) for (const b of game.barrels) {
      if (!b.alive) continue;
      const d2 = (b.x - game.player.x) ** 2 + (b.y - game.player.y) ** 2;
      sprites.push({ obj: b, d2, tex: b.tex, x: b.x, y: b.y, scale: b.scale });
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
    if (k === 'r' && game.arsenal) { game.arsenal.reloadCurrent(); e.preventDefault(); }
    if ((k === '1' || k === '2' || k === '3') && game.arsenal) {
      game.arsenal.switchTo(parseInt(k, 10));
      e.preventDefault();
    }
    if (k === 'escape') { document.exitPointerLock && document.exitPointerLock(); }
  });
  document.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k in keyMap) { input[keyMap[k]] = false; }
    if (k === ' ') { input.fire = false; }
    if (k === 'e') { input.use = false; }
  });
  document.addEventListener('wheel', (e) => {
    if (!game.started || !game.arsenal) return;
    game.arsenal.cycle(e.deltaY > 0 ? 1 : -1);
    e.preventDefault();
  }, { passive: false });
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
