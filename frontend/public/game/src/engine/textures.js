/* Procedural pixel-art textures. Every texture is 64x64.
   All textures are stored as Uint32Array (ABGR little-endian).
   TEX.get(name) returns { w, h, data } for the raycaster. */
(function () {
  const TSIZE = 64;
  const cache = {};

  function rgb(r, g, b) {
    return (255 << 24) | (b << 16) | (g << 8) | r;
  }

  function makeCanvasTex(name, drawFn) {
    const c = document.createElement('canvas');
    c.width = TSIZE; c.height = TSIZE;
    const ctx = c.getContext('2d');
    drawFn(ctx);
    const img = ctx.getImageData(0, 0, TSIZE, TSIZE);
    const data = new Uint32Array(img.data.buffer);
    cache[name] = { w: TSIZE, h: TSIZE, data };
    return cache[name];
  }

  function noise(ctx, base, variance, density) {
    for (let y = 0; y < TSIZE; y++) {
      for (let x = 0; x < TSIZE; x++) {
        if (Math.random() < density) {
          const v = base + (Math.random() * 2 - 1) * variance;
          const c = Math.max(0, Math.min(255, v | 0));
          ctx.fillStyle = `rgb(${c},${(c * 0.85) | 0},${(c * 0.7) | 0})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  // Brick wall
  makeCanvasTex('brick', (ctx) => {
    ctx.fillStyle = '#3a1a10'; ctx.fillRect(0, 0, TSIZE, TSIZE);
    for (let row = 0; row < 8; row++) {
      const yOff = row * 8;
      const stagger = (row % 2) * 8;
      for (let col = -1; col < 9; col++) {
        const x = col * 16 + stagger;
        // brick body
        const shade = 70 + (Math.random() * 30) | 0;
        ctx.fillStyle = `rgb(${140 + shade * 0.4 | 0}, ${50 + shade * 0.3 | 0}, ${30 + shade * 0.2 | 0})`;
        ctx.fillRect(x + 1, yOff + 1, 14, 6);
        // highlight
        ctx.fillStyle = 'rgba(255, 190, 130, 0.25)';
        ctx.fillRect(x + 1, yOff + 1, 14, 1);
        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x + 1, yOff + 6, 14, 1);
      }
    }
    // grout is base color (dark)
    // grimy noise
    noise(ctx, 90, 30, 0.05);
  });

  // Stone wall
  makeCanvasTex('stone', (ctx) => {
    ctx.fillStyle = '#5a5a5a'; ctx.fillRect(0, 0, TSIZE, TSIZE);
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() * TSIZE) | 0;
      const y = (Math.random() * TSIZE) | 0;
      const w = 4 + ((Math.random() * 10) | 0);
      const h = 4 + ((Math.random() * 6) | 0);
      const g = 70 + ((Math.random() * 60) | 0);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x, y + h - 1, w, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x, y, w, 1);
    }
    noise(ctx, 100, 30, 0.08);
  });

  // Metal / hazard wall
  makeCanvasTex('metal', (ctx) => {
    ctx.fillStyle = '#3a3a48'; ctx.fillRect(0, 0, TSIZE, TSIZE);
    // rivets and panels
    for (let py = 0; py < 4; py++) {
      for (let px = 0; px < 4; px++) {
        const x = px * 16, y = py * 16;
        ctx.strokeStyle = '#1e1e28'; ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, 15, 15);
        ctx.fillStyle = '#5a5a70'; ctx.fillRect(x + 2, y + 2, 12, 12);
        ctx.fillStyle = '#20202a';
        ctx.fillRect(x + 3, y + 3, 2, 2);
        ctx.fillRect(x + 11, y + 3, 2, 2);
        ctx.fillRect(x + 3, y + 11, 2, 2);
        ctx.fillRect(x + 11, y + 11, 2, 2);
      }
    }
    // scratches
    for (let i = 0; i < 6; i++) {
      const x = (Math.random() * TSIZE) | 0;
      const y = (Math.random() * TSIZE) | 0;
      ctx.fillStyle = 'rgba(255,220,150,0.15)';
      ctx.fillRect(x, y, 8, 1);
    }
  });

  // Floor: dark checker
  makeCanvasTex('floor', (ctx) => {
    for (let y = 0; y < TSIZE; y++) {
      for (let x = 0; x < TSIZE; x++) {
        const cx = (x / 16) | 0, cy = (y / 16) | 0;
        const on = (cx + cy) % 2 === 0;
        const base = on ? 55 : 35;
        const jitter = ((Math.random() * 14) | 0) - 7;
        const v = Math.max(0, Math.min(255, base + jitter));
        ctx.fillStyle = `rgb(${v},${(v * 0.9) | 0},${(v * 0.75) | 0})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  // Ceiling: dark blue-grey noisy
  makeCanvasTex('ceiling', (ctx) => {
    for (let y = 0; y < TSIZE; y++) {
      for (let x = 0; x < TSIZE; x++) {
        const v = 20 + ((Math.random() * 18) | 0);
        ctx.fillStyle = `rgb(${(v * 0.8) | 0},${(v * 0.85) | 0},${v})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  // Door (bright metallic)
  makeCanvasTex('door', (ctx) => {
    ctx.fillStyle = '#7a5820'; ctx.fillRect(0, 0, TSIZE, TSIZE);
    ctx.fillStyle = '#a67830'; ctx.fillRect(6, 4, TSIZE - 12, TSIZE - 8);
    ctx.fillStyle = '#4a3418'; ctx.fillRect(8, 6, TSIZE - 16, TSIZE - 12);
    // handle
    ctx.fillStyle = '#ffcf6a'; ctx.fillRect(46, 30, 4, 8);
    // rivets
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#3a2a14';
      ctx.fillRect(8, 8 + i * 15, 3, 3);
      ctx.fillRect(TSIZE - 11, 8 + i * 15, 3, 3);
    }
  });

  // ---------- Enemy sprites (32x32 -> 64x64 upscaled) ----------
  function makeSprite(name, drawFn, size = 64) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    drawFn(ctx, size);
    const img = ctx.getImageData(0, 0, size, size);
    cache[name] = { w: size, h: size, data: new Uint32Array(img.data.buffer) };
    return cache[name];
  }

  // Guard: brown uniform, small
  makeSprite('guard', (ctx, S) => {
    ctx.clearRect(0, 0, S, S);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(18, 58, 28, 4);
    // legs
    ctx.fillStyle = '#3a2a18'; ctx.fillRect(24, 44, 6, 16); ctx.fillRect(34, 44, 6, 16);
    // boots
    ctx.fillStyle = '#1a1208'; ctx.fillRect(23, 56, 8, 4); ctx.fillRect(33, 56, 8, 4);
    // body (brown uniform)
    ctx.fillStyle = '#8a5a2a'; ctx.fillRect(20, 22, 24, 24);
    ctx.fillStyle = '#a06a34'; ctx.fillRect(20, 22, 24, 4);
    // belt
    ctx.fillStyle = '#2a1a08'; ctx.fillRect(20, 38, 24, 3);
    ctx.fillStyle = '#ffd54a'; ctx.fillRect(30, 39, 4, 2);
    // head
    ctx.fillStyle = '#e0b088'; ctx.fillRect(24, 8, 16, 14);
    // helmet
    ctx.fillStyle = '#4a3218'; ctx.fillRect(22, 6, 20, 6);
    ctx.fillStyle = '#6a4828'; ctx.fillRect(22, 6, 20, 2);
    // eyes
    ctx.fillStyle = '#000'; ctx.fillRect(27, 14, 2, 3); ctx.fillRect(35, 14, 2, 3);
    // gun
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(42, 28, 12, 4);
    ctx.fillStyle = '#4a4a4a'; ctx.fillRect(52, 29, 2, 2);
  });

  // Soldier: green uniform, taller
  makeSprite('soldier', (ctx, S) => {
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(16, 58, 32, 4);
    // legs
    ctx.fillStyle = '#2a3a20'; ctx.fillRect(22, 40, 8, 18); ctx.fillRect(34, 40, 8, 18);
    ctx.fillStyle = '#101008'; ctx.fillRect(21, 56, 10, 4); ctx.fillRect(33, 56, 10, 4);
    // body (green)
    ctx.fillStyle = '#4a6a2a'; ctx.fillRect(18, 18, 28, 26);
    ctx.fillStyle = '#5a7a3a'; ctx.fillRect(18, 18, 28, 3);
    // ammo strap
    ctx.fillStyle = '#8a6a2a'; ctx.fillRect(18, 24, 28, 3);
    ctx.fillStyle = '#ffd54a';
    for (let i = 0; i < 6; i++) ctx.fillRect(20 + i * 5, 25, 2, 2);
    // head
    ctx.fillStyle = '#c89878'; ctx.fillRect(24, 6, 16, 14);
    // helmet (green with stripe)
    ctx.fillStyle = '#3a5020'; ctx.fillRect(22, 4, 20, 6);
    ctx.fillStyle = '#5a7030'; ctx.fillRect(22, 4, 20, 2);
    ctx.fillStyle = '#ff3b1e'; ctx.fillRect(30, 5, 4, 1);
    // eyes (angry)
    ctx.fillStyle = '#ff3020'; ctx.fillRect(27, 12, 3, 2); ctx.fillRect(35, 12, 3, 2);
    // rifle
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(44, 26, 16, 4);
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(44, 30, 8, 3);
  });

  // Barrel / medkit / ammo pickups
  makeSprite('medkit', (ctx, S) => {
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(20, 48, 24, 4);
    ctx.fillStyle = '#e8e8e8'; ctx.fillRect(18, 28, 28, 22);
    ctx.fillStyle = '#c8c8c8'; ctx.fillRect(18, 46, 28, 4);
    ctx.fillStyle = '#ff2020'; ctx.fillRect(28, 34, 8, 10); ctx.fillRect(24, 36, 16, 6);
    ctx.fillStyle = '#1a1a1a'; ctx.strokeStyle = '#1a1a1a';
    ctx.fillRect(18, 28, 28, 2);
  });

  makeSprite('ammo', (ctx, S) => {
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(22, 48, 20, 4);
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(20, 34, 24, 16);
    ctx.fillStyle = '#5a5a5a'; ctx.fillRect(20, 34, 24, 3);
    ctx.fillStyle = '#ffd54a'; ctx.fillRect(24, 38, 4, 10);
    ctx.fillStyle = '#ffd54a'; ctx.fillRect(30, 38, 4, 10);
    ctx.fillStyle = '#ffd54a'; ctx.fillRect(36, 38, 4, 10);
  });

  // ---------- Weapon HUD sprite: Pistol (drawn on canvas at runtime,
  // but we generate a reusable canvas here for perf) ----------
  const pistolCanvas = document.createElement('canvas');
  pistolCanvas.width = 200; pistolCanvas.height = 160;
  {
    const g = pistolCanvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    // hand
    g.fillStyle = '#c89878'; g.fillRect(60, 90, 60, 60);
    g.fillStyle = '#a87858'; g.fillRect(60, 90, 60, 6);
    // sleeve
    g.fillStyle = '#3a2a14'; g.fillRect(50, 130, 80, 30);
    g.fillStyle = '#5a4218'; g.fillRect(50, 130, 80, 4);
    // gun body
    g.fillStyle = '#1a1a1a'; g.fillRect(70, 40, 60, 60);
    g.fillStyle = '#3a3a3a'; g.fillRect(70, 40, 60, 6);
    // barrel
    g.fillStyle = '#0a0a0a'; g.fillRect(90, 20, 20, 30);
    g.fillStyle = '#2a2a2a'; g.fillRect(94, 20, 12, 6);
    // trigger guard
    g.fillStyle = '#0a0a0a'; g.fillRect(88, 100, 24, 20);
    g.fillStyle = '#1a1a1a'; g.fillRect(92, 104, 16, 12);
    // grip texture lines
    g.fillStyle = '#2a2a2a';
    for (let i = 0; i < 6; i++) g.fillRect(72, 46 + i * 8, 56, 1);
  }
  cache._pistolCanvas = pistolCanvas;

  // ---- New weapon HUD canvases: M4, AK, Deagle, Knife ----
  function makeWeaponCanvas(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    draw(g);
    return c;
  }

  const m4Canvas = makeWeaponCanvas(260, 180, (g) => {
    // hands + sleeves
    g.fillStyle = '#3a2a14'; g.fillRect(20, 130, 220, 50);
    g.fillStyle = '#5a4218'; g.fillRect(20, 130, 220, 5);
    g.fillStyle = '#c89878'; g.fillRect(60, 100, 40, 40); g.fillRect(160, 100, 40, 40);
    // upper receiver
    g.fillStyle = '#1a1a1a'; g.fillRect(50, 40, 180, 32);
    g.fillStyle = '#2f2f2f'; g.fillRect(50, 40, 180, 4);
    // barrel + suppressor
    g.fillStyle = '#0a0a0a'; g.fillRect(210, 46, 40, 14);
    g.fillStyle = '#2a2a2a'; g.fillRect(232, 44, 6, 18);
    // rail + sight
    g.fillStyle = '#3a3a3a'; g.fillRect(70, 34, 100, 6);
    g.fillStyle = '#4ff0ff'; g.fillRect(120, 28, 6, 8);
    // magazine
    g.fillStyle = '#1a1a1a'; g.fillRect(115, 68, 22, 44);
    g.fillStyle = '#2a2a2a'; g.fillRect(115, 68, 22, 4);
    // grip
    g.fillStyle = '#141414'; g.fillRect(140, 72, 20, 44);
    // stock
    g.fillStyle = '#1a1a1a'; g.fillRect(10, 46, 44, 20);
  });

  const akCanvas = makeWeaponCanvas(260, 180, (g) => {
    g.fillStyle = '#3a2a14'; g.fillRect(20, 130, 220, 50);
    g.fillStyle = '#5a4218'; g.fillRect(20, 130, 220, 5);
    g.fillStyle = '#c89878'; g.fillRect(60, 100, 40, 40); g.fillRect(160, 100, 40, 40);
    // Wood furniture
    g.fillStyle = '#7a4818'; g.fillRect(30, 60, 40, 22);
    g.fillStyle = '#8a5820'; g.fillRect(150, 74, 40, 18);
    g.fillStyle = '#5a3812'; g.fillRect(30, 60, 40, 3);
    // receiver
    g.fillStyle = '#1a1a1a'; g.fillRect(70, 50, 140, 30);
    g.fillStyle = '#3a3a3a'; g.fillRect(70, 50, 140, 3);
    // barrel & gas block
    g.fillStyle = '#0a0a0a'; g.fillRect(200, 54, 50, 12);
    g.fillStyle = '#2a2a2a'; g.fillRect(180, 44, 14, 14);
    // curved mag
    g.fillStyle = '#4a3218'; g.fillRect(110, 78, 30, 40);
    g.fillStyle = '#6a4818'; g.fillRect(110, 78, 30, 4);
    g.fillStyle = '#4a3218'; g.fillRect(140, 88, 6, 30);
    // rear sight
    g.fillStyle = '#2a2a2a'; g.fillRect(85, 44, 6, 8);
  });

  const deagleCanvas = makeWeaponCanvas(240, 200, (g) => {
    g.fillStyle = '#3a2a14'; g.fillRect(30, 130, 180, 60);
    g.fillStyle = '#5a4218'; g.fillRect(30, 130, 180, 5);
    g.fillStyle = '#c89878'; g.fillRect(80, 90, 80, 50);
    // Gold Deagle body
    g.fillStyle = '#b58a2a'; g.fillRect(90, 40, 100, 60);
    g.fillStyle = '#d8a840'; g.fillRect(90, 40, 100, 6);
    // barrel
    g.fillStyle = '#8a6a20'; g.fillRect(160, 30, 40, 30);
    g.fillStyle = '#c8983a'; g.fillRect(160, 30, 40, 5);
    // slide texture
    g.fillStyle = '#5a4212';
    for (let i = 0; i < 5; i++) g.fillRect(100 + i * 8, 60, 3, 20);
    // grip
    g.fillStyle = '#2a1a08'; g.fillRect(112, 100, 40, 40);
    g.fillStyle = '#4a2a10';
    for (let i = 0; i < 4; i++) g.fillRect(112, 108 + i * 8, 40, 2);
    // trigger
    g.fillStyle = '#0a0a0a'; g.fillRect(150, 98, 16, 16);
    // hammer
    g.fillStyle = '#5a4212'; g.fillRect(88, 44, 8, 12);
  });

  const knifeCanvas = makeWeaponCanvas(220, 200, (g) => {
    g.fillStyle = '#3a2a14'; g.fillRect(50, 140, 120, 50);
    g.fillStyle = '#c89878'; g.fillRect(70, 100, 80, 50);
    // Karambit — curved blade
    g.fillStyle = '#e5e5e8';
    g.beginPath();
    g.moveTo(120, 80); g.quadraticCurveTo(210, 40, 190, 130); g.lineTo(180, 130); g.quadraticCurveTo(200, 60, 120, 90); g.closePath();
    g.fill();
    g.fillStyle = '#7a7a7a';
    g.beginPath();
    g.moveTo(120, 80); g.quadraticCurveTo(210, 40, 190, 130); g.lineTo(180, 130); g.quadraticCurveTo(200, 60, 120, 90); g.closePath();
    g.stroke();
    // handle
    g.fillStyle = '#2a1a08'; g.fillRect(80, 90, 44, 44);
    g.fillStyle = '#4a2a10';
    for (let i = 0; i < 5; i++) g.fillRect(80, 96 + i * 8, 44, 2);
    // finger ring
    g.strokeStyle = '#2a1a08'; g.lineWidth = 6;
    g.beginPath(); g.arc(70, 118, 14, 0, Math.PI * 2); g.stroke();
    // blade glint
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(140, 78); g.quadraticCurveTo(195, 60, 190, 100); g.stroke();
  });

  cache._weaponCanvases = { M4A1: m4Canvas, 'AK-47': akCanvas, 'DESERT EAGLE': deagleCanvas, KARAMBIT: knifeCanvas };

  // Armor pickup sprite (blue shield-ish).
  makeSprite('armorPickup', (ctx, S) => {
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(20, 48, 24, 4);
    ctx.fillStyle = '#4ff0ff'; ctx.fillRect(20, 28, 24, 22);
    ctx.fillStyle = '#2fa8d8'; ctx.fillRect(20, 44, 24, 6);
    ctx.fillStyle = '#a8f8ff'; ctx.fillRect(20, 28, 24, 3);
    ctx.fillStyle = '#0a1a3a'; ctx.fillRect(26, 32, 12, 14);
    ctx.fillStyle = '#ffe57a'; ctx.fillRect(30, 34, 4, 10); ctx.fillRect(28, 38, 8, 3);
  });

  // ---- External image loader (for Rick easter egg sprites) ----
  function loadImageTexture(name, src, size = 128) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = size; c.height = size;
          const ctx = c.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          const s = Math.min(size / img.width, size / img.height);
          const w = img.width * s, h = img.height * s;
          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          const imgData = ctx.getImageData(0, 0, size, size);
          const raw = imgData.data;
          // Color-key: turn near-white pixels transparent (in case PNG has no alpha).
          for (let i = 0; i < raw.length; i += 4) {
            const r = raw[i], g = raw[i + 1], b = raw[i + 2];
            if (r > 240 && g > 240 && b > 240) raw[i + 3] = 0;
          }
          const arr = new Uint32Array(raw.buffer);
          cache[name] = { w: size, h: size, data: arr };
          resolve(cache[name]);
        } catch (err) {
          console.error('loadImageTexture(' + name + ') failed:', err);
          resolve(null);
        }
      };
      img.onerror = (e) => { console.error('image load failed:', src, e); resolve(null); };
      img.src = src;
    });
  }

  window.TEX = {
    get(name) { return cache[name]; },
    all: cache,
    pistolCanvas,
    weaponCanvases: cache._weaponCanvases,
    TSIZE,
    loadImageTexture
  };
})();
