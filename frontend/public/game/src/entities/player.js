/* Player: position, angle, movement, collision, health & ammo. */
(function () {
  class Player {
    constructor(x, y, angle) {
      this.x = x;
      this.y = y;
      this.angle = angle || 0;
      this.moveSpeed = 3.0;  // cells/sec
      this.turnSpeed = 2.2;
      this.radius = 0.25;
      this.health = 100;
      this.maxHealth = 100;
      this.ammo = 50;
      this.score = 0;
      this.dead = false;
      this.bobPhase = 0;
      this.bobActive = false;
      this.hitFlashTime = 0;
    }

    canWalk(map, nx, ny) {
      const r = this.radius;
      const cells = [
        [nx - r, ny - r], [nx + r, ny - r],
        [nx - r, ny + r], [nx + r, ny + r],
        [nx, ny]
      ];
      for (const [cx, cy] of cells) {
        const mx = cx | 0, my = cy | 0;
        if (mx < 0 || my < 0 || my >= map.length || mx >= map[0].length) return false;
        if (map[my][mx] > 0) return false;
      }
      return true;
    }

    update(dt, input, map) {
      if (this.dead) return;
      const sec = dt / 1000;
      const sprint = input.sprint ? 1.7 : 1;
      const speed = this.moveSpeed * sec * sprint;
      const turn = this.turnSpeed * sec;

      let mvx = 0, mvy = 0;
      const fwdX = Math.cos(this.angle), fwdY = Math.sin(this.angle);
      const strX = -Math.sin(this.angle), strY = Math.cos(this.angle);

      if (input.forward) { mvx += fwdX; mvy += fwdY; }
      if (input.back)    { mvx -= fwdX; mvy -= fwdY; }
      if (input.left)    { mvx -= strX; mvy -= strY; }
      if (input.right)   { mvx += strX; mvy += strY; }

      const len = Math.hypot(mvx, mvy);
      if (len > 0) {
        mvx = (mvx / len) * speed;
        mvy = (mvy / len) * speed;
        this.bobActive = true;
      } else {
        this.bobActive = false;
      }

      // Axis-separated collision
      if (mvx !== 0 && this.canWalk(map, this.x + mvx, this.y)) this.x += mvx;
      if (mvy !== 0 && this.canWalk(map, this.x, this.y + mvy)) this.y += mvy;

      // Turning via arrow keys
      if (input.turnLeft) this.angle -= turn;
      if (input.turnRight) this.angle += turn;

      // Mouse look delta (applied by main.js via addYaw)
      if (input.mouseDX) {
        this.angle += input.mouseDX * 0.0025;
        input.mouseDX = 0;
      }

      // View bob
      if (this.bobActive) this.bobPhase += sec * 10 * sprint;
      else this.bobPhase *= 0.9;

      if (this.hitFlashTime > 0) this.hitFlashTime -= dt;
    }

    hit(dmg) {
      if (this.dead) return;
      // Shield buff: absorb 65% of incoming damage before touching armor.
      if (window.__doomfall && __doomfall.game && __doomfall.game.buffs && __doomfall.game.buffs.has('shield')) {
        dmg *= 0.35;
      }
      // Armor absorbs 65% of damage until it's depleted.
      if (this.armor > 0) {
        const absorbed = Math.min(this.armor, dmg * 0.65);
        this.armor -= absorbed;
        dmg -= absorbed;
      }
      this.health -= dmg;
      this.hitFlashTime = 200;
      if (this.health <= 0) { this.health = 0; this.dead = true; }
    }

    heal(amount) {
      this.health = Math.min(this.maxHealth, this.health + amount);
    }
  }

  window.Player = Player;
})();
