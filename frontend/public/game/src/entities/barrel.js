/* Explosive barrels: static world objects with hp. When killed (shot or
   caught in another explosion), they explode with a splash radius that
   damages enemies AND the player. Chain reactions supported. */
(function () {
  const EXPLOSION_RADIUS = 2.4;   // cells
  const EXPLOSION_DAMAGE = 90;
  const CHAIN_DELAY_MS = 90;

  // Barrel sprite (rendered like an enemy sprite via raycaster.drawSprite).
  function makeBarrelSprite() {
    const S = 64;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(14, 56, 36, 4);
    // Barrel body
    ctx.fillStyle = '#8a3a1a'; ctx.fillRect(18, 12, 28, 44);
    ctx.fillStyle = '#a84f24'; ctx.fillRect(18, 12, 28, 6);
    ctx.fillStyle = '#5a2410'; ctx.fillRect(18, 50, 28, 6);
    // Metal bands
    ctx.fillStyle = '#2a1a08'; ctx.fillRect(18, 20, 28, 3); ctx.fillRect(18, 44, 28, 3);
    // Warning stripes
    ctx.fillStyle = '#ffd54a';
    for (let i = 0; i < 4; i++) ctx.fillRect(18 + i * 8, 28, 4, 12);
    ctx.fillStyle = '#000';
    for (let i = 0; i < 4; i++) ctx.fillRect(22 + i * 8, 28, 2, 12);
    // Hazard symbol
    ctx.fillStyle = '#000'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
    ctx.fillText('!', 32, 42);
    const data = ctx.getImageData(0, 0, S, S);
    TEX.all['barrel'] = { w: S, h: S, data: new Uint32Array(data.data.buffer) };
  }
  makeBarrelSprite();

  class Barrel {
    constructor(x, y) {
      this.x = x; this.y = y;
      this.hp = 20;
      this.alive = true;
      this.tex = TEX.get('barrel');
      this.scale = 0.7;
      this.isBarrel = true;
      // Timer for chain delay so shooting one lights adjacent barrels in a
      // slight cascade rather than one big frame.
      this._explodeAt = 0;
    }
    hit(dmg) {
      if (!this.alive) return;
      this.hp -= dmg;
      if (this.hp <= 0) {
        this.alive = false;
        this._explodeAt = performance.now();
      }
    }
    // Called by main.js when the barrel's fuse ticks — applies splash + shakes.
    detonate(game) {
      Sound.play('explode');
      game.renderer.triggerShake(18, 500);

      // Splash to enemies (excluding rick? include rick too — full damage)
      for (const e of game.enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (d < EXPLOSION_RADIUS) {
          const dmg = EXPLOSION_DAMAGE * (1 - d / EXPLOSION_RADIUS);
          e.hit(dmg);
        }
      }
      // Splash to player
      const dp = Math.hypot(game.player.x - this.x, game.player.y - this.y);
      if (dp < EXPLOSION_RADIUS) {
        const dmg = EXPLOSION_DAMAGE * (1 - dp / EXPLOSION_RADIUS) * 0.7;
        game.player.hit(dmg);
        // Damage indicator: direction from barrel toward player.
        if (game._onPlayerHitFrom) {
          game._onPlayerHitFrom(this.x, this.y);
        }
      }
      // Chain: nearby barrels light with a small delay.
      if (game.barrels) {
        for (const b of game.barrels) {
          if (!b.alive || b === this) continue;
          const d = Math.hypot(b.x - this.x, b.y - this.y);
          if (d < EXPLOSION_RADIUS + 0.5) {
            b.alive = false;
            b._explodeAt = performance.now() + CHAIN_DELAY_MS;
          }
        }
      }
      // Screen particles at explosion (centered-ish).
      const cw = game.canvas.width, ch = game.canvas.height;
      const dz = Math.hypot(this.x - game.player.x, this.y - game.player.y);
      const scale = Math.min(1, 4 / (dz + 0.1));
      for (let k = 0; k < 40; k++) {
        game.renderer.addSpark(cw/2 + (Math.random()-0.5)*300*scale, ch/2 + (Math.random()-0.5)*200*scale, 1);
      }
    }
  }

  Barrel.EXPLOSION_RADIUS = EXPLOSION_RADIUS;
  window.Barrel = Barrel;
})();
