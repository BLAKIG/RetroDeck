/* Loot pickup system. When an enemy dies, roll for a drop; if it drops,
   create a floating pickup that requires E to collect. Rendered as a
   billboard sprite via the existing raycaster.drawSprite. */
(function () {
  // Drop tables by enemy type. Format: { key, chance, min, max }
  const DROP_TABLES = {
    guard: [
      { kind: 'ammo',   chance: 0.55, min: 10, max: 18 },
      { kind: 'medkit', chance: 0.18, min: 15, max: 20 },
      { kind: 'armor',  chance: 0.08, min: 10, max: 15 }
    ],
    soldier: [
      { kind: 'ammo',   chance: 0.65, min: 20, max: 32 },
      { kind: 'medkit', chance: 0.28, min: 20, max: 30 },
      { kind: 'armor',  chance: 0.18, min: 15, max: 25 }
    ],
    // Elite — guaranteed drops on every kill.
    elite: [
      { kind: 'ammo',   chance: 1.0, min: 30, max: 45 },
      { kind: 'medkit', chance: 1.0, min: 25, max: 40 },
      { kind: 'armor',  chance: 0.8, min: 25, max: 40 }
    ],
    rick: [
      { kind: 'ammo',   chance: 1,    min: 60, max: 90 },
      { kind: 'medkit', chance: 1,    min: 50, max: 50 },
      { kind: 'armor',  chance: 1,    min: 50, max: 50 }
    ]
  };

  function rollDrops(enemyType, x, y) {
    const table = DROP_TABLES[enemyType] || DROP_TABLES.guard;
    const drops = [];
    for (const r of table) {
      if (Math.random() < r.chance) {
        const amt = Math.floor(r.min + Math.random() * (r.max - r.min + 1));
        drops.push(createLoot(x, y, r.kind, amt, drops.length));
      }
    }
    // Power-up roll — elite for soldiers + rick, normal for guards.
    if (window.PowerUps) {
      const tier = (enemyType === 'soldier' || enemyType === 'rick') ? 'elite' : 'normal';
      const puId = PowerUps.rollDropId(tier);
      if (puId) drops.push(PowerUps.createDrop(puId, x + (Math.random() - 0.5) * 0.3, y + (Math.random() - 0.5) * 0.3));
    }
    return drops;
  }

  function createLoot(x, y, kind, amount, offset = 0) {
    // Nudge multiple drops apart slightly so they don't stack visually.
    const jitter = 0.15 * offset;
    return {
      x: x + (Math.random() - 0.5) * 0.2 + jitter,
      y: y + (Math.random() - 0.5) * 0.2,
      kind,
      amount,
      alive: true,
      scale: kind === 'armor' ? 0.55 : 0.5,
      tex: TEX.get(kind === 'armor' ? 'armorPickup' : (kind === 'medkit' ? 'medkit' : 'ammo')),
      spawnedAt: performance.now()
    };
  }

  window.LootSystem = { rollDrops, createLoot };
})();
