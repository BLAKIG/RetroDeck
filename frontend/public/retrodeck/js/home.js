/* Home screen: cartridge shelf. */
window.RetroHome = (() => {
  const CARTS = [
    {
      id: 'doomfall',
      title: 'DOOMFALL',
      genre: 'FIRST-PERSON SHOOTER',
      tagline: 'Sector Zero: Signal Lost',
      stars: '★★★★★',
      plays: '1.2M plays',
      ribbon: 'NEW PATCH',
      cover: 'doomfall',
      lore: 'Recovered from a flooded data center in 2003. The corridors weren\'t empty. The guards weren\'t sleeping. The signal wasn\'t dead — it was watching.',
      meta: ['SP • 1 PLAYER', 'RATED M', 'DDA RAYCASTER'],
      controls: ['<b>WASD / Arrows</b> — move', '<b>Mouse</b> — look', '<b>Shift</b> — sprint', '<b>Click / Space</b> — shoot', '<b>Esc</b> — release cursor']
    },
    {
      id: 'overdrive',
      title: 'OVERDRIVE SQUAD',
      genre: 'RUN & GUN',
      tagline: 'Patch Notes',
      stars: '★★★★☆',
      plays: '847K plays',
      ribbon: '',
      cover: 'overdrive',
      lore: 'A crash-cart shooter. You\'re a freelance bug-fixer deployed into a crashing app — buffering wheels, pop-ups, and a Terms & Conditions final boss.',
      meta: ['SP • 1 PLAYER', 'RATED T', 'SIDE-SCROLLER'],
      controls: ['<b>A / D</b> or <b>Arrows</b> — move', '<b>W / Space</b> — jump', '<b>J</b> or <b>Click</b> — shoot', '<b>Fix</b> enemies to spawn temporary platforms', '<b>Esc</b> — eject']
    },
    {
      id: 'roadfury',
      title: 'ROAD FURY',
      genre: 'MOTO COMBAT',
      tagline: 'Gig Economy Delivery Rider',
      stars: '★★★★★',
      plays: '3.4M plays',
      ribbon: 'HOT',
      cover: 'roadfury',
      lore: 'The last unlicensed food-delivery bike race. Punch rival riders, dodge cops, hit the finish line before your app times you out. 90s asphalt fury, 2026 hustle.',
      meta: ['SP • 1 PLAYER', 'RATED M', 'PSEUDO-3D RACER'],
      controls: ['<b>W / ↑</b> — accelerate', '<b>S / ↓</b> — brake', '<b>A D / ← →</b> — lean', '<b>Space</b> — punch rival', '<b>Shift</b> — NITRO', '<b>Esc</b> — eject']
    }
  ];

  function drawCover(canvas, kind) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const W = canvas.width, H = canvas.height;
    if (kind === 'doomfall') {
      // Perspective corridor
      ctx.fillStyle = '#1a0a0a'; ctx.fillRect(0, 0, W, H);
      // sky/ceiling
      ctx.fillStyle = '#08080e'; ctx.fillRect(0, 0, W, H/2);
      // floor perspective
      const cx = W/2, cy = H/2;
      for (let i = 0; i < 8; i++) {
        const t = i / 8;
        const shade = 20 + t * 40 | 0;
        ctx.fillStyle = `rgb(${shade},${shade*0.6|0},${shade*0.4|0})`;
        ctx.beginPath();
        ctx.moveTo(cx - t*W*0.6, cy + t*H*0.4);
        ctx.lineTo(cx + t*W*0.6, cy + t*H*0.4);
        ctx.lineTo(cx + (t+0.13)*W*0.6, cy + (t+0.13)*H*0.4);
        ctx.lineTo(cx - (t+0.13)*W*0.6, cy + (t+0.13)*H*0.4);
        ctx.closePath(); ctx.fill();
      }
      // walls (brick tint)
      for (let i = 0; i < 8; i++) {
        const t = i/8, tn = (i+1)/8;
        const shade = 60 + t*80 | 0;
        ctx.fillStyle = `rgb(${shade},${shade*0.4|0},${shade*0.25|0})`;
        ctx.beginPath();
        ctx.moveTo(cx - t*W*0.6, cy + t*H*0.4);
        ctx.lineTo(cx - t*W*0.6, cy - t*H*0.4);
        ctx.lineTo(cx - tn*W*0.6, cy - tn*H*0.4);
        ctx.lineTo(cx - tn*W*0.6, cy + tn*H*0.4);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + t*W*0.6, cy + t*H*0.4);
        ctx.lineTo(cx + t*W*0.6, cy - t*H*0.4);
        ctx.lineTo(cx + tn*W*0.6, cy - tn*H*0.4);
        ctx.lineTo(cx + tn*W*0.6, cy + tn*H*0.4);
        ctx.closePath(); ctx.fill();
      }
      // pistol silhouette bottom
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(W*0.4, H*0.75, W*0.2, H*0.25);
      // title text
      ctx.fillStyle = '#ff3b1e';
      ctx.font = 'bold 22px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DOOMFALL', W/2, 40);
      ctx.fillStyle = '#ffb347';
      ctx.font = '14px "VT323", monospace';
      ctx.fillText('SIGNAL LOST', W/2, 60);
    } else if (kind === 'overdrive') {
      // Neon side-scroll cover
      ctx.fillStyle = '#0a0a1e'; ctx.fillRect(0, 0, W, H);
      // sun/circle
      const grd = ctx.createRadialGradient(W/2, H*0.55, 10, W/2, H*0.55, W*0.4);
      grd.addColorStop(0, '#ff2fa3'); grd.addColorStop(0.5, '#ff2f2f'); grd.addColorStop(1, '#0a0a1e');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
      // scanline stripes
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = `rgba(0,0,0,${0.4 - i*0.05})`;
        ctx.fillRect(0, H*0.4 + i*8, W, 2);
      }
      // ground grid
      ctx.strokeStyle = '#4ff0ff'; ctx.lineWidth = 1;
      for (let i = 0; i < 10; i++) {
        const y = H*0.7 + i*(H*0.03);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      for (let i = -10; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(W/2 + i*40, H*0.7);
        ctx.lineTo(W/2 + i*200, H);
        ctx.stroke();
      }
      // Soldier silhouette
      ctx.fillStyle = '#000';
      ctx.fillRect(W*0.15, H*0.55, 30, 50);
      ctx.fillRect(W*0.13, H*0.5, 34, 12); // head
      ctx.fillRect(W*0.19, H*0.58, 40, 6); // gun
      // Title
      ctx.fillStyle = '#4ff0ff';
      ctx.font = 'bold 18px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('OVERDRIVE', W/2, 40);
      ctx.fillStyle = '#ffb347';
      ctx.font = '14px "VT323", monospace';
      ctx.fillText('SQUAD // PATCH NOTES', W/2, 58);
    } else if (kind === 'gravityhop') {
      // Platformer sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(0, '#1e3a6e'); skyGrad.addColorStop(1, '#8a4fd8');
      ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);
      // pixel clouds
      ctx.fillStyle = '#fff';
      ctx.fillRect(30, 40, 40, 12); ctx.fillRect(35, 34, 30, 12);
      ctx.fillRect(W-90, 60, 50, 12); ctx.fillRect(W-80, 54, 30, 12);
      // ground blocks
      ctx.fillStyle = '#4a2e0e';
      ctx.fillRect(0, H*0.75, W, H*0.25);
      ctx.fillStyle = '#8a6a2a';
      for (let x = 0; x < W; x += 16) { ctx.fillRect(x+2, H*0.75+2, 12, 4); }
      // hero pixel guy
      ctx.fillStyle = '#ff4fd8'; ctx.fillRect(W*0.35, H*0.62, 16, 20);
      ctx.fillStyle = '#fff'; ctx.fillRect(W*0.35, H*0.6, 16, 6);
      ctx.fillStyle = '#000'; ctx.fillRect(W*0.36, H*0.62, 3, 3); ctx.fillRect(W*0.4, H*0.62, 3, 3);
      // pixel to collect
      ctx.fillStyle = '#4ff0ff';
      ctx.fillRect(W*0.6, H*0.5, 10, 10);
      ctx.fillStyle = '#fff';
      ctx.fillRect(W*0.6+2, H*0.5+2, 6, 6);
      // title
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GRAVITY HOP', W/2, 30);
      ctx.fillStyle = '#4ff0ff';
      ctx.font = '14px "VT323", monospace';
      ctx.fillText('SYNC ERROR', W/2, 48);
    } else if (kind === 'roadfury') {
      // Sunset sky
      const sky = ctx.createLinearGradient(0, 0, 0, H*0.6);
      sky.addColorStop(0, '#ff5a2a'); sky.addColorStop(0.5, '#ff2f8a'); sky.addColorStop(1, '#4a1a5a');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H*0.6);
      // sun
      const sun = ctx.createRadialGradient(W/2, H*0.45, 5, W/2, H*0.45, 80);
      sun.addColorStop(0, '#ffe57a'); sun.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H*0.6);
      // Ground
      ctx.fillStyle = '#137a3a'; ctx.fillRect(0, H*0.6, W, H*0.4);
      // Road (perspective triangle)
      ctx.fillStyle = '#2a2a2a';
      ctx.beginPath();
      ctx.moveTo(W*0.4, H*0.6); ctx.lineTo(W*0.6, H*0.6);
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
      // Lane dashes
      ctx.fillStyle = '#f0f0f0';
      for (let i = 0; i < 5; i++) {
        const t = i / 5;
        const y = H*0.6 + t * H*0.4;
        const w = 6 + t * 40;
        ctx.fillRect(W/2 - w/2, y, w, 4 + t*6);
      }
      // Bike silhouette
      ctx.fillStyle = '#000';
      ctx.fillRect(W*0.42, H*0.78, W*0.16, H*0.15);
      ctx.fillRect(W*0.45, H*0.7, W*0.1, H*0.12);
      ctx.fillStyle = '#ff2f2f';
      ctx.fillRect(W*0.44, H*0.74, W*0.12, H*0.08);
      // Title
      ctx.fillStyle = '#ffb347';
      ctx.font = 'bold 20px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ROAD FURY', W/2, 34);
      ctx.fillStyle = '#4ff0ff';
      ctx.font = '14px "VT323", monospace';
      ctx.fillText('MOTO COMBAT', W/2, 54);
    }
  }

  function build(onSelect) {
    const shelf = document.getElementById('cart-shelf');
    shelf.innerHTML = '';
    CARTS.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'cart';
      el.setAttribute('data-testid', `cart-${c.id}`);
      el.dataset.index = i;
      if (c.ribbon) {
        const rb = document.createElement('div');
        rb.className = 'ribbon';
        rb.textContent = c.ribbon;
        el.appendChild(rb);
      }
      const art = document.createElement('div'); art.className = 'cart-art';
      const cv = document.createElement('canvas'); cv.width = 320; cv.height = 200;
      art.appendChild(cv);
      el.appendChild(art);
      drawCover(cv, c.cover);

      const title = document.createElement('div');
      title.className = 'cart-title'; title.textContent = c.title;
      const genre = document.createElement('div');
      genre.className = 'cart-genre'; genre.textContent = c.genre;
      const meta = document.createElement('div');
      meta.className = 'cart-meta';
      meta.innerHTML = `<span class="stars">${c.stars}</span><span>${c.plays}</span>`;

      el.appendChild(title); el.appendChild(genre); el.appendChild(meta);
      el.addEventListener('click', () => onSelect(c));
      shelf.appendChild(el);
    });
  }

  let selectedIdx = 0;
  function updateSelection() {
    const carts = document.querySelectorAll('.cart');
    carts.forEach((c, i) => c.classList.toggle('selected', i === selectedIdx));
  }

  function initKeys(onSelect) {
    document.addEventListener('keydown', (e) => {
      if (!document.getElementById('home-screen').classList.contains('active')) return;
      if (e.key === 'ArrowLeft') { selectedIdx = (selectedIdx - 1 + CARTS.length) % CARTS.length; updateSelection(); }
      else if (e.key === 'ArrowRight') { selectedIdx = (selectedIdx + 1) % CARTS.length; updateSelection(); }
      else if (e.key === 'Enter') { onSelect(CARTS[selectedIdx]); }
    });
  }

  function tickClock() {
    const el = document.getElementById('home-clock');
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (el) el.textContent = `${hh}:${mm}`;
  }
  setInterval(tickClock, 30000);
  tickClock();

  return { CARTS, build, updateSelection, initKeys, drawCover };
})();
