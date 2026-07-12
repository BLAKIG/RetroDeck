/* HUD: DOM-based text values + a canvas face portrait that changes with health. */
(function () {
  const el = (id) => document.getElementById(id);

  class HUD {
    constructor() {
      this.$level  = el('hud-level');
      this.$score  = el('hud-score');
      this.$health = el('hud-health');
      this.$armor  = el('hud-armor');
      this.$ammo   = el('hud-ammo');
      this.$weapon = el('hud-weapon');
      this.$streak = el('hud-streak');
      this.$fps    = el('hud-fps');
      this.face    = el('hud-face').getContext('2d');
      this.face.imageSmoothingEnabled = false;
      this.faceTick = 0;
      this.$slots = document.querySelectorAll('.wslot');
    }

    update(player, weapon, level, fps, dt, extras) {
      this.$level.textContent  = level;
      this.$score.textContent  = String(player.score).padStart(5, '0');
      this.$health.textContent = Math.max(0, player.health | 0);
      if (this.$armor) this.$armor.textContent = Math.max(0, (player.armor || 0) | 0);
      if (weapon) {
        this.$weapon.textContent = weapon.name;
        // Ammo display: mag/reserve for firearms, "∞" for the knife.
        if (weapon.isMelee) this.$ammo.textContent = '∞';
        else this.$ammo.textContent = `${weapon.magAmmo} / ${weapon.reserveAmmo}`;
      }
      this.$fps.textContent = fps;
      if (this.$streak && extras && extras.streak) {
        this.$streak.textContent = extras.streak;
      }
      // Weapon slot highlight
      if (this.$slots && extras && typeof extras.slot === 'number') {
        this.$slots.forEach((s) => {
          const n = parseInt(s.dataset.slot, 10);
          s.classList.toggle('active', n === extras.slot);
        });
      }

      this.faceTick += dt;
      if (this.faceTick > 250) {
        this.faceTick = 0;
        this.drawFace(player);
      }
    }

    drawFace(player) {
      const g = this.face;
      const W = 72, H = 72;
      g.clearRect(0, 0, W, H);

      const hp = player.health;
      const hurt = player.hitFlashTime > 0;

      // Background
      g.fillStyle = '#1a0805'; g.fillRect(0, 0, W, H);

      // Head
      const skin = hp > 60 ? '#e5b17a' : hp > 30 ? '#c88860' : '#9e6640';
      g.fillStyle = skin;
      g.fillRect(16, 14, 40, 44);

      // Hair / helmet
      g.fillStyle = '#5a2a10';
      g.fillRect(14, 10, 44, 12);
      g.fillStyle = '#6a3218';
      g.fillRect(14, 10, 44, 4);

      // Eyes
      const look = (Math.random() * 3 - 1) | 0;
      g.fillStyle = '#000';
      g.fillRect(24 + look, 30, 6, 6);
      g.fillRect(42 + look, 30, 6, 6);

      // Mouth - grimace based on hp
      g.fillStyle = '#4a1a10';
      if (hp > 60) g.fillRect(28, 46, 16, 3);
      else if (hp > 30) { g.fillRect(26, 46, 20, 4); g.fillStyle = '#800'; g.fillRect(30, 47, 12, 2); }
      else { g.fillRect(24, 44, 24, 6); g.fillStyle = '#c00'; g.fillRect(28, 46, 16, 3); }

      // Blood on hit
      if (hurt || hp < 40) {
        g.fillStyle = 'rgba(200,20,20,0.85)';
        g.fillRect(20, 24 + Math.random() * 6, 4, 10);
        g.fillRect(50, 20 + Math.random() * 6, 3, 12);
      }

      // Border noise
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, 0, W, 2); g.fillRect(0, H - 2, W, 2);
      g.fillRect(0, 0, 2, H); g.fillRect(W - 2, 0, 2, H);
    }
  }

  window.HUD = HUD;
})();
