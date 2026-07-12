/* Enemy AI: idle -> chase (LOS) -> attack -> hurt/death.
   Line-of-sight via DDA against wall map. Simple corridor pathing:
   move toward player, but if blocked, slide along wall. */
(function () {
  const STATE = { IDLE: 0, CHASE: 1, ATTACK: 2, HURT: 3, DEAD: 4 };

  function hasLineOfSight(map, x1, y1, x2, y2) {
    // DDA
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) return true;
    const rx = dx / dist, ry = dy / dist;

    let mapX = x1 | 0, mapY = y1 | 0;
    const deltaDistX = Math.abs(1 / rx);
    const deltaDistY = Math.abs(1 / ry);
    let stepX, stepY, sideDistX, sideDistY;
    if (rx < 0) { stepX = -1; sideDistX = (x1 - mapX) * deltaDistX; }
    else { stepX = 1; sideDistX = (mapX + 1 - x1) * deltaDistX; }
    if (ry < 0) { stepY = -1; sideDistY = (y1 - mapY) * deltaDistY; }
    else { stepY = 1; sideDistY = (mapY + 1 - y1) * deltaDistY; }

    let traveled = 0;
    let iter = 0;
    while (iter++ < 64) {
      if (sideDistX < sideDistY) {
        traveled = sideDistX; sideDistX += deltaDistX; mapX += stepX;
      } else {
        traveled = sideDistY; sideDistY += deltaDistY; mapY += stepY;
      }
      if (traveled >= dist) return true;
      if (mapY < 0 || mapY >= map.length || mapX < 0 || mapX >= map[0].length) return false;
      if (map[mapY][mapX] > 0) return false;
    }
    return true;
  }

  class Enemy {
    constructor(x, y, type = 'guard') {
      this.x = x; this.y = y;
      this.type = type;
      const cfg = Enemy.CONFIG[type];
      this.hp = cfg.hp;
      this.maxHp = cfg.hp;
      this.speed = cfg.speed;
      this.damage = cfg.damage;
      this.range = cfg.range;
      this.attackCooldown = 0;
      this.state = STATE.IDLE;
      this.tex = TEX.get(type === 'rick' ? 'rick_idle' : (type === 'shrek' ? 'shrek_idle' : (type === 'elite' ? 'soldier' : type)));
      this.scale = cfg.scale;
      this.alive = true;
      this.hurtTime = 0;
      this.deathTime = 0;
      this.score = cfg.score;
      this.sightRange = type === 'rick' ? 24 : 14;
      this.attackRate = cfg.attackRate;
      this.patrolTimer = 0;
      this.patrolDir = { x: 0, y: 0 };
      this._walkPhase = 0;
      // Voice cooldowns.
      this._voiceCool = 0;
      this._tauntCool = 2000 + Math.random() * 3000;
      this._sawPlayer = false;
    }

    hit(dmg) {
      this.hp -= dmg;
      this.hurtTime = 120;
      if (this.hp <= 0) {
        this.alive = false;
        this.state = STATE.DEAD;
        this.deathTime = this.type === 'rick' ? 4000 : 400;
        if (this.type === 'rick') this.tex = TEX.get('rick_death') || this.tex;
        Sound.play('enemyDeath');
      } else {
        if (this.state === STATE.IDLE) this.state = STATE.CHASE;
        // Hurt voice — throttled so a burst-fire doesn't spam it.
        if (this._voiceCool <= 0) {
          Sound.play('enemyHurt');
          this._voiceCool = 350;
        }
      }
    }

    canMove(map, nx, ny) {
      const r = 0.25;
      const cx1 = (nx - r) | 0, cx2 = (nx + r) | 0;
      const cy1 = (ny - r) | 0, cy2 = (ny + r) | 0;
      if (cx1 < 0 || cy1 < 0 || cy2 >= map.length || cx2 >= map[0].length) return false;
      return map[cy1][cx1] === 0 && map[cy1][cx2] === 0
          && map[cy2][cx1] === 0 && map[cy2][cx2] === 0;
    }

    update(dt, player, map) {
      if (!this.alive) {
        this.deathTime -= dt;
        return;
      }
      const sec = dt / 1000;
      const dx = player.x - this.x, dy = player.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (this.hurtTime > 0) this.hurtTime -= dt;
      if (this.attackCooldown > 0) this.attackCooldown -= dt;
      if (this._voiceCool > 0) this._voiceCool -= dt;
      if (this._tauntCool > 0) this._tauntCool -= dt;

      const canSee = dist < this.sightRange && hasLineOfSight(map, this.x, this.y, player.x, player.y);

      // Sound-driven search state: even without LOS, walk toward LKP.
      if (this._searchTime > 0) this._searchTime -= dt;
      if (!canSee && this._lkp && this._searchTime > 0 && this.state !== STATE.ATTACK) {
        // Move toward LKP; if reached, look around briefly then drop LKP.
        const ldx = this._lkp.x - this.x, ldy = this._lkp.y - this.y;
        const ldist = Math.hypot(ldx, ldy);
        if (ldist < 0.6) { this._lkp = null; this._searchTime = Math.min(this._searchTime, 500); }
        else {
          const step = this.speed * sec;
          const nx = (ldx / ldist) * step, ny = (ldy / ldist) * step;
          if (this.canMove(map, this.x + nx, this.y)) this.x += nx;
          if (this.canMove(map, this.x, this.y + ny)) this.y += ny;
        }
      }
      if (this._searchTime <= 0 && !canSee) { this._lkp = null; }

      // Play "spotted" bark the first time this enemy sees the player.
      if (canSee && !this._sawPlayer) {
        this._sawPlayer = true;
        Sound.play('enemySpotted');
        this._voiceCool = 900;
      }
      // Combat taunts — occasional grunts while chasing.
      if (canSee && this._tauntCool <= 0 && this._voiceCool <= 0) {
        Sound.play('enemyTaunt');
        this._voiceCool = 700;
        this._tauntCool = 3000 + Math.random() * 4000;
      }

      if (canSee) this.state = dist <= this.range ? STATE.ATTACK : STATE.CHASE;
      else if (this.state !== STATE.IDLE && !canSee) {
        // lose sight after brief chase
        this.state = STATE.IDLE;
      }

      // Rick sprite frame swap: idle when standing, walk when moving.
      if (this.type === 'rick' || this.type === 'shrek') {
        const prefix = this.type;
        const moving = this.state === STATE.CHASE || this.state === STATE.ATTACK;
        if (moving) {
          this._walkPhase += dt;
          const swap = ((this._walkPhase / 240) | 0) % 2 === 0;
          this.tex = TEX.get(swap ? prefix + '_walk' : prefix + '_idle') || this.tex;
        } else {
          this._walkPhase = 0;
          this.tex = TEX.get(prefix + '_idle') || this.tex;
        }
      }

      if (this.state === STATE.CHASE || this.state === STATE.ATTACK) {
        // Move toward player
        const nx = dx / (dist || 1) * this.speed * sec;
        const ny = dy / (dist || 1) * this.speed * sec;

        if (dist > 0.9) {
          if (this.canMove(map, this.x + nx, this.y)) this.x += nx;
          else if (this.canMove(map, this.x + Math.sign(nx) * 0.05, this.y)) this.x += Math.sign(nx) * 0.05;
          if (this.canMove(map, this.x, this.y + ny)) this.y += ny;
          else if (this.canMove(map, this.x, this.y + Math.sign(ny) * 0.05)) this.y += Math.sign(ny) * 0.05;
        }

        if (this.state === STATE.ATTACK && this.attackCooldown <= 0) {
          if (dist <= this.range && canSee) {
            player.hit(this.damage);
            this.attackCooldown = this.attackRate;
            // Attack yell — barked less often than the taunt.
            if (this._voiceCool <= 0) { Sound.play('enemyAttack'); this._voiceCool = 500; }
            return { attacked: true };
          }
        }
      } else if (this.state === STATE.IDLE) {
        // Simple patrol wandering
        this.patrolTimer -= dt;
        if (this.patrolTimer <= 0) {
          this.patrolTimer = 1200 + Math.random() * 1500;
          const a = Math.random() * Math.PI * 2;
          this.patrolDir = { x: Math.cos(a), y: Math.sin(a) };
        }
        const px = this.patrolDir.x * (this.speed * 0.35) * sec;
        const py = this.patrolDir.y * (this.speed * 0.35) * sec;
        if (this.canMove(map, this.x + px, this.y)) this.x += px; else this.patrolTimer = 0;
        if (this.canMove(map, this.x, this.y + py)) this.y += py; else this.patrolTimer = 0;
      }
      return null;
    }
  }

  Enemy.STATE = STATE;
  Enemy.hasLineOfSight = hasLineOfSight;
  Enemy.CONFIG = {
    guard:   { hp: 25, speed: 1.4, damage: 8,  range: 0.9, attackRate: 900,  score: 100, scale: 0.85 },
    soldier: { hp: 45, speed: 1.9, damage: 12, range: 0.95, attackRate: 750, score: 200, scale: 1.0 },
    // Elite Soldier — tougher, faster attacks, guaranteed loot.
    elite:   { hp: 90, speed: 2.1, damage: 18, range: 1.0, attackRate: 550, score: 500, scale: 1.1 },
    rick:    { hp: 120, speed: 1.2, damage: 14, range: 1.0, attackRate: 850, score: 5000, scale: 1.35 },
    shrek:   { hp: 500, speed: 1.5, damage: 22, range: 1.2, attackRate: 750, score: 25000, scale: 1.7 }
  };

  window.Enemy = Enemy;
})();
