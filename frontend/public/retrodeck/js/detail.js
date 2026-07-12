/* Detail screen: fills lore + cart cover + controls, wires insert button. */
window.RetroDetail = (() => {
  let current = null;

  function show(cart, onInsert) {
    current = cart;
    document.getElementById('detail-title').textContent = cart.title;
    document.getElementById('detail-tagline').textContent = cart.tagline;

    const meta = document.getElementById('detail-meta');
    meta.innerHTML = cart.meta.map(m => `<span class="pill">${m}</span>`).join('');

    document.getElementById('detail-lore').textContent = '"' + cart.lore + '"';

    const ctrls = document.getElementById('detail-controls');
    ctrls.innerHTML = cart.controls.map(c => `<div>&#9642; ${c}</div>`).join('');

    // Big cartridge cover
    const cartEl = document.getElementById('detail-cart');
    cartEl.innerHTML = '';
    const cv = document.createElement('canvas');
    cv.width = 640; cv.height = 400;
    cartEl.appendChild(cv);
    RetroHome.drawCover(cv, cart.cover);

    const btn = document.getElementById('insert-btn');
    btn.onclick = () => onInsert(cart);
  }

  return { show };
})();
