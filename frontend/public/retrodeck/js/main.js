/* Main shell state machine: boot -> home -> detail -> game */
(function () {
  const screens = {
    boot: document.getElementById('boot-screen'),
    home: document.getElementById('home-screen'),
    detail: document.getElementById('detail-screen'),
    game: document.getElementById('game-screen')
  };
  const menuMusic = document.getElementById('menu-music');
  let currentGame = null; // { teardown } or iframe

  function show(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  function glitch() {
    const g = document.createElement('div');
    g.className = 'glitch-transition';
    document.body.appendChild(g);
    setTimeout(() => g.remove(), 800);
  }

  function startBoot() {
    show('boot');
    RetroBoot.boot(goHome);
  }

  function goHome() {
    show('home');
    try { menuMusic.volume = 0.3; menuMusic.play().catch(() => {}); } catch (e) {}
    RetroHome.build(showDetail);
    RetroHome.updateSelection();
    document.getElementById('detail-back').onclick = goHome;
    if (!goHome._keysInit) {
      goHome._keysInit = true;
      // Defer key listener attach so the Enter that started us doesn't auto-select.
      setTimeout(() => RetroHome.initKeys(showDetail), 250);
    }
  }

  function showDetail(cart) {
    show('detail');
    RetroDetail.show(cart, insertCart);
  }

  function insertCart(cart) {
    glitch();
    setTimeout(() => launchGame(cart), 400);
  }

  function launchGame(cart) {
    show('game');
    try { menuMusic.pause(); } catch (e) {}
    document.getElementById('chrome-title').textContent = cart.title + ' — ' + cart.tagline;
    document.getElementById('chrome-info').textContent = cart.genre;
    const frame = document.getElementById('game-frame');
    frame.innerHTML = '';

    document.getElementById('game-eject').onclick = ejectGame;

    if (cart.id === 'doomfall') {
      const iframe = document.createElement('iframe');
      iframe.src = '/game/index.html';
      iframe.allow = 'autoplay; fullscreen; pointer-lock';
      iframe.setAttribute('data-testid', 'doomfall-iframe');
      frame.appendChild(iframe);
      currentGame = { teardown: () => { frame.innerHTML = ''; } };
    } else if (cart.id === 'overdrive') {
      currentGame = Overdrive.create(frame, showVictory('overdrive'), showDefeat('overdrive'));
    } else if (cart.id === 'roadfury') {
      currentGame = RoadFury.create(frame, showVictory('roadfury'), showDefeat('roadfury'));
    }
  }

  function showVictory(gameId) {
    return () => {
      const frame = document.getElementById('game-frame');
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,20,0,0.9);color:#4fff8a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;font-family:"Press Start 2P",monospace;';
      overlay.innerHTML = `
        <h2 style="font-size:48px;letter-spacing:6px;text-shadow:0 0 20px #4fff8a;" data-testid="victory-text">VICTORY</h2>
        <p style="font-size:20px;color:#8dff8d;font-family:VT323">Cartridge complete. Ejecting back to shelf...</p>
        <p id="victory-count" style="font-size:16px;color:#ffb347">Returning in 5</p>
      `;
      frame.appendChild(overlay);
      let n = 5;
      const timer = setInterval(() => {
        n--;
        const el = document.getElementById('victory-count');
        if (el) el.textContent = `Returning in ${n}`;
        if (n <= 0) { clearInterval(timer); ejectGame(); }
      }, 1000);
    };
  }
  function showDefeat(gameId) {
    return () => {
      const frame = document.getElementById('game-frame');
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:absolute;inset:0;background:rgba(20,0,0,0.9);color:#ff5c3a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;font-family:"Press Start 2P",monospace;';
      overlay.innerHTML = `
        <h2 style="font-size:48px;letter-spacing:6px;text-shadow:0 0 20px #ff3b1e;" data-testid="defeat-text">GAME OVER</h2>
        <p style="font-size:20px;color:#ff8a6a;font-family:VT323">INSERT COIN TO CONTINUE</p>
        <div style="display:flex;gap:20px;">
          <button class="insert-btn" id="retry-btn" data-testid="retry-btn">RETRY</button>
          <button class="back-btn" id="giveup-btn" data-testid="giveup-btn">SHELF</button>
        </div>
      `;
      frame.appendChild(overlay);
      document.getElementById('retry-btn').onclick = () => {
        const cart = RetroHome.CARTS.find(c => c.id === gameId);
        insertCart(cart);
      };
      document.getElementById('giveup-btn').onclick = ejectGame;
    };
  }

  function ejectGame() {
    if (currentGame && currentGame.teardown) currentGame.teardown();
    currentGame = null;
    glitch();
    setTimeout(goHome, 400);
  }

  // Boot on load
  window.addEventListener('load', () => {
    startBoot();
  });

  // Global ESC handling in detail screen
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && screens.detail.classList.contains('active')) {
      goHome();
    }
  });
})();
