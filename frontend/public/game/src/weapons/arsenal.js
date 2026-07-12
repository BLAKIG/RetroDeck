/* Arsenal — three-weapon loadout system that reuses Pistol's fire/hitscan
   pattern. Each weapon is a small class exposing:
     name, ammo?, magSize?, damage, fireRate, recoil (per-shot amt), spread,
     canFire(player), fire(game), update(dt, moving, sprint), draw(ctx, w, h)
   Knife is melee (no ammo, short range, high damage).
*/
(function () {
  // Shared hitscan helper used by all firearms. Considers enemies AND
  // destructible barrels — whichever is closer along the ray wins.
  function hitscan(game, spreadRad, damage, maxDist = 22) {
    const player = game.player;
    const jitter = (Math.random() - 0.5) * spreadRad * 2;
    const a = player.angle + jitter;
    const dirX = Math.cos(a), dirY = Math.sin(a);
    let closest = null, closestDist = Infinity;
    const candidates = [];
    for (const e of game.enemies) if (e.alive) candidates.push(e);
    if (game.barrels) for (const b of game.barrels) if (b.alive) candidates.push(b);
    for (const t of candidates) {
      const dx = t.x - player.x, dy = t.y - player.y;
      const along = dx * dirX + dy * dirY;
      if (along <= 0 || along > maxDist) continue;
      const perp = Math.abs(dx * -dirY + dy * dirX);
      if (perp < 0.4) {
        if (Enemy.hasLineOfSight(game.map, player.x, player.y, t.x, t.y)) {
          if (along < closestDist) { closestDist = along; closest = t; }
        }
      }
    }
    return closest;
  }

  function applyHit(game, target, dmg) {
    const cw = game.canvas.width, ch = game.canvas.height;
    if (target) {
      // Buffs: double damage.
      const boosted = (game.buffs && game.buffs.has('double')) ? dmg * 2 : dmg;
      target.hit(boosted);
      game.renderer.addBlood(cw/2, ch/2, target.isBarrel ? 2 : 8);
      game.renderer.addSpark(cw/2, ch/2, target.isBarrel ? 6 : 3);
      if (game._onHitConfirmed) game._onHitConfirmed(target);
      // Only count enemy kills for streak/loot — barrels handle themselves.
      if (!target.isBarrel && !target.alive) {
        game.player.score += target.score;
        Sound.play('enemyDeath');
        if (game._onEnemyKilled) game._onEnemyKilled(target);
      }
    } else {
      game.renderer.addSpark(cw/2 + (Math.random()-0.5)*40, ch/2 + (Math.random()-0.5)*20, 3);
    }
  }

  // ---------- Firearm base ----------
  class Firearm {
    constructor(cfg) {
      Object.assign(this, cfg);
      this.cooldown = 0;
      this.recoil = 0;
      this.flashTime = 0;
      this.bobPhase = 0;
      this.reloadTimer = 0;
      this.magAmmo = this.magSize; // rounds in mag
      this.reserveAmmo = this.startReserve || 90;
      this._switchTime = 0;
    }
    onEquip() { this._switchTime = 200; }
    canFire() { return this.cooldown <= 0 && this.reloadTimer <= 0 && this.magAmmo > 0 && this._switchTime <= 0; }
    reload() {
      if (this.reloadTimer > 0 || this.magAmmo >= this.magSize || this.reserveAmmo <= 0) return false;
      this.reloadTimer = this.reloadMs;
      Sound.play('reload');
      return true;
    }
    fire(game) {
      if (!this.canFire()) {
        if (this.magAmmo === 0 && this.reserveAmmo > 0) this.reload();
        return false;
      }
      // Rapid Fire buff halves the effective fire rate.
      const rapid = (game.buffs && game.buffs.has('rapid'));
      this.cooldown = rapid ? this.fireRate * 0.45 : this.fireRate;
      this.recoil = 1;
      this.flashTime = this.flashDurMs;
      // Infinite ammo buff: don't consume.
      if (!(game.buffs && game.buffs.has('infammo'))) this.magAmmo -= 1;
      const pellets = this.pellets || 1;
      const spread = this.spread * (game.player.hitFlashTime > 0 ? 1.4 : 1);
      for (let i = 0; i < pellets; i++) {
        const t = hitscan(game, spread, this.damage);
        applyHit(game, t, this.damage);
      }
      game.renderer.triggerShake(this.shake || 4, this.shakeMs || 150);
      game.renderer.addShell && game.renderer.addShell();
      Sound.play(this.soundKey);
      // Notify AI: gunshot at player's cell.
      if (game.notifyGunshot) game.notifyGunshot(game.player.x, game.player.y);
      return true;
    }
    update(dt, moving, sprint) {
      if (this.cooldown > 0) this.cooldown -= dt;
      if (this.flashTime > 0) this.flashTime -= dt;
      if (this._switchTime > 0) this._switchTime -= dt;
      if (this.reloadTimer > 0) {
        this.reloadTimer -= dt;
        if (this.reloadTimer <= 0) {
          const need = this.magSize - this.magAmmo;
          const got = Math.min(need, this.reserveAmmo);
          this.magAmmo += got;
          this.reserveAmmo -= got;
        }
      }
      this.recoil = Math.max(0, this.recoil - dt * 0.005);
      if (moving) this.bobPhase += dt * (sprint ? 0.014 : 0.009);
      else this.bobPhase *= 0.9;
    }
  }

  // ---------- Knife (melee) ----------
  class Knife {
    constructor() {
      this.name = 'KARAMBIT';
      this.slot = 3;
      this.isMelee = true;
      this.damage = 65;
      this.fireRate = 320;
      this.cooldown = 0;
      this.recoil = 0;
      this.flashTime = 0;
      this.bobPhase = 0;
      this.reloadTimer = 0;
      this.magAmmo = Infinity;
      this.reserveAmmo = Infinity;
      this.magSize = Infinity;
      this._switchTime = 0;
      this._swingTime = 0;
    }
    onEquip() { this._switchTime = 180; }
    canFire() { return this.cooldown <= 0 && this._switchTime <= 0; }
    reload() { return false; }
    fire(game) {
      if (!this.canFire()) return false;
      this.cooldown = this.fireRate;
      this._swingTime = this.fireRate;
      // Melee — find any enemy within 1.5 cells directly ahead.
      const player = game.player;
      const dirX = Math.cos(player.angle), dirY = Math.sin(player.angle);
      let target = null, best = Infinity;
      for (const e of game.enemies) {
        if (!e.alive) continue;
        const dx = e.x - player.x, dy = e.y - player.y;
        const along = dx * dirX + dy * dirY;
        if (along <= 0 || along > 1.5) continue;
        const perp = Math.abs(dx * -dirY + dy * dirX);
        if (perp < 0.7 && along < best) { best = along; target = e; }
      }
      applyHit(game, target, this.damage);
      Sound.play('knife');
      game.renderer.triggerShake(3, 90);
      return true;
    }
    update(dt, moving, sprint) {
      if (this.cooldown > 0) this.cooldown -= dt;
      if (this._switchTime > 0) this._switchTime -= dt;
      if (this._swingTime > 0) this._swingTime -= dt;
      if (moving) this.bobPhase += dt * (sprint ? 0.016 : 0.011);
      else this.bobPhase *= 0.9;
    }
  }

  // ---------- Weapon factory ----------
  function makeM4() {
    return new Firearm({
      name: 'M4A1', slot: 1, subSlot: 0,
      damage: 24, fireRate: 95, spread: 0.03, magSize: 30,
      startReserve: 120, reloadMs: 1800,
      flashDurMs: 55, shake: 5, shakeMs: 130,
      soundKey: 'rifle'
    });
  }
  function makeAK() {
    return new Firearm({
      name: 'AK-47', slot: 1, subSlot: 1,
      damage: 32, fireRate: 130, spread: 0.055, magSize: 30,
      startReserve: 90, reloadMs: 2400,
      flashDurMs: 70, shake: 7, shakeMs: 160,
      soundKey: 'rifle2'
    });
  }
  function makeDeagle() {
    return new Firearm({
      name: 'DESERT EAGLE', slot: 2,
      damage: 60, fireRate: 400, spread: 0.008, magSize: 7,
      startReserve: 42, reloadMs: 1500,
      flashDurMs: 100, shake: 9, shakeMs: 190,
      soundKey: 'deagle'
    });
  }
  function makeKnife() { return new Knife(); }

  // ---------- Arsenal manager ----------
  class Arsenal {
    constructor() {
      this.slots = {
        1: [makeM4(), makeAK()],  // primary — cycle by pressing 1 again
        2: [makeDeagle()],
        3: [makeKnife()]
      };
      this.slotIdx = { 1: 0, 2: 0, 3: 0 };
      this.currentSlot = 1;
      this._prev = null;
    }
    current() {
      const arr = this.slots[this.currentSlot];
      return arr[this.slotIdx[this.currentSlot]];
    }
    switchTo(slot) {
      if (!this.slots[slot]) return;
      if (this.currentSlot === slot) {
        // Cycle within slot (e.g. M4 <-> AK).
        const arr = this.slots[slot];
        if (arr.length > 1) this.slotIdx[slot] = (this.slotIdx[slot] + 1) % arr.length;
      } else {
        this.currentSlot = slot;
      }
      const cur = this.current();
      if (cur.onEquip) cur.onEquip();
      Sound.play('weaponSwitch');
    }
    cycle(dir) {
      const order = [1, 2, 3];
      const i = order.indexOf(this.currentSlot);
      const ni = (i + (dir > 0 ? 1 : -1) + order.length) % order.length;
      this.switchTo(order[ni]);
    }
    addAmmo(kind, amount) {
      // "kind" matches the weapon soundKey category: rifle | deagle. Simpler:
      // just top up ammo across all firearm slots proportionally.
      for (const s of [1, 2]) {
        for (const w of this.slots[s]) w.reserveAmmo = Math.min(999, w.reserveAmmo + amount);
      }
    }
    reloadCurrent() { const w = this.current(); if (w && w.reload) w.reload(); }
  }

  window.Arsenal = Arsenal;
  window._makeM4 = makeM4;
})();
