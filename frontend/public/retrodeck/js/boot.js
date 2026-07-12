/* Boot sequence: fake loading messages with modern-absurd tone. */
window.RetroBoot = (() => {
  const messages = [
    { txt: 'RetroDeck OS v2.6 boot sequence initiated...', cls: 'ok', delay: 200 },
    { txt: 'CHECK cartridge slot ...................... OK', cls: 'ok', delay: 220 },
    { txt: 'DUST LEVEL ................................ acceptable', cls: 'warn', delay: 200 },
    { txt: 'CHECKING Wi-Fi ............................ still better than 2003 dial-up', cls: 'ok', delay: 260 },
    { txt: 'SYNCING cartridge to cloud ................ (just kidding, it\'s local)', cls: 'dim', delay: 260 },
    { txt: 'LOADING chiptune subsystem ................ [######--] 78%', cls: 'ok', delay: 260 },
    { txt: 'DISABLING notifications ................... permanently', cls: 'ok', delay: 220 },
    { txt: 'PATCH NOTES: fixed the year 2000 bug ...... again', cls: 'warn', delay: 240 },
    { txt: 'RESPECTING attention span ................. ENABLED', cls: 'ok', delay: 240 },
    { txt: 'READY ..................................... insert player', cls: 'ok', delay: 260 },
  ];

  function boot(onDone) {
    const logEl = document.getElementById('boot-log');
    const bar = document.getElementById('boot-bar-fill');
    const press = document.getElementById('press-start');
    logEl.innerHTML = '';
    let i = 0;
    function step() {
      if (i >= messages.length) {
        bar.style.width = '100%';
        press.classList.add('visible');
        return;
      }
      const m = messages[i++];
      const line = document.createElement('div');
      line.className = m.cls;
      line.textContent = '> ' + m.txt;
      logEl.appendChild(line);
      logEl.scrollTop = logEl.scrollHeight;
      bar.style.width = ((i / messages.length) * 100) + '%';
      setTimeout(step, m.delay);
    }
    step();

    function armStart() {
      const go = () => {
        if (!press.classList.contains('visible')) return;
        document.removeEventListener('keydown', go);
        document.removeEventListener('click', go);
        onDone && onDone();
      };
      document.addEventListener('keydown', go);
      document.addEventListener('click', go);
    }
    armStart();
  }

  return { boot };
})();
