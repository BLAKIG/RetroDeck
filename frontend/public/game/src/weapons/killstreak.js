/* Kill streak system. Counts kills that happen within STREAK_WINDOW ms
   of each other. Fires a popup + sound + short damage bonus at each tier. */
(function () {
  const WINDOW_MS = 4200;
  const TIERS = [
    { count: 2,  name: 'DOUBLE KILL',  color: '#ffd54a', boost: 1.1, freq: 520 },
    { count: 3,  name: 'TRIPLE KILL',  color: '#ffb347', boost: 1.15, freq: 620 },
    { count: 5,  name: 'RAMPAGE',      color: '#ff6a2a', boost: 1.2,  freq: 720 },
    { count: 7,  name: 'DOMINATING',   color: '#ff3b1e', boost: 1.25, freq: 820 },
    { count: 10, name: 'MONSTER KILL', color: '#ff2fd8', boost: 1.35, freq: 920 },
    { count: 15, name: 'GODLIKE',      color: '#4ff0ff', boost: 1.5,  freq: 1040 }
  ];

  class KillStreak {
    constructor() {
      this.kills = [];      // timestamps
      this.count = 0;       // current streak length
      this.highestTier = 0; // last tier index reached this streak
      this.damageBoost = 1;
      this.boostExpires = 0;
    }
    onKill(now) {
      // Drop stale.
      while (this.kills.length && (now - this.kills[0]) > WINDOW_MS) this.kills.shift();
      this.kills.push(now);
      this.count = this.kills.length;
      // Which tier are we now at?
      let tier = -1;
      for (let i = 0; i < TIERS.length; i++) if (this.count >= TIERS[i].count) tier = i;
      // Award popup + boost only when moving UP a tier.
      if (tier > this.highestTier && tier >= 0) {
        this.highestTier = tier;
        const T = TIERS[tier];
        this.damageBoost = T.boost;
        this.boostExpires = now + 5000;
        return T;
      }
      return null;
    }
    update(now) {
      // Streak resets naturally as timestamps expire.
      while (this.kills.length && (now - this.kills[0]) > WINDOW_MS) this.kills.shift();
      this.count = this.kills.length;
      if (this.count < 2) this.highestTier = -1;
      if (now > this.boostExpires) this.damageBoost = 1;
    }
    activeTier() {
      if (this.highestTier < 0) return null;
      return TIERS[this.highestTier];
    }
  }

  KillStreak.TIERS = TIERS;
  window.KillStreak = KillStreak;
})();
