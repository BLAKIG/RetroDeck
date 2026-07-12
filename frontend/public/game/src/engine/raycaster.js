/* DDA Raycasting engine.
   Renders textured walls, floor, and ceiling with distance shading.
   Uses a pixel buffer (ImageData) for max performance. */
(function () {
  const TSIZE = 64;

  class Raycaster {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.ctx.imageSmoothingEnabled = false;

      // Render at reduced resolution for perf, then scale up.
      this.renderScale = options.renderScale || 0.5; // 50% res
      this.rw = Math.max(64, Math.floor(canvas.width * this.renderScale));
      this.rh = Math.max(64, Math.floor(canvas.height * this.renderScale));

      // Offscreen buffer canvas
      this.buf = document.createElement('canvas');
      this.buf.width = this.rw;
      this.buf.height = this.rh;
      this.bctx = this.buf.getContext('2d');
      this.bctx.imageSmoothingEnabled = false;

      this.img = this.bctx.createImageData(this.rw, this.rh);
      this.pixels = new Uint32Array(this.img.data.buffer);
      this.zBuffer = new Float32Array(this.rw);

      this.fov = Math.PI / 3; // 60 degrees

      // Texture refs
      this.wallTex = [null, TEX.get('brick'), TEX.get('stone'), TEX.get('metal'), TEX.get('door')];
      // Cell value 9 = secret door (reuses the door texture for a distinct look).
      this.wallTex[9] = TEX.get('door');
      // Map of "x,y" -> slide progress (0..1). Populated by main.js when the
      // secret door is opening. 0 = closed, 1 = fully sunk.
      this.slidingDoors = new Map();
      this.floorTex = TEX.get('floor');
      this.ceilTex = TEX.get('ceiling');
    }

    render(map, player) {
      const { pixels, zBuffer, rw, rh, fov } = this;
      const mapW = map[0].length, mapH = map.length;

      const dirX = Math.cos(player.angle);
      const dirY = Math.sin(player.angle);
      const planeX = -Math.sin(player.angle) * Math.tan(fov / 2);
      const planeY = Math.cos(player.angle) * Math.tan(fov / 2);

      // Clear pixel buffer (fill with sky color as fallback)
      pixels.fill(0xFF000000);

      // ---- Floor & Ceiling casting (per row) ----
      const posZ = 0.5 * rh; // vertical position of camera
      const floorTex = this.floorTex.data;
      const ceilTex = this.ceilTex.data;

      for (let y = (rh >> 1) + 1; y < rh; y++) {
        // Ray direction for leftmost & rightmost ray
        const rayDirX0 = dirX - planeX;
        const rayDirY0 = dirY - planeY;
        const rayDirX1 = dirX + planeX;
        const rayDirY1 = dirY + planeY;

        const p = y - (rh >> 1);
        const rowDistance = posZ / p;

        // shading factor by distance
        const shade = Math.max(0.15, Math.min(1, 1.4 - rowDistance * 0.08));

        const floorStepX = (rowDistance * (rayDirX1 - rayDirX0)) / rw;
        const floorStepY = (rowDistance * (rayDirY1 - rayDirY0)) / rw;

        let floorX = player.x + rowDistance * rayDirX0;
        let floorY = player.y + rowDistance * rayDirY0;

        const rowFloor = y * rw;
        const rowCeil = (rh - y - 1) * rw;

        for (let x = 0; x < rw; x++) {
          const cellX = floorX | 0;
          const cellY = floorY | 0;

          const tx = ((TSIZE * (floorX - cellX)) & (TSIZE - 1));
          const ty = ((TSIZE * (floorY - cellY)) & (TSIZE - 1));

          floorX += floorStepX;
          floorY += floorStepY;

          const fIdx = ty * TSIZE + tx;
          pixels[rowFloor + x] = shadeColor(floorTex[fIdx], shade);
          pixels[rowCeil + x] = shadeColor(ceilTex[fIdx], shade * 0.85);
        }
      }

      // ---- Wall casting (per column) ----
      for (let x = 0; x < rw; x++) {
        const cameraX = 2 * x / rw - 1;
        const rayDirX = dirX + planeX * cameraX;
        const rayDirY = dirY + planeY * cameraX;

        let mapX = player.x | 0;
        let mapY = player.y | 0;

        const deltaDistX = Math.abs(1 / rayDirX);
        const deltaDistY = Math.abs(1 / rayDirY);

        let stepX, stepY, sideDistX, sideDistY;

        if (rayDirX < 0) {
          stepX = -1;
          sideDistX = (player.x - mapX) * deltaDistX;
        } else {
          stepX = 1;
          sideDistX = (mapX + 1.0 - player.x) * deltaDistX;
        }
        if (rayDirY < 0) {
          stepY = -1;
          sideDistY = (player.y - mapY) * deltaDistY;
        } else {
          stepY = 1;
          sideDistY = (mapY + 1.0 - player.y) * deltaDistY;
        }

        let hit = 0, side = 0, hitType = 0;
        let iter = 0;
        while (!hit && iter++ < 64) {
          if (sideDistX < sideDistY) {
            sideDistX += deltaDistX;
            mapX += stepX;
            side = 0;
          } else {
            sideDistY += deltaDistY;
            mapY += stepY;
            side = 1;
          }
          if (mapX < 0 || mapY < 0 || mapX >= mapW || mapY >= mapH) { hit = 1; hitType = 1; break; }
          const cell = map[mapY][mapX];
          if (cell > 0) { hit = 1; hitType = cell; }
        }

        let perpDist;
        if (side === 0) perpDist = (mapX - player.x + (1 - stepX) / 2) / rayDirX;
        else perpDist = (mapY - player.y + (1 - stepY) / 2) / rayDirY;
        if (perpDist < 0.0001) perpDist = 0.0001;
        zBuffer[x] = perpDist;

        const lineHeight = (rh / perpDist) | 0;
        let drawStart = -(lineHeight >> 1) + (rh >> 1);
        let drawEnd = (lineHeight >> 1) + (rh >> 1);

        // Secret-door slide animation: push the top of the wall downward as
        // the slide progresses so the wall appears to sink into the floor.
        if (hitType === 9 && this.slidingDoors.size > 0) {
          const key = mapX + ',' + mapY;
          const prog = this.slidingDoors.get(key) || 0;
          if (prog > 0) drawStart += (lineHeight * prog) | 0;
        }
        if (drawStart >= drawEnd) continue;
        if (drawStart < 0) drawStart = 0;
        if (drawEnd >= rh) drawEnd = rh - 1;

        const tex = this.wallTex[hitType] || this.wallTex[1];
        let wallX;
        if (side === 0) wallX = player.y + perpDist * rayDirY;
        else wallX = player.x + perpDist * rayDirX;
        wallX -= wallX | 0;

        let texX = (wallX * TSIZE) | 0;
        if (side === 0 && rayDirX > 0) texX = TSIZE - texX - 1;
        if (side === 1 && rayDirY < 0) texX = TSIZE - texX - 1;

        const step = TSIZE / lineHeight;
        let texPos = (drawStart - (rh >> 1) + (lineHeight >> 1)) * step;

        // distance-based shading + side shading
        const shade = Math.max(0.12, Math.min(1, 1.4 - perpDist * 0.09));
        const sideShade = side === 1 ? 0.72 : 1;
        const finalShade = shade * sideShade;

        const texData = tex.data;
        for (let y = drawStart; y <= drawEnd; y++) {
          const texY = (texPos | 0) & (TSIZE - 1);
          texPos += step;
          pixels[y * rw + x] = shadeColor(texData[texY * TSIZE + texX], finalShade);
        }
      }
    }

    /** Draw a sprite (billboard) in world space, respecting the zBuffer. */
    drawSprite(sprite, player) {
      const tex = sprite.tex;
      if (!tex || !tex.data) return; // guard against not-yet-loaded textures
      const { pixels, zBuffer, rw, rh, fov } = this;
      const dx = sprite.x - player.x;
      const dy = sprite.y - player.y;

      const dirX = Math.cos(player.angle);
      const dirY = Math.sin(player.angle);
      const planeX = -Math.sin(player.angle) * Math.tan(fov / 2);
      const planeY = Math.cos(player.angle) * Math.tan(fov / 2);

      const invDet = 1.0 / (planeX * dirY - dirX * planeY);
      const transformX = invDet * (dirY * dx - dirX * dy);
      const transformY = invDet * (-planeY * dx + planeX * dy); // "depth"

      if (transformY <= 0.1) return; // behind camera

      const spriteScreenX = ((rw / 2) * (1 + transformX / transformY)) | 0;
      const spriteHeight = Math.abs(((rh / transformY) * (sprite.scale || 1)) | 0);
      const spriteWidth = spriteHeight;

      // Vertical offset for feet on floor (bob)
      const vMoveScreen = 0;
      const drawStartY = Math.max(0, (-spriteHeight / 2 + rh / 2 + vMoveScreen) | 0);
      const drawEndY = Math.min(rh - 1, (spriteHeight / 2 + rh / 2 + vMoveScreen) | 0);

      const drawStartX = Math.max(0, (-spriteWidth / 2 + spriteScreenX) | 0);
      const drawEndX = Math.min(rw - 1, (spriteWidth / 2 + spriteScreenX) | 0);

      const shade = Math.max(0.2, Math.min(1, 1.4 - transformY * 0.08));
      const texData = tex.data;
      const tw = tex.w, th = tex.h;

      for (let stripe = drawStartX; stripe <= drawEndX; stripe++) {
        const texX = (((stripe - (-spriteWidth / 2 + spriteScreenX)) * tw) / spriteWidth) | 0;
        if (transformY < zBuffer[stripe] && texX >= 0 && texX < tw) {
          for (let y = drawStartY; y <= drawEndY; y++) {
            const d = (y - vMoveScreen) * 256 - rh * 128 + spriteHeight * 128;
            const texY = (((d * th) / spriteHeight) / 256) | 0;
            if (texY < 0 || texY >= th) continue;
            const color = texData[texY * tw + texX];
            const alpha = (color >>> 24) & 0xff;
            if (alpha > 128) {
              pixels[y * rw + stripe] = shadeColor(color, shade);
            }
          }
        }
      }
    }

    present() {
      this.bctx.putImageData(this.img, 0, 0);
      this.ctx.drawImage(this.buf, 0, 0, this.canvas.width, this.canvas.height);
    }
  }

  function shadeColor(c, s) {
    if ((c & 0xff000000) === 0) return c;
    const r = ((c & 0xff) * s) | 0;
    const g = (((c >> 8) & 0xff) * s) | 0;
    const b = (((c >> 16) & 0xff) * s) | 0;
    return (0xff << 24) | (b << 16) | (g << 8) | r;
  }

  window.Raycaster = Raycaster;
})();
