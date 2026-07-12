/* Power-ups: temporary buffs the player picks up.
   Each has: id, name, color, icon (single-char), duration (ms), apply(player).
   Rendered as world sprites via existing raycaster.drawSprite. */
(function () {
  const DEFS = {
    double: {
      id: 'double', name: '2x DAMAGE', color: '#ff3b1e', icon: '2X',
      duration: 15000, hue: 0
    },
    rapid: {
      id: 'rapid', name: 'RAPID FIRE', color: '#ffb347', icon: 'RF',
      duration: 12000, hue: 40
    },
    speed: {
      id: 'speed', name: 'SPEED BOOST', color: '#4ff0ff', icon: 'SP',
      duration: 15000, hue: 180
    },
    shield: {
      id: 'shield', name: 'SHIELD', color: '#4fff8a', icon: 'SH',
      duration: 12000, hue: 130
    }
  };

  // Build sprite textures for each powerup type (128x128 pixel-art crystals).
  function makePowerupSprite(name, def) {
    const S = 128;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    // Floor shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(S/2, S - 20, 30, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Crystal (diamond)
    const cx = S/2, cy = S/2 - 4;
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 40);
    ctx.lineTo(cx + 26, cy);
    ctx.lineTo(cx, cy + 40);
    ctx.lineTo(cx - 26, cy);
    ctx.closePath();
    ctx.fill();
    // Facets
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 40);
    ctx.lineTo(cx - 26, cy);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.moveTo(cx + 26, cy);
    ctx.lineTo(cx, cy + 40);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();
    // Icon label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(def.icon, cx, cy + 6);
    // Border
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 40);
    ctx.lineTo(cx + 26, cy);
    ctx.lineTo(cx, cy + 40);
    ctx.lineTo(cx - 26, cy);
    ctx.closePath();
    ctx.stroke();

    // Turn white-ish (unused corners) transparent by scanning alpha.
    const data = ctx.getImageData(0, 0, S, S);
    const raw = data.data;
    // We drew on transparent canvas, so alpha is already 0 outside shapes.
    const arr = new Uint32Array(raw.buffer);
    // Publish into TEX cache.
    TEX.all['powerup_' + name] = { w: S, h: S, data: arr };
  }
  for (const k in DEFS) makePowerupSprite(k, DEFS[k]);

  // Roll a powerup drop from an enemy of given tier ('normal' | 'elite').
  function rollDropId(tier) {
    // Elites drop more often + include Shield.
    const isElite = tier === 'elite';
    const chance = isElite ? 0.55 : 0.14;
    if (Math.random() > chance) return null;
    const pool = isElite
      ? ['double', 'rapid', 'speed', 'shield']
      : ['double', 'rapid', 'speed'];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function createDrop(id, x, y) {
    return {
      x, y,
      isPowerup: true,
      id,
      alive: true,
      scale: 0.75,
      tex: TEX.get('powerup_' + id),
      spawnedAt: performance.now(),
      bob: Math.random() * Math.PI * 2
    };
  }

  // ---- Active buff manager ----
  class Buffs {
    constructor() { this.active = {}; }
    apply(id, now = performance.now()) {
      const def = DEFS[id];
      if (!def) return;
      this.active[id] = { def, endsAt: now + def.duration };
    }
    update(now = performance.now()) {
      for (const id in this.active) {
        if (now >= this.active[id].endsAt) delete this.active[id];
      }
    }
    has(id) { return !!this.active[id]; }
    remaining(id) {
      if (!this.active[id]) return 0;
      return Math.max(0, this.active[id].endsAt - performance.now());
    }
    list() {
      const out = [];
      for (const id in this.active) out.push({ id, def: this.active[id].def, remaining: this.remaining(id) });
      return out;
    }
  }

  window.PowerUps = { DEFS, rollDropId, createDrop };
  window.Buffs = Buffs;
})();
