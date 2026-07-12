/* Pistol weapon: single shot, muzzle flash, recoil, procedural sound. */
(function () {
  class Pistol {
    constructor() {
      this.name = 'PISTOL';
      this.damage = 22;
      this.fireRate = 260; // ms between shots
      this.cooldown = 0;
      this.recoil = 0;         // current recoil offset (0-1)
      this.flashTime = 0;      // ms remaining on muzzle flash
      this.bobPhase = 0;
    }

    canFire(player) { return this.cooldown <= 0 && player.ammo > 0 && !player.dead; }

    fire(game) {
      const player = game.player;
      if (!this.canFire(player)) return false;
      this.cooldown = this.fireRate;
      this.recoil = 1;
      this.flashTime = 90;
      player.ammo -= 1;

      // Raycast forward against enemies (hitscan)
      const dirX = Math.cos(player.angle), dirY = Math.sin(player.angle);
      let closest = null, closestDist = Infinity;
      for (const e of game.enemies) {
        if (!e.alive) continue;
        const dx = e.x - player.x, dy = e.y - player.y;
        const along = dx * dirX + dy * dirY;
        if (along <= 0) continue;
        const perp = Math.abs(dx * -dirY + dy * dirX);
        // Rough hit test: within ~0.35 units of aim line
        if (perp < 0.4 && along < 20) {
          // Ensure LOS
          if (Enemy.hasLineOfSight(game.map, player.x, player.y, e.x, e.y)) {
            if (along < closestDist) { closestDist = along; closest = e; }
          }
        }
      }
      if (closest) {
        closest.hit(this.damage);
        // Compute screen-space impact point for particles
        const cw = game.canvas.width, ch = game.canvas.height;
        game.renderer.addBlood(cw / 2, ch / 2, 10);
        game.renderer.addSpark(cw / 2, ch / 2, 4);
        if (!closest.alive) {
          player.score += closest.score;
          Sound.play('enemyDeath');
        }
      } else {
        // spark somewhere on wall for feedback
        const cw = game.canvas.width, ch = game.canvas.height;
        game.renderer.addSpark(cw / 2 + (Math.random() - 0.5) * 40, ch / 2 + (Math.random() - 0.5) * 20, 3);
      }

      game.renderer.triggerShake(4, 150);
      Sound.play('pistol');
      return true;
    }

    update(dt, playerMoving, sprint) {
      if (this.cooldown > 0) this.cooldown -= dt;
      if (this.flashTime > 0) this.flashTime -= dt;
      // recoil decay
      this.recoil = Math.max(0, this.recoil - dt * 0.005);
      // bob
      if (playerMoving) this.bobPhase += dt * (sprint ? 0.014 : 0.009);
      else this.bobPhase *= 0.9;
    }
  }

  window.Pistol = Pistol;
})();
