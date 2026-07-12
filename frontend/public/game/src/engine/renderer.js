/* Overlays drawn on the main 2D canvas AFTER the raycaster presents:
   - Muzzle flash
   - Weapon sprite (bob)
   - Bullet impact sparks
   - Blood particles */
(function () {
  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.particles = [];
      this.shakeIntensity = 0;
      this.shakeTime = 0;
    }

    triggerShake(intensity = 6, duration = 200) {
      this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
      this.shakeTime = Math.max(this.shakeTime, duration);
    }

    addBlood(x, y, count = 8) {
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6 - 3,
          life: 500 + Math.random() * 300,
          maxLife: 800,
          color: `rgba(200,${20 + Math.random() * 20 | 0},${20 + Math.random() * 20 | 0},1)`,
          size: 2 + Math.random() * 3,
          gravity: 0.15
        });
      }
    }

    addSpark(x, y, count = 5) {
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8,
          life: 200 + Math.random() * 200,
          maxLife: 400,
          color: `rgba(255,${180 + Math.random() * 60 | 0},60,1)`,
          size: 1.5 + Math.random() * 1.5,
          gravity: 0.05
        });
      }
    }

    updateParticles(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.life -= dt;
        if (p.life <= 0) this.particles.splice(i, 1);
      }
    }

    drawParticles() {
      const ctx = this.ctx;
      ctx.save();
      for (const p of this.particles) {
        const a = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }

    applyShake(dt) {
      if (this.shakeTime <= 0) { this.shakeIntensity = 0; return { x: 0, y: 0 }; }
      this.shakeTime -= dt;
      const decay = Math.max(0, this.shakeTime / 200);
      const amp = this.shakeIntensity * decay;
      return {
        x: (Math.random() - 0.5) * amp,
        y: (Math.random() - 0.5) * amp
      };
    }

    drawWeapon(pistol, canvasW, canvasH) {
      const g = this.ctx;
      const pcv = TEX.pistolCanvas;
      const scale = canvasH / 340;
      const w = pcv.width * scale;
      const h = pcv.height * scale;

      const bobX = Math.sin(pistol.bobPhase) * 8 * scale;
      const bobY = Math.abs(Math.cos(pistol.bobPhase)) * 6 * scale;
      const recoilY = pistol.recoil * 40 * scale;

      const x = (canvasW - w) / 2 + bobX;
      const y = canvasH - h + 8 + bobY + recoilY;
      g.imageSmoothingEnabled = false;
      g.drawImage(pcv, x, y, w, h);

      // Muzzle flash
      if (pistol.flashTime > 0) {
        const fx = x + w / 2;
        const fy = y + 20 * scale;
        const flashSize = 60 * scale * (pistol.flashTime / 80);
        const grd = g.createRadialGradient(fx, fy, 4, fx, fy, flashSize);
        grd.addColorStop(0, 'rgba(255,240,180,1)');
        grd.addColorStop(0.4, 'rgba(255,140,40,0.8)');
        grd.addColorStop(1, 'rgba(255,60,20,0)');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(fx, fy, flashSize, 0, Math.PI * 2);
        g.fill();

        // burst spikes
        g.fillStyle = 'rgba(255,220,120,0.9)';
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI * 2 * k) / 6;
          const r = flashSize * 0.8;
          const px = fx + Math.cos(a) * r;
          const py = fy + Math.sin(a) * r;
          g.beginPath();
          g.moveTo(fx, fy);
          g.lineTo(px, py);
          g.lineWidth = 3;
          g.strokeStyle = 'rgba(255,220,120,0.7)';
          g.stroke();
        }
      }
    }
  }

  window.GameRenderer = Renderer;
})();
